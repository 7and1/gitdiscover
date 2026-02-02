import type { PrismaClient } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import type { Redis } from "ioredis";
import type { AuthUser } from "./plugins/auth";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    getAuthUser: (req: FastifyRequest) => Promise<AuthUser | null>;
    requireAuthUser: (req: FastifyRequest) => Promise<AuthUser>;
    cacheGetJson: <T>(key: string) => Promise<T | null>;
    cacheSetJson: (key: string, value: unknown, ttlSeconds: number) => Promise<void>;
    cacheDel: (key: string) => Promise<void>;

    // Plugin-provided (declare locally to keep TS happy across Fastify/plugin versions)
    jwt: {
      verify: <T extends object | string = object>(token: string) => T;
      sign: (payload: unknown, options?: unknown) => string;
    };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    cookies: Record<string, string | undefined>;
    jwtVerify: <T extends object | string = object>(options?: unknown) => Promise<T>;
  }
}
