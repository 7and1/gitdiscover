import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import { UnauthorizedError } from "../utils/errors";

export interface AuthUser {
  id: number;
  login: string;
  role: "USER" | "MODERATOR" | "ADMIN";
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

function getBearerToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

function validateJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }
  return secret;
}

function getCookieSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (!secret) {
    throw new Error("COOKIE_SECRET environment variable is required");
  }
  if (secret.length < 32) {
    throw new Error("COOKIE_SECRET must be at least 32 characters long");
  }
  return secret;
}

export const authPlugin = fp(async (server: FastifyInstance) => {
  const cookieSecret = getCookieSecret();
  server.register(fastifyCookie, {
    secret: cookieSecret
  });
  server.register(fastifyJwt, {
    secret: validateJwtSecret(),
    cookie: {
      cookieName: "auth",
      signed: true
    }
  });

  server.decorate("getAuthUser", async (req: FastifyRequest): Promise<AuthUser | null> => {
    const bearer = getBearerToken(req);
    try {
      if (bearer) {
        return server.jwt.verify<AuthUser>(bearer);
      }
      if (req.cookies.auth) {
        return await req.jwtVerify<AuthUser>();
      }
    } catch {
      throw new UnauthorizedError();
    }
    return null;
  });

  server.decorate("requireAuthUser", async (req: FastifyRequest): Promise<AuthUser> => {
    const user = await server.getAuthUser(req);
    if (!user) throw new UnauthorizedError();
    return user;
  });
});
