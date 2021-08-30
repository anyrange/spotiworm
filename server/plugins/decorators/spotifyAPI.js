import fp from "fastify-plugin";
import api from "../../includes/api.js";

const plugin = fp(async (fastify) => fastify.decorate("spotifyAPI", api));

export default plugin;
