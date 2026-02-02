import type { PrismaClient } from "@prisma/client";
import type { Octokit } from "@octokit/rest";
import { calculateHotnessScore } from "@gitdiscover/shared";
import pLimit from "p-limit";
import type { TrendingRepo } from "../sources/github-trending";
import { getRepo } from "../sources/github";

export async function upsertRepositories(params: {
  prisma: PrismaClient;
  octokit: Octokit;
  snapshotDate: Date;
  trending: TrendingRepo[];
}): Promise<{ repositoryIds: number[] }> {
  const now = new Date();
  const limit = pLimit(5);

  const results = await Promise.all(
    params.trending.map((item, idx) =>
      limit(async () => {
        const existingRepo = await params.prisma.repository.findUnique({
          where: { fullName: item.fullName },
          select: { id: true }
        });

        const gh = await getRepo(params.octokit, item.fullName);
        const ownerLogin = gh.owner?.login ?? null;

        // Upsert developer (minimal) first so repo can reference ownerId.
        const owner =
          ownerLogin && gh.owner?.id
            ? await params.prisma.developer.upsert({
                where: { login: ownerLogin },
                update: {
                  githubId: BigInt(gh.owner.id),
                  avatarUrl: gh.owner.avatar_url ?? null
                },
                create: {
                  githubId: BigInt(gh.owner.id),
                  login: ownerLogin,
                  avatarUrl: gh.owner.avatar_url ?? null
                }
              })
            : null;

        const previousDate = new Date(params.snapshotDate);
        previousDate.setUTCDate(previousDate.getUTCDate() - 1);

        const previous =
          existingRepo?.id
            ? await params.prisma.repositorySnapshot.findUnique({
                where: {
                  repositoryId_snapshotDate: {
                    repositoryId: existingRepo.id,
                    snapshotDate: previousDate
                  }
                },
                select: { stars: true, forks: true }
              })
            : null;

        const stars = gh.stargazers_count ?? 0;
        const forks = gh.forks_count ?? 0;
        const watchers = gh.watchers_count ?? 0;
        const openIssues = gh.open_issues_count ?? 0;

        const starsGrowth24h = item.starsToday ?? (previous ? Math.max(0, stars - previous.stars) : 0);
        const forksGrowth24h = previous ? Math.max(0, forks - previous.forks) : 0;

        const pushedAt = gh.pushed_at ? new Date(gh.pushed_at) : null;
        const lastCommitDays = pushedAt
          ? Math.floor((now.getTime() - pushedAt.getTime()) / (24 * 60 * 60 * 1000))
          : 9999;
        const openIssueRatio = openIssues + stars > 0 ? openIssues / (openIssues + stars) : 0;

        const score = calculateHotnessScore({
          starsGrowth24h,
          forksGrowth24h,
          hasReadme: true,
          hasLicense: Boolean(gh.license),
          lastCommitDays,
          openIssueRatio
        });

        const repo = await params.prisma.repository.upsert({
          where: { fullName: item.fullName },
          update: {
            githubId: BigInt(gh.id),
            name: gh.name,
            description: gh.description ?? null,
            language: gh.language ?? item.language,
            stars,
            forks,
            watchers,
            openIssues,
            size: gh.size ?? 0,
            score,
            starsGrowth24h,
            forksGrowth24h,
            homepage: gh.homepage ?? null,
            topics: (gh.topics ?? []) as string[],
            license: gh.license?.spdx_id ?? gh.license?.name ?? null,
            hasReadme: true,
            hasLicense: Boolean(gh.license),
            isArchived: Boolean(gh.archived),
            isFork: Boolean(gh.fork),
            ownerId: owner?.id ?? null,
            pushedAt: pushedAt ?? null,
            repoCreatedAt: gh.created_at ? new Date(gh.created_at) : null
          },
          create: {
            githubId: BigInt(gh.id),
            fullName: item.fullName,
            name: gh.name,
            description: gh.description ?? null,
            language: gh.language ?? item.language,
            stars,
            forks,
            watchers,
            openIssues,
            size: gh.size ?? 0,
            score,
            starsGrowth24h,
            forksGrowth24h,
            homepage: gh.homepage ?? null,
            topics: (gh.topics ?? []) as string[],
            license: gh.license?.spdx_id ?? gh.license?.name ?? null,
            hasReadme: true,
            hasLicense: Boolean(gh.license),
            isArchived: Boolean(gh.archived),
            isFork: Boolean(gh.fork),
            ownerId: owner?.id ?? null,
            pushedAt: pushedAt ?? null,
            repoCreatedAt: gh.created_at ? new Date(gh.created_at) : null
          }
        });

        await params.prisma.repositorySnapshot.upsert({
          where: { repositoryId_snapshotDate: { repositoryId: repo.id, snapshotDate: params.snapshotDate } },
          update: {
            stars,
            forks,
            watchers,
            openIssues,
            starsGrowth: starsGrowth24h,
            forksGrowth: forksGrowth24h,
            score,
            rank: idx + 1
          },
          create: {
            repositoryId: repo.id,
            snapshotDate: params.snapshotDate,
            stars,
            forks,
            watchers,
            openIssues,
            starsGrowth: starsGrowth24h,
            forksGrowth: forksGrowth24h,
            score,
            rank: idx + 1
          }
        });

        return repo.id;
      })
    )
  );

  return { repositoryIds: results };
}
