import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { decodeCursor, encodeCursor } from "@gitdiscover/shared";
import { InvalidCursorError, NotFoundError, ValidationError } from "../../utils/errors";
import { developerListCacheKey } from "../../utils/cacheKeys";

const DevelopersQuerySchema = z.object({
  sort: z.enum(["impact", "followers", "stars"]).default("impact"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().optional()
});

const DeveloperParamsSchema = z.object({
  login: z.string().min(1)
});

export async function developersRoutes(server: FastifyInstance): Promise<void> {
  server.get("/developers", async (req, reply) => {
    const parsed = DevelopersQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError(parsed.error.flatten());

    const { sort, limit, cursor } = parsed.data;

    const canUseCache = cursor === undefined;
    const cacheKey = canUseCache ? developerListCacheKey({ sort, limit }) : null;
    if (cacheKey) {
      const cached = await server.cacheGetJson<{ data: unknown[]; cursor: string | null; hasMore: boolean }>(cacheKey);
      if (cached) {
        reply.header("X-Cache", "HIT");
        reply.header("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=300");
        return cached;
      }
    }

    const cursorPayload = cursor ? safeDecodeCursor(cursor) : null;

    const sortField: "followers" | "totalStars" | "impactScore" =
      sort === "followers" ? "followers" : sort === "stars" ? "totalStars" : "impactScore";

    const effectiveCursor =
      cursorPayload && cursorPayload.v === undefined
        ? {
            ...cursorPayload,
            v: await getDeveloperMetric(server, cursorPayload.id, sortField)
          }
        : cursorPayload;

    const whereCursor =
      effectiveCursor && typeof effectiveCursor.v === "number"
        ? {
            OR: [
              { [sortField]: { lt: effectiveCursor.v } },
              { [sortField]: effectiveCursor.v, id: { lt: effectiveCursor.id } }
            ]
          }
        : {};

    const devs = await server.prisma.developer.findMany({
      where: whereCursor,
      orderBy: [{ [sortField]: "desc" }, { id: "desc" }],
      take: limit + 1
    });

    const hasMore = devs.length > limit;
    const page = hasMore ? devs.slice(0, limit) : devs;

    // Use include to fetch repositories in a single query (avoid N+1)
    const devsWithRepos = await server.prisma.developer.findMany({
      where: { id: { in: page.map((d) => d.id) } },
      select: {
        id: true,
        repositories: {
          select: { fullName: true, stars: true },
          orderBy: { stars: "desc" },
          take: 3
        }
      }
    });

    const topReposByDev = devsWithRepos.reduce<Record<number, { fullName: string; stars: number }[]>>((acc, d) => {
      acc[d.id] = d.repositories.map((r) => ({ fullName: r.fullName, stars: r.stars }));
      return acc;
    }, {});

    const data = page.map((d) => ({
      id: d.id,
      githubId: Number(d.githubId),
      login: d.login,
      name: d.name,
      avatarUrl: d.avatarUrl,
      bio: d.bio,
      followers: d.followers,
      publicRepos: d.publicRepos,
      totalStars: d.totalStars,
      impactScore: d.impactScore,
      topRepos: topReposByDev[d.id] ?? []
    }));

    const last = page[page.length - 1];
    const lastMetric = last ? last[sortField] : undefined;
    const nextCursor = hasMore && last ? encodeCursor({ id: last.id, v: typeof lastMetric === "number" ? lastMetric : 0 }) : null;

    const result = { data, cursor: nextCursor, hasMore };
    if (cacheKey) {
      await server.cacheSetJson(cacheKey, result, 300);
      reply.header("X-Cache", "MISS");
      reply.header("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=300");
    }
    return result;
  });

  server.get("/developers/:login", async (req) => {
    const params = DeveloperParamsSchema.safeParse(req.params);
    if (!params.success) throw new ValidationError(params.error.flatten());

    const dev = await server.prisma.developer.findUnique({
      where: { login: params.data.login }
    });
    if (!dev) throw new NotFoundError("Developer");

    const [repos, history] = await Promise.all([
      server.prisma.repository.findMany({
        where: { ownerId: dev.id },
        select: { id: true, fullName: true, stars: true, language: true },
        orderBy: [{ stars: "desc" }],
        take: 100
      }),
      server.prisma.developerSnapshot.findMany({
        where: { developerId: dev.id },
        select: { snapshotDate: true, followers: true, totalStars: true },
        orderBy: { snapshotDate: "desc" },
        take: 30
      })
    ]);
    history.reverse();

    return {
      data: {
        id: dev.id,
        githubId: Number(dev.githubId),
        login: dev.login,
        name: dev.name,
        avatarUrl: dev.avatarUrl,
        bio: dev.bio,
        company: dev.company,
        location: dev.location,
        blog: dev.blog,
        twitterUsername: dev.twitterUsername,
        followers: dev.followers,
        following: dev.following,
        publicRepos: dev.publicRepos,
        totalStars: dev.totalStars,
        impactScore: dev.impactScore,
        contributions: dev.contributions,
        repositories: repos,
        history: history.map((h) => ({
          date: h.snapshotDate.toISOString().slice(0, 10),
          followers: h.followers,
          totalStars: h.totalStars
        })),
        devCreatedAt: dev.devCreatedAt?.toISOString() ?? null
      }
    };
  });
}

async function getDeveloperMetric(
  server: FastifyInstance,
  developerId: number,
  field: "impactScore" | "followers" | "totalStars"
): Promise<number> {
  const dev = await server.prisma.developer.findUnique({ where: { id: developerId }, select: { [field]: true } });
  const v = dev?.[field];
  if (typeof v !== "number") throw new InvalidCursorError();
  return v;
}

function safeDecodeCursor(raw: string): { id: number; v?: number | undefined } {
  try {
    return decodeCursor(raw);
  } catch {
    throw new InvalidCursorError();
  }
}
