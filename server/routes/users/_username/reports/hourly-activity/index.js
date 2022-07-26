export default async function (fastify) {
  fastify.get(
    "",
    {
      schema: {
        params: {
          type: "object",
          required: ["username"],
          properties: { username: { type: "string" } },
        },
        querystring: {
          type: "object",
          properties: {
            firstDate: { type: "string", format: "date" },
            lastDate: { type: "string", format: "date" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              hourlyActivity: {
                type: "array",
                items: {
                  type: "object",
                  required: ["time", "playtime", "plays"],
                  properties: {
                    time: { type: "number" },
                    playtime: { type: "number" },
                    plays: { type: "number" },
                  },
                },
              },
              trackingDuration: { type: "number" },
            },
          },
        },
        tags: ["user"],
      },
      preHandler: [fastify.getUserInfo],
    },
    async function (req, reply) {
      const user = req.userInfo;
      const { firstDate, lastDate } = req.query;

      const options = { _id: user._id, firstDate, lastDate };
      const agg = getAgg(options);

      const userRef = fastify.db.User;

      const [activity, [{ days }]] = await Promise.all([
        userRef.aggregate(agg),
        userRef.aggregate([
          { $match: { _id: user._id } },
          { $project: { "listeningHistory.played_at": 1 } },
          { $unwind: { path: "$listeningHistory" } },
          {
            $project: {
              time: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$listeningHistory.played_at",
                },
              },
            },
          },
          { $group: { _id: "$time", plays: { $sum: 1 } } },
          { $count: "days" },
        ]),
      ]);

      const hourlyActivity = formatActivity(activity);
      return reply.send({ hourlyActivity, trackingDuration: days });
    }
  );

  const formatActivity = (activity) => {
    const hourlyActivity = [];
    for (let i = 1; i <= 24; i++) {
      hourlyActivity.push(
        activity.find((hour) => hour.time === i) || {
          time: i,
          playtime: 0,
          plays: 0,
        }
      );
    }

    return hourlyActivity;
  };
}

const getAgg = ({ _id, firstDate, lastDate }) => {
  const agg = [
    { $match: { _id } },
    { $project: { listeningHistory: 1 } },
    { $unwind: { path: "$listeningHistory" } },
  ];

  if (firstDate)
    agg.push({
      $match: {
        "listeningHistory.played_at": { $gte: new Date(firstDate) },
      },
    });

  if (lastDate)
    agg.push({
      $match: {
        "listeningHistory.played_at": { $lte: new Date(lastDate) },
      },
    });

  agg.push(
    {
      $project: {
        _id: "$listeningHistory.track",
        time: {
          $dateToString: {
            format: "%H",
            date: "$listeningHistory.played_at",
          },
        },
      },
    },
    {
      $lookup: {
        from: "tracks",
        localField: "_id",
        foreignField: "_id",
        as: "tracks",
      },
    },
    {
      $group: {
        _id: "$time",
        plays: { $sum: 1 },
        playtime: { $sum: { $first: "$tracks.duration_ms" } },
      },
    },
    {
      $project: {
        time: { $toInt: "$_id" },
        plays: 1,
        playtime: { $round: [{ $divide: ["$playtime", 60000] }, 0] },
      },
    },
    { $sort: { time: -1 } }
  );
  return agg;
};
