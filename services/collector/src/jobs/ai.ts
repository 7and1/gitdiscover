import type { Prisma, PrismaClient } from "@prisma/client";
import type { Logger } from "pino";
import { z } from "zod";

export async function runAiJob(params: {
  prisma: PrismaClient;
  logger: Logger;
  snapshotDate: Date;
  openaiApiKey?: string;
}): Promise<void> {
  const startedAt = new Date();
  const sync = await params.prisma.syncLog.create({
    data: {
      syncType: "ai",
      status: "running",
      startedAt
    }
  });

  try {
    if (!params.openaiApiKey) {
      params.logger.warn("OPENAI_API_KEY not set; skipping AI analysis");
      await params.prisma.syncLog.update({
        where: { id: sync.id },
        data: { status: "skipped", completedAt: new Date() }
      });
      return;
    }

    const top = await params.prisma.repositorySnapshot.findMany({
      where: { snapshotDate: params.snapshotDate },
      orderBy: [{ score: "desc" }],
      take: 10,
      include: { repository: true }
    });

    for (const row of top) {
      const existing = await params.prisma.aiAnalysis.findUnique({
        where: {
          repositoryId_analysisDate: { repositoryId: row.repositoryId, analysisDate: params.snapshotDate }
        },
        select: { id: true }
      });
      if (existing) continue;

      const analysis = await generateAiAnalysis({
        apiKey: params.openaiApiKey,
        repo: row.repository,
        snapshot: row
      });

      const similarRepos = await suggestSimilarRepos(params.prisma, row.repositoryId, row.repository.language, row.repository.topics);

      await params.prisma.aiAnalysis.create({
        data: {
          repositoryId: row.repositoryId,
          analysisDate: params.snapshotDate,
          summary: analysis.summary,
          highlights: analysis.highlights,
          useCases: analysis.useCases,
          ...(analysis.techStack ? { techStack: analysis.techStack as Prisma.InputJsonValue } : {}),
          ...(analysis.codeQuality ? { codeQuality: analysis.codeQuality as Prisma.InputJsonValue } : {}),
          similarRepos: similarRepos,
          targetAudience: analysis.targetAudience,
          modelVersion: analysis.modelVersion,
          tokensUsed: analysis.tokensUsed
        }
      });
    }

    await params.prisma.syncLog.update({
      where: { id: sync.id },
      data: { status: "success", recordsProcessed: top.length, completedAt: new Date() }
    });
    params.logger.info("ai job complete");
  } catch (err) {
    params.logger.error({ err }, "ai job failed");
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

type OpenAiResult = {
  summary: string;
  highlights: string[];
  useCases: string[];
  techStack: unknown | null;
  codeQuality: unknown | null;
  targetAudience: string | null;
  modelVersion: string;
  tokensUsed: number;
};

const OpenAiChatCompletionSchema = z
  .object({
    choices: z
      .array(
        z.object({
          message: z.object({
            content: z.string()
          })
        })
      )
      .min(1),
    usage: z
      .object({
        total_tokens: z.number().optional()
      })
      .optional()
  })
  .passthrough();

const AiOutputSchema = z
  .object({
    summary: z.string().optional().default(""),
    highlights: z.array(z.string()).optional().default([]),
    useCases: z.array(z.string()).optional().default([]),
    techStack: z.unknown().nullable().optional().default(null),
    codeQuality: z.unknown().nullable().optional().default(null),
    targetAudience: z.string().nullable().optional().default(null)
  })
  .passthrough();

async function generateAiAnalysis(params: {
  apiKey: string;
  repo: { fullName: string; description: string | null; language: string | null; topics: string[]; stars: number; forks: number; starsGrowth24h: number; forksGrowth24h: number };
  snapshot: { score: number };
}): Promise<OpenAiResult> {
  const prompt = {
    repo: params.repo.fullName,
    description: params.repo.description,
    language: params.repo.language,
    topics: params.repo.topics,
    stars: params.repo.stars,
    forks: params.repo.forks,
    starsGrowth24h: params.repo.starsGrowth24h,
    forksGrowth24h: params.repo.forksGrowth24h,
    score: params.snapshot.score
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are an expert open-source analyst. Return strictly-valid JSON only. No markdown. No extra text."
        },
        {
          role: "user",
          content:
            `Analyze why this repository is trending and provide actionable insight.\\n` +
            `Return JSON with keys: summary (string, 1-2 sentences), highlights (string[]), useCases (string[]), techStack (object|null), codeQuality (object|null), targetAudience (string|null).\\n` +
            `Repository context: ${JSON.stringify(prompt)}`
        }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const json = OpenAiChatCompletionSchema.parse(await res.json());
  const first = json.choices[0];
  if (!first) throw new Error("OpenAI: missing choice");
  const content = first.message.content;

  const parsed = AiOutputSchema.parse(JSON.parse(content) as unknown);

  return {
    summary: parsed.summary,
    highlights: parsed.highlights,
    useCases: parsed.useCases,
    techStack: parsed.techStack && typeof parsed.techStack === "object" ? parsed.techStack : null,
    codeQuality: parsed.codeQuality && typeof parsed.codeQuality === "object" ? parsed.codeQuality : null,
    targetAudience: parsed.targetAudience,
    modelVersion: "gpt-4o-mini",
    tokensUsed: Number(json.usage?.total_tokens ?? 0)
  };
}

async function suggestSimilarRepos(
  prisma: PrismaClient,
  repositoryId: number,
  language: string | null,
  topics: string[]
): Promise<number[]> {
  const candidates = await prisma.repository.findMany({
    where: {
      id: { not: repositoryId },
      ...(language ? { language } : {}),
      ...(topics.length ? { topics: { hasSome: topics } } : {})
    },
    select: { id: true },
    take: 20,
    orderBy: [{ score: "desc" }]
  });
  return candidates.map((c) => c.id).slice(0, 5);
}
