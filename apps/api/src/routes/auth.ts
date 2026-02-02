import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../config/env";
import { UnauthorizedError, ValidationError } from "../utils/errors";

const GithubCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1)
});

export async function authRoutes(server: FastifyInstance, env: Env): Promise<void> {
  server.get("/auth/github", async (_req, reply) => {
    if (!env.GITHUB_CLIENT_ID) {
      reply.status(503).send({
        error: { code: "SERVICE_UNAVAILABLE", message: "GitHub OAuth is not configured" }
      });
      return;
    }

    const state = crypto.randomUUID();
    reply.setCookie("oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60 // 10 minutes
    });

    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
    url.searchParams.set("redirect_uri", `${env.API_BASE_URL}/auth/github/callback`);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);

    reply.redirect(url.toString());
  });

  server.get("/auth/github/callback", async (req, reply) => {
    const parsed = GithubCallbackQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError(parsed.error.flatten());

    const expectedState = req.cookies.oauth_state;
    if (!expectedState || expectedState !== parsed.data.state) throw new UnauthorizedError();

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      reply.status(503).send({
        error: { code: "SERVICE_UNAVAILABLE", message: "GitHub OAuth is not configured" }
      });
      return;
    }

    const token = await exchangeGithubCodeForToken({
      code: parsed.data.code,
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET
    });

    const ghUser = await githubApiGet<GithubUser>("https://api.github.com/user", token);
    const email = await getPrimaryEmail(token);

    const user = await server.prisma.user.upsert({
      where: { githubId: BigInt(ghUser.id) },
      update: {
        login: ghUser.login,
        name: ghUser.name,
        email,
        avatarUrl: ghUser.avatar_url,
        accessToken: token,
        lastLoginAt: new Date()
      },
      create: {
        githubId: BigInt(ghUser.id),
        login: ghUser.login,
        name: ghUser.name,
        email,
        avatarUrl: ghUser.avatar_url,
        accessToken: token,
        lastLoginAt: new Date()
      }
    });

    const jwt = await reply.jwtSign({
      id: user.id,
      login: user.login,
      role: user.role
    });

    reply.clearCookie("oauth_state", { path: "/" });
    reply.setCookie("auth", jwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      signed: true
    });

    reply.redirect(env.APP_URL);
  });

  server.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie("auth", { path: "/" });
    reply.send({ success: true });
  });

  // Development-only: mint a cookie-based session without GitHub OAuth.
  server.post("/auth/dev", async (req, reply) => {
    if (env.NODE_ENV === "production") {
      reply.status(404).send({ error: { code: "NOT_FOUND", message: "Resource not found" } });
      return;
    }

    const body = z.object({ login: z.string().min(1).max(100) }).safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.flatten());

    const user = await server.prisma.user.upsert({
      where: { login: body.data.login },
      update: { lastLoginAt: new Date() },
      create: {
        githubId: BigInt(Date.now()),
        login: body.data.login,
        name: body.data.login,
        lastLoginAt: new Date()
      }
    });

    const jwt = await reply.jwtSign({ id: user.id, login: user.login, role: user.role });

    reply.setCookie("auth", jwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
      signed: true
    });

    reply.send({ success: true });
  });
}

async function exchangeGithubCodeForToken(params: {
  code: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code
    })
  });
  if (!res.ok) throw new UnauthorizedError();
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new UnauthorizedError();
  return json.access_token;
}

type GithubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
};

async function githubApiGet<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!res.ok) throw new UnauthorizedError();
  return (await res.json()) as T;
}

async function getPrimaryEmail(token: string): Promise<string | null> {
  try {
    const emails = await githubApiGet<Array<{ email: string; primary: boolean; verified: boolean }>>(
      "https://api.github.com/user/emails",
      token
    );
    const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.primary);
    return primary?.email ?? null;
  } catch {
    return null;
  }
}

