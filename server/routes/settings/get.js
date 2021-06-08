import User from "../../models/User.js";

export default async function(fastify) {
  const headers = fastify.getSchema("cookie");

  fastify.get(
    "",
    {
      schema: {
        headers,
        response: {
          200: {
            type: "object",
            required: ["private", "customID", "spotifyID", "status"],
            properties: {
              private: { type: "boolean" },
              customID: { type: "string" },
              spotifyID: { type: "string" },
              status: {
                type: "number",
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const _id = req.user_id;
      const user = await User.findOne(
        { _id },
        { private: 1, customID: 1, spotifyID: 1 }
      );

      if (!user)
        return reply.code(404).send({ message: "User not found", status: 404 });

      reply.code(200).send({
        private: user.private,
        customID: user.customID,
        spotifyID: user.spotifyID,
        status: 200,
      });
    }
  );
}
