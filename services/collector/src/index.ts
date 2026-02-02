import "dotenv/config";
import http from "http";
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { createGitHubClient } from "./sources/github";
import { getEnv } from "./config/env";
import { createLogger } from "./lib/logger";
import { runDailyJob } from "./jobs/daily";
import { runAiJob } from "./jobs/ai";
import { runWarmCacheJob } from "./jobs/warm-cache";

// Job status tracking for health checks
const jobStatus = {
  daily: { lastRun: null as Date | null, lastSuccess: null as Date | null, error: null as string | null },
  ai: { lastRun: null as Date | null, lastSuccess: null as Date | null, error: null as string | null },
  warmCache: { lastRun: null as Date | null, lastSuccess: null as Date | null, error: null as string | null },
};

async function main() {
  const env = getEnv();
  const logger = createLogger(env.LOG_LEVEL);

  const prisma = new PrismaClient();
  await prisma.$connect();

  const octokit = createGitHubClient(env.GITHUB_TOKEN);

  // Start health check server
  const healthPort = process.env.HEALTH_PORT ? Number(process.env.HEALTH_PORT) : 3003;
  const healthServer = http.createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      const now = new Date();
      const response = {
        status: "healthy",
        uptime: process.uptime(),
        timestamp: now.toISOString(),
        jobs: {
          daily: {
            lastRun: jobStatus.daily.lastRun?.toISOString() ?? null,
            lastSuccess: jobStatus.daily.lastSuccess?.toISOString() ?? null,
            error: jobStatus.daily.error,
          },
          ai: {
            lastRun: jobStatus.ai.lastRun?.toISOString() ?? null,
            lastSuccess: jobStatus.ai.lastSuccess?.toISOString() ?? null,
            error: jobStatus.ai.error,
          },
          warmCache: {
            lastRun: jobStatus.warmCache.lastRun?.toISOString() ?? null,
            lastSuccess: jobStatus.warmCache.lastSuccess?.toISOString() ?? null,
            error: jobStatus.warmCache.error,
          },
        },
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  healthServer.listen(healthPort, "0.0.0.0", () => {
    logger.info(`Health check server listening on port ${healthPort}`);
  });

  // Helper to run jobs with status tracking
  const runJob = async (
    name: "daily" | "ai" | "warmCache",
    jobFn: () => Promise<void>
  ) => {
    jobStatus[name].lastRun = new Date();
    jobStatus[name].error = null;
    try {
      await jobFn();
      jobStatus[name].lastSuccess = new Date();
    } catch (e) {
      jobStatus[name].error = e instanceof Error ? e.message : String(e);
      throw e;
    }
  };

  const cmd = process.argv[2];
  const snapshotDate = utcDate(new Date());

  if (cmd === "daily") {
    await runJob("daily", () => runDailyJob({ prisma, octokit, logger, snapshotDate }));
    await prisma.$disconnect();
    healthServer.close();
    return;
  }
  if (cmd === "ai") {
    await runJob("ai", () =>
      runAiJob({
        prisma,
        logger,
        snapshotDate,
        ...(env.OPENAI_API_KEY ? { openaiApiKey: env.OPENAI_API_KEY } : {}),
      })
    );
    await prisma.$disconnect();
    healthServer.close();
    return;
  }
  if (cmd === "warm-cache") {
    await runJob("warmCache", () =>
      runWarmCacheJob({ prisma, logger, snapshotDate, apiBaseUrl: env.API_BASE_URL })
    );
    await prisma.$disconnect();
    healthServer.close();
    return;
  }

  logger.info("collector scheduler started (UTC)");

  cron.schedule(
    "0 2 * * *",
    () =>
      runJob("daily", () =>
        runDailyJob({ prisma, octokit, logger, snapshotDate: utcDate(new Date()) })
      ).catch((e) => logger.error({ e })),
    { timezone: "UTC" }
  );

  cron.schedule(
    "0 3 * * *",
    () =>
      runJob("ai", () =>
        runAiJob({
          prisma,
          logger,
          snapshotDate: utcDate(new Date()),
          ...(env.OPENAI_API_KEY ? { openaiApiKey: env.OPENAI_API_KEY } : {}),
        })
      ).catch((e) => logger.error({ e })),
    { timezone: "UTC" }
  );

  cron.schedule(
    "0 4 * * *",
    () =>
      runJob("warmCache", () =>
        runWarmCacheJob({ prisma, logger, snapshotDate: utcDate(new Date()), apiBaseUrl: env.API_BASE_URL })
      ).catch((e) => logger.error({ e })),
    { timezone: "UTC" }
  );

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    healthServer.close(() => {
      prisma.$disconnect().then(() => {
        process.exit(0);
      });
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

function utcDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
