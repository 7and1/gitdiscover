import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

export const cachePlugin = fp(async (server: FastifyInstance) => {
  server.decorate("cacheGetJson", async <T>(key: string): Promise<T | null> => {
    const raw = await server.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  });

  server.decorate("cacheSetJson", async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
    const payload = JSON.stringify(value);
    await server.redis.set(key, payload, "EX", ttlSeconds);
  });

  server.decorate("cacheDel", async (key: string): Promise<void> => {
    await server.redis.del(key);
  });
});

