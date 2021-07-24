import mongoose from "mongoose";
const { Schema, model } = mongoose;

const schema = new Schema({
  userName: {
    type: String,
    required: true,
  },
  customID: {
    type: String,
    unique: true,
    required: true,
  },
  spotifyID: {
    type: String,
    required: true,
  },
  refreshToken: {
    type: String,
    required: true,
  },
  lastSpotifyToken: {
    type: String,
    required: true,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
  registrationDate: {
    type: Date,
    default: Date.now,
  },
  recentlyPlayed: {
    type: Array,
    default: [],
  },
  avatar: {
    type: String,
  },
  country: {
    type: String,
    default: "US",
  },
  privacy: {
    type: String,
    default: "public",
    required: true,
  },
  autoUpdate: {
    type: Boolean,
    required: true,
    default: false,
  },
});

export default model("User", schema);
