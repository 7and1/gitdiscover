import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { getEnv } from "./config/env";
import { prismaPlugin } from "./plugins/prisma";
import { redisPlugin } from "./plugins/redis";
import { cachePlugin } from "./plugins/cache";
import { authPlugin } from "./plugins/auth";
import { rateLimitPlugin } from "./plugins/rateLimit";
import { metricsPlugin } from "./plugins/metrics";
import { AppError } from "./utils/errors";
import { v1Routes } from "./routes/v1";
import { authRoutes } from "./routes/auth";

export async function buildServer(): Promise<FastifyInstance> {
  const env = getEnv();

  const server = Fastify({
    logger: true,
    trustProxy: true,
    bodyLimit: 1024 * 1024, // 1MB
    maxParamLength: 100,
  });

  await server.register(cors, {
    origin: [env.APP_URL],
    credentials: true
  });

  await server.register(helmet);
  await server.register(compress, { global: true, threshold: 1024 });

  await server.register(swagger, {
    openapi: {
      info: {
        title: "GitDiscover API",
        version: "1.0.0"
      }
    }
  });
  await server.register(swaggerUi, { routePrefix: "/docs" });

  await server.register(prismaPlugin);
  await server.register(redisPlugin);
  await server.register(cachePlugin);
  await server.register(authPlugin);
  await server.register(rateLimitPlugin);
  await server.register(metricsPlugin);

  await authRoutes(server, env);

  server.get("/health", async () => {
    const startedAt = process.hrtime.bigint();

    const dbStart = process.hrtime.bigint();
    const dbOk = await server.prisma
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);
    const dbLatency = Number(process.hrtime.bigint() - dbStart) / 1e6;

    const redisStart = process.hrtime.bigint();
    const redisOk = await server.redis
      .ping()
      .then(() => true)
      .catch(() => false);
    const redisLatency = Number(process.hrtime.bigint() - redisStart) / 1e6;

    const kvOk = true;

    const allOk = dbOk && redisOk && kvOk;
    const someOk = dbOk || redisOk;

    return {
      status: allOk ? "healthy" : someOk ? "degraded" : "unhealthy",
      checks: {
        database: dbOk,
        redis: redisOk,
        kv: kvOk
      },
      latency: {
        database: Math.round(dbLatency),
        redis: Math.round(redisLatency)
      },
      uptime: process.uptime(),
      version: process.env.APP_VERSION ?? "0.1.0",
      elapsedMs: Number(process.hrtime.bigint() - startedAt) / 1e6
    };
  });

  await server.register(async (v1) => {
    await v1.register(v1Routes);
  }, { prefix: "/v1" });

  server.setNotFoundHandler(async (_req, reply) => {
    reply.status(404).send({ error: { code: "NOT_FOUND", message: "Resource not found" } });
  });

  server.setErrorHandler(async (err, _req, reply) => {
    if (err instanceof AppError) {
      reply.status(err.statusCode).send({
        error: {
          code: err.code,
          message: err.message,
          details: err.details
        }
      });
      return;
    }

    server.log.error({ err }, "Unhandled error");
    reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
  });

  return server;
}
