import type { FastifyInstance } from "fastify";
import { repositoriesRoutes } from "./repositories";
import { developersRoutes } from "./developers";
import { trendsRoutes } from "./trends";
import { bookmarksRoutes } from "./bookmarks";
import { commentsRoutes } from "./comments";
import { userRoutes } from "./user";

export async function v1Routes(server: FastifyInstance): Promise<void> {
  await repositoriesRoutes(server);
  await developersRoutes(server);
  await trendsRoutes(server);
  await bookmarksRoutes(server);
  await commentsRoutes(server);
  await userRoutes(server);
}
