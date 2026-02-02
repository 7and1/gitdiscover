import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ConflictError, NotFoundError, ValidationError } from "../../utils/errors";
import { repoDetailCacheKey } from "../../utils/cacheKeys";

const CreateBookmarkBodySchema = z.object({
  repositoryId: z.number().int().positive(),
  note: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional()
});

export async function bookmarksRoutes(server: FastifyInstance): Promise<void> {
  server.get("/bookmarks", async (req) => {
    const auth = await server.requireAuthUser(req);

    const bookmarks = await server.prisma.bookmark.findMany({
      where: { userId: auth.id },
      orderBy: { createdAt: "desc" },
      include: { repository: { select: { id: true, fullName: true, stars: true } } }
    });

    return {
      data: bookmarks.map((b) => ({
        id: b.id,
        repository: b.repository,
        note: b.note,
        tags: b.tags,
        createdAt: b.createdAt.toISOString()
      }))
    };
  });

  server.post("/bookmarks", async (req) => {
    const auth = await server.requireAuthUser(req);
    const body = CreateBookmarkBodySchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.flatten());

    const repo = await server.prisma.repository.findUnique({
      where: { id: body.data.repositoryId },
      select: { id: true, fullName: true }
    });
    if (!repo) throw new NotFoundError("Repository");

    const existing = await server.prisma.bookmark.findUnique({
      where: { userId_repositoryId: { userId: auth.id, repositoryId: repo.id } },
      select: { id: true }
    });
    if (existing) throw new ConflictError("Bookmark already exists");

    const created = await server.prisma.bookmark.create({
      data: {
        userId: auth.id,
        repositoryId: repo.id,
        note: body.data.note ?? null,
        tags: body.data.tags ?? []
      }
    });

    await server.cacheDel(repoDetailCacheKey(repo.fullName));

    return {
      data: {
        id: created.id,
        repositoryId: created.repositoryId,
        note: created.note,
        tags: created.tags,
        createdAt: created.createdAt.toISOString()
      }
    };
  });

  server.delete("/bookmarks/:repositoryId", async (req) => {
    const auth = await server.requireAuthUser(req);
    const params = z.object({ repositoryId: z.coerce.number().int().positive() }).safeParse(req.params);
    if (!params.success) throw new ValidationError(params.error.flatten());

    const repo = await server.prisma.repository.findUnique({
      where: { id: params.data.repositoryId },
      select: { fullName: true }
    });

    await server.prisma.bookmark.deleteMany({
      where: { userId: auth.id, repositoryId: params.data.repositoryId }
    });

    if (repo) await server.cacheDel(repoDetailCacheKey(repo.fullName));

    return { success: true };
  });
}
