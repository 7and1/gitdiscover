import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { decodeCursor, encodeCursor } from "@gitdiscover/shared";
import { InvalidCursorError, NotFoundError, ValidationError } from "../../utils/errors";
import { repoAnalysisCacheKey, repoDetailCacheKey, repoListCacheKey } from "../../utils/cacheKeys";

function sanitizeHtml(input: string): string {
  // Strip HTML tags to prevent XSS
  return input.replace(/<[^>]*>/g, "").trim();
}

const RepositoriesQuerySchema = z.object({
  language: z.string().min(1).optional(),
  sort: z.enum(["score", "stars", "forks", "growth"]).default("score"),
  period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional()
});

const RepoSearchQuerySchema = z.object({
  q: z.string().min(1),
  language: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const RepoParamsSchema = z.object({
  fullName: z.string().min(1)
});

const RepoCommentsQuerySchema = z.object({
  sort: z.enum(["newest", "oldest", "popular"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional()
});

const CreateCommentBodySchema = z.object({
  content: z.string().min(1).max(5000),
  parentId: z.number().int().positive().nullable().optional()
});

const VoteBodySchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)])
});

export async function repositoriesRoutes(server: FastifyInstance): Promise<void> {
  server.get("/repositories", async (req, reply) => {
    const parsed = RepositoriesQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError(parsed.error.flatten());

    const { language, sort, period, limit, cursor } = parsed.data;

    const canUseCache = cursor === undefined;
    const cacheKey = canUseCache ? repoListCacheKey({ language, sort, period, limit }) : null;
    if (cacheKey) {
      const cached = await server.cacheGetJson<{ data: unknown[]; cursor: string | null; hasMore: boolean }>(cacheKey);
      if (cached) {
        reply.header("X-Cache", "HIT");
        reply.header("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=300");
        return cached;
      }
    }

    const cursorPayload = cursor ? safeDecodeCursor(cursor) : null;

    const latestSnapshotDate = await getLatestSnapshotDate(server);
    if (!latestSnapshotDate) return { data: [], cursor: null, hasMore: false };

    const periodDays = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
    const fromDate = new Date(latestSnapshotDate);
    fromDate.setUTCDate(fromDate.getUTCDate() - (periodDays - 1));

    const metricExpr = getRepoMetricExpr(sort, periodDays);

    const effectiveCursor =
      cursorPayload && cursorPayload.v === undefined
        ? {
            ...cursorPayload,
            v: await getRepoMetricValue(server, metricExpr, cursorPayload.id, fromDate, latestSnapshotDate)
          }
        : cursorPayload;

    const seekClause = effectiveCursor
      ? Prisma.sql`AND (${metricExpr} < ${effectiveCursor.v} OR (${metricExpr} = ${effectiveCursor.v} AND r.id < ${effectiveCursor.id}))`
      : Prisma.empty;

    const languageClause = language ? Prisma.sql`AND r.language = ${language}` : Prisma.empty;

    const rows = await server.prisma.$queryRaw<RepoListRow[]>(Prisma.sql`
      WITH latest_snapshots AS (
        SELECT rs.*
        FROM repository_snapshots rs
        WHERE rs.snapshot_date = ${latestSnapshotDate}::date
      ),
      period_growth AS (
        SELECT rs.repository_id, COALESCE(SUM(rs.stars_growth), 0)::int AS stars_growth_period
        FROM repository_snapshots rs
        WHERE rs.snapshot_date BETWEEN ${fromDate}::date AND ${latestSnapshotDate}::date
        GROUP BY rs.repository_id
      )
      SELECT
        r.id,
        r.github_id,
        r.full_name,
        r.name,
        r.description,
        r.language,
        r.topics,
        r.pushed_at,
        ls.stars,
        ls.forks,
        ls.stars_growth AS stars_growth_24h,
        ls.forks_growth AS forks_growth_24h,
        ls.score,
        d.login AS owner_login,
        d.avatar_url AS owner_avatar_url,
        ${metricExpr} AS metric
      FROM latest_snapshots ls
      JOIN repositories r ON r.id = ls.repository_id
      LEFT JOIN developers d ON d.id = r.owner_id
      LEFT JOIN period_growth pg ON pg.repository_id = r.id
      WHERE 1=1
        ${languageClause}
        ${seekClause}
      ORDER BY metric DESC, r.id DESC
      LIMIT ${limit + 1};
    `);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const data = page.map((row) => ({
      id: row.id,
      githubId: Number(row.github_id),
      fullName: row.full_name,
      name: row.name,
      description: row.description,
      language: row.language,
      stars: row.stars,
      forks: row.forks,
      starsGrowth24h: row.stars_growth_24h,
      forksGrowth24h: row.forks_growth_24h,
      score: row.score,
      topics: row.topics,
      owner: row.owner_login
        ? { login: row.owner_login, avatarUrl: row.owner_avatar_url }
        : { login: "", avatarUrl: null },
      pushedAt: row.pushed_at ? row.pushed_at.toISOString() : null
    }));

    const nextCursor = hasMore ? encodeCursor({ id: page[page.length - 1]!.id, v: page[page.length - 1]!.metric }) : null;

    const result = { data, cursor: nextCursor, hasMore };
    if (cacheKey) {
      await server.cacheSetJson(cacheKey, result, 300);
      reply.header("X-Cache", "MISS");
      reply.header("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=300");
    }
    return result;
  });

  server.get("/repositories/search", async (req) => {
    const parsed = RepoSearchQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError(parsed.error.flatten());

    const { q, language, limit } = parsed.data;
    const query = q.trim();

    const whereLanguage = language ? Prisma.sql`AND language = ${language}` : Prisma.empty;

    const data = await server.prisma.$queryRaw<RepoSearchRow[]>(Prisma.sql`
      SELECT
        id,
        full_name,
        name,
        description,
        language,
        stars,
        score,
        ts_rank(
          to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')),
          plainto_tsquery('english', ${query})
        ) AS rank
      FROM repositories
      WHERE
        to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
        @@ plainto_tsquery('english', ${query})
        ${whereLanguage}
      ORDER BY rank DESC, score DESC
      LIMIT ${limit};
    `);

    const totalRows = await server.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM repositories
      WHERE
        to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
        @@ plainto_tsquery('english', ${query})
        ${whereLanguage};
    `);

    const total = Number(totalRows[0]?.count ?? 0n);

    return {
      data: data.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stars,
        score: r.score,
        relevance: r.rank
      })),
      total,
      query
    };
  });

  server.get("/repositories/:fullName", async (req, reply) => {
    const params = RepoParamsSchema.safeParse(req.params);
    if (!params.success) throw new ValidationError(params.error.flatten());

    const fullName = decodeURIComponent(params.data.fullName);
    const detailKey = repoDetailCacheKey(fullName);

    const cached = await server.cacheGetJson<{ data: unknown }>(detailKey);
    if (cached) {
      reply.header("X-Cache", "HIT");
      reply.header("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=300");
      return cached;
    }

    const repo = await server.prisma.repository.findUnique({
      where: { fullName },
      include: { owner: true }
    });
    if (!repo) throw new NotFoundError("Repository");

    const latestSnapshot = await server.prisma.repositorySnapshot.findFirst({
      where: { repositoryId: repo.id },
      orderBy: { snapshotDate: "desc" }
    });

    const [analysis, bookmarkCount, commentCount, voteAgg] = await Promise.all([
      server.prisma.aiAnalysis.findFirst({
        where: { repositoryId: repo.id },
        orderBy: { analysisDate: "desc" }
      }),
      server.prisma.bookmark.count({ where: { repositoryId: repo.id } }),
      server.prisma.comment.count({ where: { repositoryId: repo.id, isDeleted: false } }),
      server.prisma.vote.aggregate({ where: { repositoryId: repo.id }, _sum: { value: true } })
    ]);

    const history = await server.prisma.repositorySnapshot.findMany({
      where: { repositoryId: repo.id },
      orderBy: { snapshotDate: "desc" },
      take: 30,
      select: { snapshotDate: true, stars: true, forks: true }
    });
    history.reverse();

    const result = {
      data: {
        id: repo.id,
        githubId: Number(repo.githubId),
        fullName: repo.fullName,
        name: repo.name,
        description: repo.description,
        language: repo.language,
        stars: latestSnapshot?.stars ?? repo.stars,
        forks: latestSnapshot?.forks ?? repo.forks,
        watchers: latestSnapshot?.watchers ?? repo.watchers,
        openIssues: latestSnapshot?.openIssues ?? repo.openIssues,
        starsGrowth24h: latestSnapshot?.starsGrowth ?? repo.starsGrowth24h,
        forksGrowth24h: latestSnapshot?.forksGrowth ?? repo.forksGrowth24h,
        score: latestSnapshot?.score ?? repo.score,
        topics: repo.topics,
        license: repo.license,
        homepage: repo.homepage,
        hasReadme: repo.hasReadme,
        hasLicense: repo.hasLicense,
        isArchived: repo.isArchived,
        isFork: repo.isFork,
        owner: repo.owner
          ? { id: repo.owner.id, login: repo.owner.login, name: repo.owner.name, avatarUrl: repo.owner.avatarUrl }
          : null,
        analysis: analysis
          ? {
              summary: analysis.summary,
              highlights: analysis.highlights,
              useCases: analysis.useCases,
              analysisDate: analysis.analysisDate.toISOString().slice(0, 10)
            }
          : null,
        stats: {
          bookmarks: bookmarkCount,
          comments: commentCount,
          voteScore: voteAgg._sum.value ?? 0
        },
        history: history.map((h) => ({
          date: h.snapshotDate.toISOString().slice(0, 10),
          stars: h.stars,
          forks: h.forks
        })),
        pushedAt: repo.pushedAt?.toISOString() ?? null,
        repoCreatedAt: repo.repoCreatedAt?.toISOString() ?? null
      }
    };

    await server.cacheSetJson(detailKey, result, 300);
    reply.header("X-Cache", "MISS");
    reply.header("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=300");
    return result;
  });

  server.get("/repositories/:fullName/comments", async (req) => {
    const params = RepoParamsSchema.safeParse(req.params);
    if (!params.success) throw new ValidationError(params.error.flatten());
    const q = RepoCommentsQuerySchema.safeParse(req.query);
    if (!q.success) throw new ValidationError(q.error.flatten());

    const fullName = decodeURIComponent(params.data.fullName);
    const repo = await server.prisma.repository.findUnique({ where: { fullName }, select: { id: true } });
    if (!repo) throw new NotFoundError("Repository");

    const cursorPayload = q.data.cursor ? safeDecodeCursor(q.data.cursor) : null;
    const effectiveCursor =
      cursorPayload && cursorPayload.v === undefined
        ? {
            ...cursorPayload,
            v: await getCommentCursorValue(server, cursorPayload.id)
          }
        : cursorPayload;

    const cursorDate = effectiveCursor?.v ? new Date(effectiveCursor.v) : null;

    const orderBy =
      q.data.sort === "oldest"
        ? [{ createdAt: "asc" as const }, { id: "asc" as const }]
        : q.data.sort === "popular"
          ? [{ replies: { _count: "desc" as const } }, { createdAt: "desc" as const }, { id: "desc" as const }]
          : [{ createdAt: "desc" as const }, { id: "desc" as const }];

    const whereCursor =
      effectiveCursor && cursorDate
        ? q.data.sort === "oldest"
          ? {
              OR: [
                { createdAt: { gt: cursorDate } },
                { createdAt: cursorDate, id: { gt: effectiveCursor.id } }
              ]
            }
          : {
              OR: [
                { createdAt: { lt: cursorDate } },
                { createdAt: cursorDate, id: { lt: effectiveCursor.id } }
              ]
            }
        : {};

    const comments = await server.prisma.comment.findMany({
      where: {
        repositoryId: repo.id,
        parentId: null,
        isDeleted: false,
        ...whereCursor
      },
      orderBy,
      take: q.data.limit + 1,
      include: {
        user: { select: { id: true, login: true, avatarUrl: true } },
        replies: {
          where: { isDeleted: false },
          orderBy: { createdAt: "asc" },
          include: { user: { select: { login: true, avatarUrl: true, id: true } } },
          take: 10
        }
      }
    });

    const hasMore = comments.length > q.data.limit;
    const page = hasMore ? comments.slice(0, q.data.limit) : comments;

    const data = page.map((c) => ({
      id: c.id,
      content: c.content,
      user: { id: c.user.id, login: c.user.login, avatarUrl: c.user.avatarUrl },
      replies: c.replies.map((r) => ({
        id: r.id,
        content: r.content,
        user: { login: r.user.login, avatarUrl: r.user.avatarUrl },
        createdAt: r.createdAt.toISOString()
      })),
      createdAt: c.createdAt.toISOString(),
      isEdited: c.isEdited
    }));

    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor({ id: last.id, v: last.createdAt.getTime() }) : null;

    return { data, cursor: nextCursor, hasMore };
  });

  server.post("/repositories/:fullName/comments", async (req) => {
    const params = RepoParamsSchema.safeParse(req.params);
    if (!params.success) throw new ValidationError(params.error.flatten());
    const body = CreateCommentBodySchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.flatten());

    const auth = await server.requireAuthUser(req);
    const fullName = decodeURIComponent(params.data.fullName);
    const repo = await server.prisma.repository.findUnique({ where: { fullName }, select: { id: true } });
    if (!repo) throw new NotFoundError("Repository");

    const parentId = body.data.parentId ?? null;
    if (parentId) {
      const parent = await server.prisma.comment.findUnique({ where: { id: parentId }, select: { repositoryId: true } });
      if (!parent || parent.repositoryId !== repo.id) throw new NotFoundError("Parent comment");
    }

    // Sanitize content to prevent XSS
    const sanitizedContent = sanitizeHtml(body.data.content);

    const created = await server.prisma.comment.create({
      data: {
        repositoryId: repo.id,
        userId: auth.id,
        parentId,
        content: sanitizedContent
      },
      include: { user: { select: { id: true, login: true, avatarUrl: true } } }
    });

    await server.cacheDel(repoDetailCacheKey(fullName));

    return {
      data: {
        id: created.id,
        content: created.content,
        user: created.user,
        createdAt: created.createdAt.toISOString(),
        isEdited: created.isEdited
      }
    };
  });

  server.post("/repositories/:fullName/vote", async (req) => {
    const params = RepoParamsSchema.safeParse(req.params);
    if (!params.success) throw new ValidationError(params.error.flatten());
    const body = VoteBodySchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.flatten());

    const auth = await server.requireAuthUser(req);
    const fullName = decodeURIComponent(params.data.fullName);
    const repo = await server.prisma.repository.findUnique({ where: { fullName }, select: { id: true } });
    if (!repo) throw new NotFoundError("Repository");

    await server.prisma.vote.upsert({
      where: { userId_repositoryId: { userId: auth.id, repositoryId: repo.id } },
      update: { value: body.data.value },
      create: { userId: auth.id, repositoryId: repo.id, value: body.data.value }
    });

    const totalScore = await server.prisma.vote.aggregate({ where: { repositoryId: repo.id }, _sum: { value: true } });

    await server.cacheDel(repoDetailCacheKey(fullName));

    return {
      data: {
        repositoryId: repo.id,
        userVote: body.data.value,
        totalScore: totalScore._sum.value ?? 0
      }
    };
  });

  server.get("/repositories/:fullName/analysis", async (req, reply) => {
    const params = RepoParamsSchema.safeParse(req.params);
    if (!params.success) throw new ValidationError(params.error.flatten());

    const fullName = decodeURIComponent(params.data.fullName);
    const analysisKey = repoAnalysisCacheKey(fullName);

    const cached = await server.cacheGetJson<{ data: unknown }>(analysisKey);
    if (cached) {
      reply.header("X-Cache", "HIT");
      reply.header("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600");
      return cached;
    }

    const repo = await server.prisma.repository.findUnique({ where: { fullName }, select: { id: true, topics: true } });
    if (!repo) throw new NotFoundError("Repository");

    const analysis = await server.prisma.aiAnalysis.findFirst({
      where: { repositoryId: repo.id },
      orderBy: { analysisDate: "desc" }
    });
    if (!analysis) throw new NotFoundError("Analysis");

    const similar = analysis.similarRepos.length
      ? await server.prisma.repository.findMany({
          where: { id: { in: analysis.similarRepos } },
          select: { id: true, fullName: true, topics: true }
        })
      : [];

    const result = {
      data: {
        repositoryId: analysis.repositoryId,
        analysisDate: analysis.analysisDate.toISOString().slice(0, 10),
        summary: analysis.summary,
        highlights: analysis.highlights,
        useCases: analysis.useCases,
        techStack: analysis.techStack,
        codeQuality: analysis.codeQuality,
        similarRepos: similar.map((r) => ({
          id: r.id,
          fullName: r.fullName,
          similarity: jaccard(repo.topics, r.topics)
        })),
        targetAudience: analysis.targetAudience,
        modelVersion: analysis.modelVersion
      }
    };

    await server.cacheSetJson(analysisKey, result, 3600);
    reply.header("X-Cache", "MISS");
    reply.header("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600");
    return result;
  });
}

async function getLatestSnapshotDate(server: FastifyInstance): Promise<Date | null> {
  const latest = await server.prisma.repositorySnapshot.aggregate({ _max: { snapshotDate: true } });
  return latest._max.snapshotDate ?? null;
}

function getRepoMetricExpr(sort: "score" | "stars" | "forks" | "growth", periodDays: number): Prisma.Sql {
  if (sort === "score") return Prisma.sql`ls.score`;
  if (sort === "stars") return Prisma.sql`ls.stars`;
  if (sort === "forks") return Prisma.sql`ls.forks`;
  return periodDays > 1 ? Prisma.sql`COALESCE(pg.stars_growth_period, 0)` : Prisma.sql`ls.stars_growth`;
}

async function getRepoMetricValue(
  server: FastifyInstance,
  metricExpr: Prisma.Sql,
  repositoryId: number,
  fromDate: Date,
  latestSnapshotDate: Date
): Promise<number> {
  const rows = await server.prisma.$queryRaw<{ metric: number }[]>(Prisma.sql`
    WITH latest_snapshots AS (
      SELECT rs.*
      FROM repository_snapshots rs
      WHERE rs.snapshot_date = ${latestSnapshotDate}::date
    ),
    period_growth AS (
      SELECT rs.repository_id, COALESCE(SUM(rs.stars_growth), 0)::int AS stars_growth_period
      FROM repository_snapshots rs
      WHERE rs.snapshot_date BETWEEN ${fromDate}::date AND ${latestSnapshotDate}::date
      GROUP BY rs.repository_id
    )
    SELECT ${metricExpr} AS metric
    FROM latest_snapshots ls
    JOIN repositories r ON r.id = ls.repository_id
    LEFT JOIN period_growth pg ON pg.repository_id = r.id
    WHERE r.id = ${repositoryId}
    LIMIT 1;
  `);
  const v = rows[0]?.metric;
  if (typeof v !== "number") throw new InvalidCursorError();
  return v;
}

async function getCommentCursorValue(server: FastifyInstance, commentId: number): Promise<number> {
  const c = await server.prisma.comment.findUnique({ where: { id: commentId }, select: { createdAt: true } });
  if (!c) throw new InvalidCursorError();
  return c.createdAt.getTime();
}

type RepoListRow = {
  id: number;
  github_id: bigint;
  full_name: string;
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  pushed_at: Date | null;
  stars: number;
  forks: number;
  stars_growth_24h: number;
  forks_growth_24h: number;
  score: number;
  owner_login: string | null;
  owner_avatar_url: string | null;
  metric: number;
};

type RepoSearchRow = {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  score: number;
  rank: number;
};

function safeDecodeCursor(raw: string): { id: number; v?: number | undefined } {
  try {
    return decodeCursor(raw);
  } catch {
    throw new InvalidCursorError();
  }
}

function jaccard(a: string[], b: string[]): number {
  const as = new Set(a.map((t) => t.toLowerCase()));
  const bs = new Set(b.map((t) => t.toLowerCase()));
  const inter = [...as].filter((t) => bs.has(t)).length;
  const union = new Set([...as, ...bs]).size;
  if (union === 0) return 0;
  return Math.round((inter / union) * 100) / 100;
}
