export default async function (fastify) {
  fastify.get(
    "",
    {
      schema: {
        query: {
          type: "object",
          properties: {
            rangeTop: { type: "number", minimum: 1, maximum: 50, default: 6 },
            rangeGenres: {
              type: "number",
              minimum: 1,
              maximum: 20,
              default: 10,
            },
            rangeHistory: {
              type: "number",
              minimum: 5,
              maximum: 100,
              default: 50,
            },
          },
        },
        params: {
          type: "object",
          required: ["username"],
          properties: { username: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              user: { $ref: "user#" },
              friendship: { type: "string" },
              overview: { $ref: "overview#" },
              top: { $ref: "top#" },
              genres: { type: "array", items: { type: "string" } },
              leaved: { type: "boolean" },
              history: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    ...fastify.getSchema("track").properties,
                    duration_ms: { type: "number" },
                    played_at: { type: "string", format: "datetime" },
                  },
                },
              },
              status: { type: "number" },
            },
          },
        },
        tags: ["user"],
      },
    },
    async function (req, reply) {
      const { user, requestor } = req;
      const { rangeTop, rangeHistory, rangeGenres } = req.query;

      const requests = [
        fastify.userTop({ _id: user._id, range: rangeTop }),
        fastify.userListeningHistory({ _id: user._id, range: rangeHistory }),
        fastify.userOverview({ _id: user._id }),
        fastify.userGenres({ token: user.tokens.token, range: rangeGenres }),
      ];

      if (requestor)
        requests.push(
          fastify.db.User.findOne(
            { _id: user._id, friends: requestor._id },
            { "friends.$": 1 }
          ),
          fastify.db.FriendRequest.findOne({
            from: requestor._id,
            to: user._id,
          }),
          fastify.db.FriendRequest.findOne({
            from: user._id,
            to: requestor._id,
          })
        );

      const [top, { history }, overview, genres, ...friendship] =
        await Promise.all(requests);

      const response = {
        user,
        top,
        history,
        overview,
        genres,
        friendship: friendship[0]?.friends.length
          ? "friend"
          : friendship[1]
          ? "following"
          : friendship[2]
          ? "follow"
          : "none",
        leaved: user.tokens.refreshToken === "",
      };

      reply.send(response);
    }
  );
}
