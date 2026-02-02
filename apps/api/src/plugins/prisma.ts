import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";

const SLOW_QUERY_THRESHOLD_MS = 100;

export const prismaPlugin = fp(async (server: FastifyInstance) => {
  const logQueries = process.env.NODE_ENV === "development" || process.env.LOG_PRISMA_QUERIES === "true";

  // Build PrismaClient options with connection pooling
  // Connection pooling is handled by Prisma's built-in connection pool
  // Configure pool size via DATABASE_URL connection_limit parameter
  // Example: postgresql://user:pass@host/db?connection_limit=20
  const prisma = new PrismaClient(
    logQueries
      ? {
          log: [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "error" },
            { emit: "stdout", level: "warn" }
          ]
        }
      : undefined
  );

  if (logQueries) {
    prisma.$on("query" as never, (e: { query: string; params: string; duration: number }) => {
      if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
        server.log.warn({ query: e.query, duration: e.duration, params: e.params }, "Slow Prisma query detected");
      }
    });
  }

  await prisma.$connect();

  server.decorate("prisma", prisma);

  server.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});

