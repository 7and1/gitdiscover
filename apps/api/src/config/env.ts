import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
  COOKIE_SECRET: z.string().min(32, "COOKIE_SECRET must be at least 32 characters long"),
  APP_URL: z.string().url(),
  API_BASE_URL: z.string().url().default("http://localhost:3001"),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional()
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message
    }));
    throw new Error(`Invalid environment variables: ${JSON.stringify(issues)}`);
  }
  return parsed.data;
}

