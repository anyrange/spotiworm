/**
 * @param {import('fastify').FastifyInstance} fastify
 */

export default async function(fastify) {
  fastify.get("/", () => {
    return { message: "I'm alive" };
  });
}
