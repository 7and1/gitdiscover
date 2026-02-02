import type { PrismaClient } from "@prisma/client";
import type { Octokit } from "@octokit/rest";
import { calculateImpactScore } from "@gitdiscover/shared";
import { getUser } from "../sources/github";

export async function upsertDevelopers(params: {
  prisma: PrismaClient;
  octokit: Octokit;
  snapshotDate: Date;
  ownerLogins: string[];
}): Promise<void> {
  const unique = [...new Set(params.ownerLogins)].filter(Boolean);

  for (const login of unique) {
    const gh = await getUser(params.octokit, login);

    const dev = await params.prisma.developer.upsert({
      where: { login: gh.login },
      update: {
        githubId: BigInt(gh.id),
        name: gh.name ?? null,
        avatarUrl: gh.avatar_url ?? null,
        bio: gh.bio ?? null,
        company: gh.company ?? null,
        location: gh.location ?? null,
        blog: gh.blog ?? null,
        email: gh.email ?? null,
        twitterUsername: (gh as { twitter_username?: string | null }).twitter_username ?? null,
        followers: gh.followers ?? 0,
        following: gh.following ?? 0,
        publicRepos: gh.public_repos ?? 0,
        publicGists: gh.public_gists ?? 0,
        devCreatedAt: gh.created_at ? new Date(gh.created_at) : null
      },
      create: {
        githubId: BigInt(gh.id),
        login: gh.login,
        name: gh.name ?? null,
        avatarUrl: gh.avatar_url ?? null,
        bio: gh.bio ?? null,
        company: gh.company ?? null,
        location: gh.location ?? null,
        blog: gh.blog ?? null,
        email: gh.email ?? null,
        twitterUsername: (gh as { twitter_username?: string | null }).twitter_username ?? null,
        followers: gh.followers ?? 0,
        following: gh.following ?? 0,
        publicRepos: gh.public_repos ?? 0,
        publicGists: gh.public_gists ?? 0,
        devCreatedAt: gh.created_at ? new Date(gh.created_at) : null
      }
    });

    const totals = await params.prisma.repository.aggregate({
      where: { ownerId: dev.id },
      _sum: { stars: true },
      _count: { id: true }
    });

    const totalStars = totals._sum.stars ?? 0;
    const activeRepos = totals._count.id;
    const contributions = 0;

    const impactScore = calculateImpactScore({
      followers: dev.followers,
      activeRepos,
      totalStars,
      contributions
    });

    await params.prisma.developer.update({
      where: { id: dev.id },
      data: { totalStars, activeRepos, contributions, impactScore }
    });

    await params.prisma.developerSnapshot.upsert({
      where: { developerId_snapshotDate: { developerId: dev.id, snapshotDate: params.snapshotDate } },
      update: {
        followers: dev.followers,
        publicRepos: dev.publicRepos,
        totalStars,
        impactScore
      },
      create: {
        developerId: dev.id,
        snapshotDate: params.snapshotDate,
        followers: dev.followers,
        publicRepos: dev.publicRepos,
        totalStars,
        impactScore
      }
    });
  }
}
