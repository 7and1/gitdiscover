import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { RateLimiterRedis } from "rate-limiter-flexible";

export const rateLimitPlugin = fp(async (server: FastifyInstance) => {
  const redis = server.redis;

  const anonymousLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "ratelimit:anon",
    points: 100,
    duration: 60
  });

  const authenticatedLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "ratelimit:auth",
    points: 1000,
    duration: 60
  });

  server.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await server.getAuthUser(req);
    const limiter = auth ? authenticatedLimiter : anonymousLimiter;
    const limit = auth ? 1000 : 100;
    const key = auth ? `u:${auth.id}` : `ip:${req.ip}`;

    try {
      const result = await limiter.consume(key, 1);

      reply.header("X-RateLimit-Limit", String(limit));
      reply.header("X-RateLimit-Remaining", String(result.remainingPoints));
      reply.header(
        "X-RateLimit-Reset",
        String(Math.floor(Date.now() / 1000) + Math.ceil(result.msBeforeNext / 1000))
      );
    } catch (err) {
      const msBeforeNext = (err as { msBeforeNext?: number }).msBeforeNext ?? 1000;
      const retryAfter = Math.ceil(msBeforeNext / 1000);

      reply.status(429).send({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests",
          retryAfter
        }
      });
    }
  });
});

