import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Counter, Histogram, Registry } from "prom-client";

function isInternalIp(ip: string): boolean {
  // Handle IPv4-mapped IPv6 addresses
  const ipv4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;

  // Private IPv4 ranges
  const privateRanges = [
    /^127\./, // Loopback
    /^10\./, // Private Class A
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
    /^192\.168\./, // Private Class C
    /^::1$/ // IPv6 loopback
  ];

  return privateRanges.some((range) => range.test(ipv4));
}

export const metricsPlugin = fp(async (server: FastifyInstance) => {
  const register = new Registry();
  const isProduction = process.env.NODE_ENV === "production";

  const httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["method", "path", "status"],
    registers: [register]
  });

  const httpRequestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration",
    labelNames: ["method", "path"],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
    registers: [register]
  });

  // Database query performance metrics
  const dbQueryDuration = new Histogram({
    name: "db_query_duration_seconds",
    help: "Database query duration",
    labelNames: ["model", "operation"],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    registers: [register]
  });

  const dbSlowQueriesTotal = new Counter({
    name: "db_slow_queries_total",
    help: "Total slow database queries (>100ms)",
    labelNames: ["model", "operation"],
    registers: [register]
  });

  server.decorate("metrics", {
    dbQueryDuration,
    dbSlowQueriesTotal
  });

  server.addHook("onResponse", async (req: FastifyRequest, reply: FastifyReply) => {
    const path = req.routeOptions?.url ?? req.url;
    httpRequestsTotal.inc({ method: req.method, path, status: String(reply.statusCode) });
  });

  server.addHook("preHandler", async (req: FastifyRequest, _reply: FastifyReply) => {
    const path = req.routeOptions?.url ?? req.url;
    const end = httpRequestDuration.startTimer({ method: req.method, path });
    req.raw.on("close", () => end());
  });

  server.get("/metrics", async (req, reply) => {
    // Restrict /metrics to internal IPs only in production
    if (isProduction) {
      const clientIp = req.ip;
      if (!isInternalIp(clientIp)) {
        reply.code(403);
        return { error: "Forbidden" };
      }
    }
    reply.header("Content-Type", register.contentType);
    return register.metrics();
  });
});
