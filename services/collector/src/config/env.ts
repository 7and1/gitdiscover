import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  GITHUB_TOKEN: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().optional(),
  API_BASE_URL: z.string().default("http://localhost:3001"),
  LOG_LEVEL: z.string().default("info")
});

export type CollectorEnv = z.infer<typeof EnvSchema>;

export function getEnv(): CollectorEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new Error(`Invalid environment variables: ${JSON.stringify(issues)}`);
  }
  return parsed.data;
}
