import fp from "fastify-plugin";

const plugin = fp(async function plugin(fastify) {
  fastify.decorateRequest("user", "");
  fastify.decorate("getUserInfo", async function (req) {
    const { username } = req.params;

    const user = await fastify.db.User.findOne(
      {
        "settings.username": username,
      },
      {
        token: "$tokens.token",
        refreshToken: "$tokens.refreshToken",
        country: 1,
        "settings.privacy": 1,
        username: "$settings.username",
      }
    ).lean();

    if (!user) throw fastify.error("User not found", 404);

    const isPrivate = user.settings.privacy === "private";
    const requestorID = req.session.get("id");
    if (isPrivate && user._id !== requestorID)
      throw fastify.error("Private profile", 403);

    user.leaved = user.refreshToken === "";
    req.user = user;
  });
});

export default plugin;
