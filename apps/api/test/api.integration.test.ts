import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server";

function utcDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

type RepoDetailResponse = { data: { fullName: string } };
type BookmarkListResponse = { data: Array<{ repository: { id: number } }> };
type CreateCommentResponse = { data: { id: number } };
type VoteResponse = { data: { totalScore: number } };

describe("api (integration)", () => {
  let server: FastifyInstance;
  let repoId: number;
  let repoFullName: string;
  let devLogin: string;
  let authCookie: string;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL ??= "postgresql://gitdiscover:gitdiscover@localhost:55433/gitdiscover";
    process.env.REDIS_URL ??= "redis://localhost:6380";
    process.env.JWT_SECRET ??= "test-jwt-secret-that-is-at-least-32-characters-long";
    process.env.COOKIE_SECRET ??= "test-cookie-secret-that-is-at-least-32-characters";
    process.env.APP_URL ??= "http://localhost:3002";
    process.env.API_BASE_URL ??= "http://localhost:3001";

    server = await buildServer();
    await server.ready();

    // Avoid cross-run cache interference.
    await server.redis.flushdb();

    const now = new Date();
    const snapshotDate = utcDate(now);

    devLogin = `test-owner-${Date.now()}`;
    const dev = await server.prisma.developer.create({
      data: {
        githubId: BigInt(Date.now()),
        login: devLogin,
        name: "Test Owner",
        avatarUrl: null,
        bio: "Integration test developer",
        followers: 123,
        following: 0,
        publicRepos: 1,
        publicGists: 0,
        impactScore: 3.21,
        activeRepos: 1,
        totalStars: 0,
        contributions: 42,
        devCreatedAt: now,
      },
    });

    repoFullName = `${devLogin}/test-repo-${Date.now()}`;
    const repo = await server.prisma.repository.create({
      data: {
        githubId: BigInt(Date.now() + 1),
        fullName: repoFullName,
        name: "test-repo",
        description: "Integration test repository",
        language: "TypeScript",
        stars: 100,
        forks: 10,
        watchers: 5,
        openIssues: 1,
        size: 1,
        score: 50,
        starsGrowth24h: 10,
        forksGrowth24h: 2,
        homepage: null,
        topics: ["test", "vitest"],
        license: "MIT",
        hasReadme: true,
        hasLicense: true,
        isArchived: false,
        isFork: false,
        ownerId: dev.id,
        pushedAt: now,
        repoCreatedAt: now,
      },
    });
    repoId = repo.id;

    await server.prisma.repositorySnapshot.create({
      data: {
        repositoryId: repo.id,
        snapshotDate,
        stars: 100,
        forks: 10,
        watchers: 5,
        openIssues: 1,
        starsGrowth: 10,
        forksGrowth: 2,
        score: 50,
        rank: 1,
      },
    });

    await server.prisma.developerSnapshot.create({
      data: {
        developerId: dev.id,
        snapshotDate,
        followers: 123,
        publicRepos: 1,
        totalStars: 100,
        impactScore: 3.21,
        rank: 1,
      },
    });

    const authRes = await server.inject({
      method: "POST",
      url: "/auth/dev",
      payload: { login: `tester-${Date.now()}` },
    });
    expect(authRes.statusCode).toBe(200);
    const setCookie = authRes.headers["set-cookie"];
    const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (!first) throw new Error("missing auth cookie");
    authCookie = first.split(";")[0]!;
  });

  afterAll(async () => {
    try {
      await server.prisma.vote.deleteMany({ where: { repositoryId: repoId } });
      await server.prisma.bookmark.deleteMany({ where: { repositoryId: repoId } });
      await server.prisma.comment.deleteMany({ where: { repositoryId: repoId } });
      await server.prisma.aiAnalysis.deleteMany({ where: { repositoryId: repoId } });
      await server.prisma.repositorySnapshot.deleteMany({ where: { repositoryId: repoId } });
      await server.prisma.repository.deleteMany({ where: { id: repoId } });
      await server.prisma.developer.deleteMany({ where: { login: devLogin } });
    } finally {
      await server.close();
    }
  });

  it("lists repositories with rate-limit headers and cache", async () => {
    const res1 = await server.inject({ method: "GET", url: "/v1/repositories?limit=10&sort=score&period=daily" });
    expect(res1.statusCode).toBe(200);
    expect(res1.headers["x-ratelimit-limit"]).toBeDefined();
    expect(res1.headers["x-cache"]).toBe("MISS");

    const body1 = res1.json() as { data: Array<{ fullName: string }> };
    expect(body1.data.some((r) => r.fullName === repoFullName)).toBe(true);

    const res2 = await server.inject({ method: "GET", url: "/v1/repositories?limit=10&sort=score&period=daily" });
    expect(res2.statusCode).toBe(200);
    expect(res2.headers["x-cache"]).toBe("HIT");
  });

  it("gets repository detail and supports community actions", async () => {
    const encoded = encodeURIComponent(repoFullName);

    const detail = await server.inject({ method: "GET", url: `/v1/repositories/${encoded}` });
    expect(detail.statusCode).toBe(200);
    expect((detail.json() as RepoDetailResponse).data.fullName).toBe(repoFullName);

    const bookmark = await server.inject({
      method: "POST",
      url: "/v1/bookmarks",
      headers: { cookie: authCookie },
      payload: { repositoryId: repoId, note: "saved", tags: ["test"] },
    });
    expect(bookmark.statusCode).toBe(200);

    const listBookmarks = await server.inject({
      method: "GET",
      url: "/v1/bookmarks",
      headers: { cookie: authCookie },
    });
    expect(listBookmarks.statusCode).toBe(200);
    expect((listBookmarks.json() as BookmarkListResponse).data.some((b) => b.repository.id === repoId)).toBe(true);

    const comment = await server.inject({
      method: "POST",
      url: `/v1/repositories/${encoded}/comments`,
      headers: { cookie: authCookie },
      payload: { content: "Nice project!" },
    });
    expect(comment.statusCode).toBe(200);
    const commentId = (comment.json() as CreateCommentResponse).data.id;
    expect(typeof commentId).toBe("number");

    const edit = await server.inject({
      method: "PUT",
      url: `/v1/comments/${commentId}`,
      headers: { cookie: authCookie },
      payload: { content: "Updated comment" },
    });
    expect(edit.statusCode).toBe(200);

    const vote = await server.inject({
      method: "POST",
      url: `/v1/repositories/${encoded}/vote`,
      headers: { cookie: authCookie },
      payload: { value: 1 },
    });
    expect(vote.statusCode).toBe(200);
    expect((vote.json() as VoteResponse).data.totalScore).toBe(1);
  });
});
