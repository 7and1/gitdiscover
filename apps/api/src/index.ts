import "dotenv/config";
import { buildServer } from "./server";

async function main() {
  const server = await buildServer();

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  const host = process.env.HOST ?? "0.0.0.0";

  await server.listen({ port, host });

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, starting graceful shutdown...`);

    try {
      // Close Fastify server (stops accepting new connections)
      await server.close();
      server.log.info("Fastify server closed");

      // Disconnect Prisma (via onClose hook)
      // Quit Redis connection (via onClose hook)

      server.log.info("Graceful shutdown completed");
      process.exit(0);
    } catch (err) {
      server.log.error(err, "Error during graceful shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
