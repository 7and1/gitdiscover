import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const vercel = await prisma.developer.upsert({
    where: { login: "vercel" },
    update: {},
    create: {
      githubId: BigInt(14985020),
      login: "vercel",
      name: "Vercel",
      avatarUrl: "https://avatars.githubusercontent.com/u/14985020",
      followers: 1000,
      following: 0,
      publicRepos: 100,
      totalStars: 500000,
      impactScore: 8.5
    }
  });

  const repo = await prisma.repository.upsert({
    where: { fullName: "vercel/next.js" },
    update: {
      stars: 120000,
      forks: 25000,
      starsGrowth24h: 150,
      forksGrowth24h: 30,
      score: 125.5,
      topics: ["react", "nextjs", "framework"],
      ownerId: vercel.id
    },
    create: {
      githubId: BigInt(70107786),
      fullName: "vercel/next.js",
      name: "next.js",
      description: "The React Framework",
      language: "TypeScript",
      stars: 120000,
      forks: 25000,
      watchers: 2500,
      openIssues: 1500,
      starsGrowth24h: 150,
      forksGrowth24h: 30,
      score: 125.5,
      topics: ["react", "nextjs", "framework"],
      license: "MIT",
      homepage: "https://nextjs.org",
      hasReadme: true,
      hasLicense: true,
      isArchived: false,
      isFork: false,
      ownerId: vercel.id,
      pushedAt: now,
      repoCreatedAt: new Date("2016-10-25T00:00:00Z")
    }
  });

  // Snapshots (last 7 days)
  for (let i = 7; i >= 1; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    await prisma.repositorySnapshot.upsert({
      where: { repositoryId_snapshotDate: { repositoryId: repo.id, snapshotDate: d } },
      update: {},
      create: {
        repositoryId: repo.id,
        snapshotDate: d,
        stars: repo.stars - i * 100,
        forks: repo.forks - i * 20,
        watchers: repo.watchers,
        openIssues: repo.openIssues,
        starsGrowth: 100,
        forksGrowth: 20,
        score: repo.score,
        rank: i
      }
    });
  }

  await prisma.aiAnalysis.upsert({
    where: { repositoryId_analysisDate: { repositoryId: repo.id, analysisDate: today } },
    update: {},
    create: {
      repositoryId: repo.id,
      analysisDate: today,
      summary:
        "Next.js is a production-ready React framework that enables server-side rendering and static site generation.",
      highlights: ["Server-side rendering", "Static site generation", "Edge runtime support"],
      useCases: ["Marketing websites", "E-commerce", "Dashboards"],
      techStack: { framework: "React", runtime: "Node.js" },
      codeQuality: { documentation: "excellent", maintainability: "excellent" },
      similarRepos: [],
      targetAudience: "Frontend developers",
      modelVersion: "gpt-4o-mini-2024-07-18",
      tokensUsed: 0
    }
  });

  console.log("Seed complete");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

