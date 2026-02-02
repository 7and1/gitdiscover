import type { PrismaClient } from "@prisma/client";
import type { Octokit } from "@octokit/rest";
import type { Logger } from "pino";
import { fetchTrendingRepos } from "../sources/github-trending";
import { upsertRepositories } from "../processors/repositories";
import { upsertDevelopers } from "../processors/developers";

const TRENDING_LANGUAGE_SLUGS: string[] = [
  "javascript",
  "python",
  "typescript",
  "go",
  "rust",
  "java",
  "c%2B%2B",
  "c%23",
  "php",
  "ruby"
];

export async function runDailyJob(params: {
  prisma: PrismaClient;
  octokit: Octokit;
  logger: Logger;
  snapshotDate: Date;
}): Promise<void> {
  const startedAt = new Date();
  const sync = await params.prisma.syncLog.create({
    data: {
      syncType: "daily",
      status: "running",
      startedAt
    }
  });

  try {
    params.logger.info({ snapshotDate: params.snapshotDate.toISOString().slice(0, 10) }, "daily job started");

    const [global, ...byLang] = await Promise.all([
      fetchTrendingRepos({ since: "daily" }),
      ...TRENDING_LANGUAGE_SLUGS.map((slug) => fetchTrendingRepos({ since: "daily", languageSlug: slug }))
    ]);

    const merged = mergeTrending(global.concat(...byLang));
    const top = merged.slice(0, 100);

    const { repositoryIds } = await upsertRepositories({
      prisma: params.prisma,
      octokit: params.octokit,
      snapshotDate: params.snapshotDate,
      trending: top
    });

    const owners = await params.prisma.repository.findMany({
      where: { id: { in: repositoryIds } },
      select: { owner: { select: { login: true } } }
    });
    const ownerLogins = owners.map((r) => r.owner?.login).filter((x): x is string => Boolean(x));

    await upsertDevelopers({
      prisma: params.prisma,
      octokit: params.octokit,
      snapshotDate: params.snapshotDate,
      ownerLogins
    });

    await params.prisma.syncLog.update({
      where: { id: sync.id },
      data: {
        status: "success",
        recordsProcessed: repositoryIds.length,
        completedAt: new Date()
      }
    });
    params.logger.info({ repos: repositoryIds.length }, "daily job complete");
  } catch (err) {
    params.logger.error({ err }, "daily job failed");
    await params.prisma.syncLog.update({
      where: { id: sync.id },
      data: {
        status: "failed",
        recordsFailed: 1,
        completedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err)
      }
    });
    throw err;
  }
}

function mergeTrending<T extends { fullName: string; starsToday: number | null }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const existing = map.get(item.fullName);
    if (!existing) {
      map.set(item.fullName, item);
      continue;
    }
    const a = existing.starsToday ?? 0;
    const b = item.starsToday ?? 0;
    if (b > a) map.set(item.fullName, item);
  }

  return [...map.values()].sort((a, b) => (b.starsToday ?? 0) - (a.starsToday ?? 0));
}
