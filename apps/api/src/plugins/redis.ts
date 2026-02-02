import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { Redis } from "ioredis";

export const redisPlugin = fp(async (server: FastifyInstance) => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required");

  const redis = new Redis(redisUrl, {
    enableReadyCheck: true,
    maxRetriesPerRequest: null
  });

  server.decorate("redis", redis);

  server.addHook("onClose", async () => {
    await redis.quit();
  });
});
