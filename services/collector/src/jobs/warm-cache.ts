import type { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";
import pLimit from "p-limit";

type RepoListResponse = { data: Array<{ fullName: string }>; cursor: string | null; hasMore: boolean };

const TOP_LANGUAGES: string[] = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "C++",
  "C#",
  "PHP",
  "Ruby",
];

export async function runWarmCacheJob(params: {
  prisma: PrismaClient;
  logger: Logger;
  apiBaseUrl: string;
  snapshotDate: Date;
}): Promise<void> {
  const startedAt = new Date();
  const sync = await params.prisma.syncLog.create({
    data: {
      syncType: "warm-cache",
      status: "running",
      startedAt,
    },
  });

  const origin = params.apiBaseUrl.replace(/\/$/, "");
  const v1 = `${origin}/v1`;
  const limit = pLimit(8);

  const hit = async (path: string) => {
    const url = `${path.startsWith("http") ? path : `${v1}${path}`}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const cache = res.headers.get("x-cache");
    if (!res.ok) throw new Error(`warm-cache: ${res.status} ${url}`);
    params.logger.info({ url, cache: cache ?? undefined }, "cache warmed");
    return res;
  };

  try {
    params.logger.info(
      { snapshotDate: params.snapshotDate.toISOString().slice(0, 10), apiBaseUrl: origin },
      "warm-cache job started"
    );

    // Warm core list endpoints (hot paths)
    const [reposRes] = await Promise.all([
      hit(`/repositories?limit=50&sort=score&period=daily`),
      hit(`/developers?limit=30&sort=impact`),
      hit(`/developers?limit=30&sort=followers`),
      hit(`/developers?limit=30&sort=stars`),
      hit(`/trends/languages?period=weekly`),
      hit(`/trends/topics?period=weekly`),
      hit(`/trends/growth?metric=stars&period=daily&limit=10`).catch(() => null),
      hit(`/trends/growth?metric=forks&period=daily&limit=10`).catch(() => null),
      hit(`/trends/growth?metric=score&period=daily&limit=10`).catch(() => null),
    ]);

    // Warm language-filtered repository lists
    await Promise.all(
      TOP_LANGUAGES.map((lang) =>
        limit(() => hit(`/repositories?limit=50&sort=score&period=daily&language=${encodeURIComponent(lang)}`))
      )
    );

    // Warm repo detail + analysis for top repos
    const reposJson = (await reposRes.json()) as RepoListResponse;
    const topRepos = reposJson.data.slice(0, 20).map((r) => r.fullName);

    await Promise.all(
      topRepos.map((fullName) =>
        limit(async () => {
          const enc = encodeURIComponent(fullName);
          await hit(`/repositories/${enc}`);
          await hit(`/repositories/${enc}/analysis`).catch(() => null);
        })
      )
    );

    await params.prisma.syncLog.update({
      where: { id: sync.id },
      data: { status: "success", recordsProcessed: 1, completedAt: new Date() },
    });
    params.logger.info("warm-cache job complete");
  } catch (err) {
    params.logger.error({ err }, "warm-cache job failed");
    await params.prisma.syncLog.update({
      where: { id: sync.id },
      data: {
        status: "failed",
        recordsFailed: 1,
        completedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
