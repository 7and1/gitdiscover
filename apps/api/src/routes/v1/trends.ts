import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "../../utils/errors";
import { growthTrendsCacheKey, languageTrendsCacheKey, topicTrendsCacheKey } from "../../utils/cacheKeys";

const PeriodSchema = z.enum(["daily", "weekly", "monthly"]);

const LanguageTrendsQuerySchema = z.object({
  period: PeriodSchema.default("weekly")
});

const TopicTrendsQuerySchema = z.object({
  period: PeriodSchema.default("weekly")
});

const GrowthQuerySchema = z.object({
  metric: z.enum(["stars", "forks", "score"]).default("stars"),
  period: PeriodSchema.default("daily"),
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

export async function trendsRoutes(server: FastifyInstance): Promise<void> {
  server.get("/trends/languages", async (req, reply) => {
    const parsed = LanguageTrendsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError(parsed.error.flatten());

    const { period } = parsed.data;
    const cacheKey = languageTrendsCacheKey(period);

    const cached = await server.cacheGetJson<{ data: unknown[]; period: string; generatedAt: string }>(cacheKey);
    if (cached) {
      reply.header("X-Cache", "HIT");
      reply.header("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600");
      return cached;
    }

    const days = period === "daily" ? 1 : period === "weekly" ? 7 : 30;

    const latestSnapshotDate = await getLatestSnapshotDate(server);
    if (!latestSnapshotDate) {
      return { data: [], period, generatedAt: new Date().toISOString() };
    }

    const prevDate = new Date(latestSnapshotDate);
    prevDate.setUTCDate(prevDate.getUTCDate() - days);

    const rows = await server.prisma.$queryRaw<LangRow[]>(Prisma.sql`
      WITH latest_lang AS (
        SELECT
          r.language AS language,
          COUNT(*)::int AS repos,
          COALESCE(SUM(rs.stars), 0)::bigint AS stars
        FROM repository_snapshots rs
        JOIN repositories r ON r.id = rs.repository_id
        WHERE rs.snapshot_date = ${latestSnapshotDate}::date
          AND r.language IS NOT NULL
        GROUP BY r.language
      ),
      prev_lang AS (
        SELECT
          r.language AS language,
          COALESCE(SUM(rs.stars), 0)::bigint AS stars_prev
        FROM repository_snapshots rs
        JOIN repositories r ON r.id = rs.repository_id
        WHERE rs.snapshot_date = ${prevDate}::date
          AND r.language IS NOT NULL
        GROUP BY r.language
      )
      SELECT
        l.language,
        l.repos,
        l.stars,
        COALESCE(p.stars_prev, 0)::bigint AS stars_prev
      FROM latest_lang l
      LEFT JOIN prev_lang p ON p.language = l.language
      ORDER BY l.stars DESC
      LIMIT 50;
    `);

    const data = rows.map((r) => {
      const stars = Number(r.stars);
      const prev = Number(r.stars_prev);
      const growth = prev > 0 ? ((stars - prev) / prev) * 100 : stars > 0 ? 100 : 0;
      const trend = growth > 1 ? "up" : growth < -1 ? "down" : "flat";
      return {
        language: r.language,
        repos: r.repos,
        stars,
        growth: Math.round(growth * 10) / 10,
        trend
      };
    });

    const result = { data, period, generatedAt: latestSnapshotDate.toISOString() };
    await server.cacheSetJson(cacheKey, result, 3600);
    reply.header("X-Cache", "MISS");
    reply.header("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600");
    return result;
  });

  server.get("/trends/topics", async (req, reply) => {
    const parsed = TopicTrendsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError(parsed.error.flatten());

    const { period } = parsed.data;
    const cacheKey = topicTrendsCacheKey(period);

    const cached = await server.cacheGetJson<{ data: unknown[]; period: string }>(cacheKey);
    if (cached) {
      reply.header("X-Cache", "HIT");
      reply.header("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600");
      return cached;
    }

    const days = period === "daily" ? 1 : period === "weekly" ? 7 : 30;

    const latestSnapshotDate = await getLatestSnapshotDate(server);
    if (!latestSnapshotDate) return { data: [], period };

    const prevDate = new Date(latestSnapshotDate);
    prevDate.setUTCDate(prevDate.getUTCDate() - days);

    const rows = await server.prisma.$queryRaw<TopicRow[]>(Prisma.sql`
      WITH latest_topics AS (
        SELECT
          lower(t) AS topic,
          COUNT(*)::int AS repos
        FROM repository_snapshots rs
        JOIN repositories r ON r.id = rs.repository_id
        CROSS JOIN LATERAL unnest(r.topics) AS t
        WHERE rs.snapshot_date = ${latestSnapshotDate}::date
        GROUP BY lower(t)
      ),
      prev_topics AS (
        SELECT
          lower(t) AS topic,
          COUNT(*)::int AS repos_prev
        FROM repository_snapshots rs
        JOIN repositories r ON r.id = rs.repository_id
        CROSS JOIN LATERAL unnest(r.topics) AS t
        WHERE rs.snapshot_date = ${prevDate}::date
        GROUP BY lower(t)
      )
      SELECT
        l.topic,
        l.repos,
        COALESCE(p.repos_prev, 0)::int AS repos_prev
      FROM latest_topics l
      LEFT JOIN prev_topics p ON p.topic = l.topic
      ORDER BY l.repos DESC
      LIMIT 50;
    `);

    const topTopics = rows.slice(0, 20);

    // Related topics: naive co-occurrence on top topics
    const relatedMap = await buildRelatedTopics(server, topTopics.map((t) => t.topic));

    const data = topTopics.map((r) => {
      const prev = r.repos_prev;
      const growth = prev > 0 ? ((r.repos - prev) / prev) * 100 : r.repos > 0 ? 100 : 0;
      return {
        topic: r.topic,
        repos: r.repos,
        growth: Math.round(growth * 10) / 10,
        relatedTopics: relatedMap[r.topic] ?? []
      };
    });

    const result = { data, period };
    await server.cacheSetJson(cacheKey, result, 3600);
    reply.header("X-Cache", "MISS");
    reply.header("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600");
    return result;
  });

  server.get("/trends/growth", async (req, reply) => {
    const parsed = GrowthQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError(parsed.error.flatten());

    const { metric, period, limit } = parsed.data;
    const cacheKey = growthTrendsCacheKey({ metric, period, limit });

    const cached = await server.cacheGetJson<{ data: unknown[]; metric: string; period: string }>(cacheKey);
    if (cached) {
      reply.header("X-Cache", "HIT");
      reply.header("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600");
      return cached;
    }

    const days = period === "daily" ? 1 : period === "weekly" ? 7 : 30;

    const latestSnapshotDate = await getLatestSnapshotDate(server);
    if (!latestSnapshotDate) return { data: [], metric, period };

    const prevDate = new Date(latestSnapshotDate);
    prevDate.setUTCDate(prevDate.getUTCDate() - days);

    const metricExpr =
      metric === "stars"
        ? Prisma.sql`c.stars`
        : metric === "forks"
          ? Prisma.sql`c.forks`
          : Prisma.sql`c.score`;
    const prevExpr =
      metric === "stars"
        ? Prisma.sql`p.stars_prev`
        : metric === "forks"
          ? Prisma.sql`p.forks_prev`
          : Prisma.sql`p.score_prev`;

    const rows = await server.prisma.$queryRaw<GrowthRow[]>(Prisma.sql`
      WITH current_snapshots AS (
        SELECT repository_id, stars, forks, score
        FROM repository_snapshots
        WHERE snapshot_date = ${latestSnapshotDate}::date
      ),
      prev_snapshots AS (
        SELECT repository_id, stars AS stars_prev, forks AS forks_prev, score AS score_prev
        FROM repository_snapshots
        WHERE snapshot_date = ${prevDate}::date
      )
      SELECT
        r.id AS repository_id,
        r.full_name,
        r.language,
        (${metricExpr} - ${prevExpr})::double precision AS growth,
        ${metricExpr}::double precision AS current_value,
        ${prevExpr}::double precision AS previous_value
      FROM current_snapshots c
      JOIN prev_snapshots p ON p.repository_id = c.repository_id
      JOIN repositories r ON r.id = c.repository_id
      ORDER BY growth DESC
      LIMIT ${limit};
    `);

    if (!rows.length) throw new NotFoundError("Growth data");

    const data = rows.map((r, idx) => {
      const previous = r.previous_value;
      const current = r.current_value;
      const growth = r.growth;
      const growthPercent = previous !== 0 ? (growth / previous) * 100 : current !== 0 ? 100 : 0;
      return {
        rank: idx + 1,
        repository: {
          id: r.repository_id,
          fullName: r.full_name,
          language: r.language
        },
        growth: Math.round(growth),
        growthPercent: Math.round(growthPercent * 10) / 10,
        previousValue: Math.round(previous),
        currentValue: Math.round(current)
      };
    });

    const result = { data, metric, period };
    await server.cacheSetJson(cacheKey, result, 3600);
    reply.header("X-Cache", "MISS");
    reply.header("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600");
    return result;
  });
}

async function getLatestSnapshotDate(server: FastifyInstance): Promise<Date | null> {
  const latest = await server.prisma.repositorySnapshot.aggregate({ _max: { snapshotDate: true } });
  return latest._max.snapshotDate ?? null;
}

type LangRow = {
  language: string;
  repos: number;
  stars: bigint;
  stars_prev: bigint;
};

type TopicRow = {
  topic: string;
  repos: number;
  repos_prev: number;
};

type GrowthRow = {
  repository_id: number;
  full_name: string;
  language: string | null;
  growth: number;
  current_value: number;
  previous_value: number;
};

async function buildRelatedTopics(
  server: FastifyInstance,
  topics: string[]
): Promise<Record<string, string[]>> {
  if (topics.length === 0) return {};

  const repos = await server.prisma.repository.findMany({
    where: { topics: { hasSome: topics } },
    select: { topics: true },
    take: 500
  });

  const relatedCounts: Record<string, Record<string, number>> = {};
  for (const t of topics) relatedCounts[t] = {};

  for (const repo of repos) {
    const lower = repo.topics.map((x) => x.toLowerCase());
    for (const t of topics) {
      if (!lower.includes(t)) continue;
      for (const other of lower) {
        if (other === t) continue;
        relatedCounts[t]![other] = (relatedCounts[t]![other] ?? 0) + 1;
      }
    }
  }

  const result: Record<string, string[]> = {};
  for (const t of topics) {
    const pairs = Object.entries(relatedCounts[t] ?? {}).sort((a, b) => b[1] - a[1]);
    result[t] = pairs.slice(0, 5).map(([name]) => name);
  }
  return result;
}
