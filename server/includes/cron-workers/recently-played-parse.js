import User from "../../models/User.js";
import Artist from "../../models/Artist.js";
import Album from "../../models/Album.js";
import Track from "../../models/Track.js";
import Playlist from "../../models/Playlist.js";
import timeDiff from "../../utils/timeDiff.js";
import api from "../api.js";

export default async function () {
  try {
    const start = new Date();

    const users = await User.find(
      { "tokens.refreshToken": { $ne: "" } },
      {
        "tokens.token": 1,
        listeningHistory: { $slice: ["$listeningHistory", 1] },
        display_name: 1,
      }
    ).lean();

    const requests = users.map((user) =>
      parseNewTracks(user).catch((err) => {
        console.log(
          `!listening-histories [${user.display_name}]: ${err.message}`
        );
      })
    );

    await Promise.all(requests);

    const end = new Date();
    console.log(
      `listening-histories [${requests.length}]: updated in ${timeDiff(
        start,
        end
      )} sec`
    );
  } catch (err) {
    console.error("!listening-histories [all]:" + err.message);
  }
}

export async function parseNewTracks(user, limit = 8) {
  const newSongs = [];

  const listenedTracks = await api({
    route: `me/player/recently-played?limit=${limit}`,
    token: user.tokens.token,
  });

  if (listenedTracks.error) throw new Error(listenedTracks.error.message);
  if (!listenedTracks.items.length) return;

  if (!user.listeningHistory || !user.listeningHistory.length) {
    newSongs.push(...listenedTracks.items.map((item) => formatTrack(item)));
  } else {
    const lastPlayedAt = user.listeningHistory[0].played_at;

    listenedTracks.items.forEach((item) => {
      if (
        Date.parse(lastPlayedAt) >= Date.parse(item.played_at) ||
        lastPlayedAt.toISOString() === item.played_at
      )
        return;
      newSongs.push(formatTrack(item));
    });
  }
  if (!newSongs.length) return;

  await Promise.all([
    addArtists(newSongs, user.tokens.token),
    addAlbums(newSongs, user.tokens.token),
    addTracks(newSongs, user.tokens.token),
    addPlaylists(newSongs, user.tokens.token),
    updateHistory(newSongs, user._id),
  ]);
}

const addArtists = async (tracks, token) => {
  const uniqueArtists = [
    ...new Set(
      tracks.map((song) => [...song.artists, ...song.album.artists]).flat(1)
    ),
  ];

  const existingArtists = await Artist.find(
    { _id: { $in: uniqueArtists } },
    "_id"
  ).lean();

  const newArtists = uniqueArtists.filter(
    (id) => !existingArtists.find((existingArtist) => id === existingArtist._id)
  );

  if (!newArtists.length) return;

  const fullInfo = await api({
    route: `artists?ids=${newArtists.join(",")}`,
    token,
  }).then((res) =>
    res.artists.map((artist) => ({
      _id: artist.id,
      images: artist.images.map((image) => image.url),
      name: artist.name,
    }))
  );

  await Artist.insertMany(fullInfo);
};

const addAlbums = async (tracks, token) => {
  const uniqueAlbums = [...new Set(tracks.map((song) => song.album.id))];

  const existingAlbums = await Album.find(
    { _id: { $in: uniqueAlbums } },
    "_id"
  ).lean();

  const newAlbums = uniqueAlbums.filter(
    (id) => !existingAlbums.find((existingAlbum) => id === existingAlbum._id)
  );

  if (!newAlbums.length) return;

  const fullInfo = await api({
    route: `albums?ids=${newAlbums.join(",")}`,
    token,
  }).then((res) =>
    res.albums.map((album) => ({
      _id: album.id,
      name: album.name,
      images: album.images.map((image) => image.url),
    }))
  );

  await Album.insertMany(fullInfo);
};

const addTracks = async (tracks, token) => {
  const uniqueTracks = [...new Set(tracks.map((song) => song.id))];

  const existingTracks = await Track.find(
    { _id: { $in: uniqueTracks } },
    "_id"
  ).lean();

  const newTracks = uniqueTracks.filter(
    (id) => !existingTracks.find((existingTrack) => id === existingTrack._id)
  );

  if (!newTracks.length) return;

  const fullInfo = await api({
    route: `tracks?ids=${newTracks.join(",")}`,
    token,
  }).then((res) =>
    res.tracks.map((track) => ({
      _id: track.id,
      name: track.name,
      album: track.album.id,
      image: track.album.images[1]?.url || track.album.images[0]?.url || "",
      artists: track.artists.map(({ id }) => id),
      duration_ms: track.duration_ms,
    }))
  );

  await Track.insertMany(fullInfo);
};

const addPlaylists = async (tracks, token) => {
  const uniquePlaylists = [...new Set(tracks.map((song) => song.context))];

  const existingPlaylists = await Playlist.find(
    { _id: { $in: uniquePlaylists } },
    "_id"
  ).lean();

  const newPlaylists = uniquePlaylists.filter(
    (id) =>
      !existingPlaylists.find(
        (existingPlaylist) => id === existingPlaylist._id
      ) && id !== null
  );

  if (!newPlaylists.length) return;

  const fullInfo = await Promise.all(
    newPlaylists.map((playlist) =>
      api({
        route: `playlists/${playlist}?fields=collaborative,followers(total),id,images,name,owner(display_name,id),public,tracks(total)`,
        token,
      }).then((res) => ({
        _id: res.id,
        name: res.name,
        owner: { id: res.owner.id, name: res.owner.display_name },
        image: res.images.length ? res.images[0].url : "",
      }))
    )
  );

  await Playlist.insertMany(fullInfo);
};

const updateHistory = async (tracks, _id) => {
  await User.updateOne(
    { _id },
    {
      $push: {
        listeningHistory: {
          $each: tracks.map((track) => ({
            track: track.id,
            context: track.context,
            played_at: track.played_at,
          })),
          $position: 0,
        },
      },
    }
  );
};

const formatTrack = (item) => {
  if (!item || !item.track) return;

  const track = item.track;

  let context = null;
  if (item.context && item.context.type === "playlist") {
    context = item.context.uri.split(":")[2];
  }

  const formatedTrack = {
    album: {
      id: track.album.id,
      artists: track.album.artists.map(({ id }) => id),
    },
    artists: track.artists.map(({ id }) => id),
    id: track.id,
    played_at: item.played_at,
    context,
  };

  return formatedTrack;
};
