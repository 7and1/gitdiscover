import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ForbiddenError, NotFoundError, ValidationError } from "../../utils/errors";
import { repoDetailCacheKey } from "../../utils/cacheKeys";

const CommentIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

const UpdateCommentBodySchema = z.object({
  content: z.string().min(1).max(5000)
});

export async function commentsRoutes(server: FastifyInstance): Promise<void> {
  server.put("/comments/:id", async (req) => {
    const auth = await server.requireAuthUser(req);
    const params = CommentIdParamsSchema.safeParse(req.params);
    if (!params.success) throw new ValidationError(params.error.flatten());
    const body = UpdateCommentBodySchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.flatten());

    const existing = await server.prisma.comment.findUnique({
      where: { id: params.data.id },
      select: { id: true, userId: true, isDeleted: true, repositoryId: true }
    });
    if (!existing || existing.isDeleted) throw new NotFoundError("Comment");

    const isOwner = existing.userId === auth.id;
    const isModerator = auth.role === "MODERATOR" || auth.role === "ADMIN";
    if (!isOwner && !isModerator) throw new ForbiddenError();

    const updated = await server.prisma.comment.update({
      where: { id: existing.id },
      data: { content: body.data.content, isEdited: true }
    });

    const repo = await server.prisma.repository.findUnique({
      where: { id: existing.repositoryId },
      select: { fullName: true }
    });
    if (repo) await server.cacheDel(repoDetailCacheKey(repo.fullName));

    return {
      data: {
        id: updated.id,
        content: updated.content,
        isEdited: updated.isEdited,
        updatedAt: updated.updatedAt.toISOString()
      }
    };
  });

  server.delete("/comments/:id", async (req) => {
    const auth = await server.requireAuthUser(req);
    const params = CommentIdParamsSchema.safeParse(req.params);
    if (!params.success) throw new ValidationError(params.error.flatten());

    const existing = await server.prisma.comment.findUnique({
      where: { id: params.data.id },
      select: { id: true, userId: true, isDeleted: true, repositoryId: true }
    });
    if (!existing || existing.isDeleted) throw new NotFoundError("Comment");

    const isOwner = existing.userId === auth.id;
    const isModerator = auth.role === "MODERATOR" || auth.role === "ADMIN";
    if (!isOwner && !isModerator) throw new ForbiddenError();

    await server.prisma.comment.update({
      where: { id: existing.id },
      data: { isDeleted: true }
    });

    const repo = await server.prisma.repository.findUnique({
      where: { id: existing.repositoryId },
      select: { fullName: true }
    });
    if (repo) await server.cacheDel(repoDetailCacheKey(repo.fullName));

    return { success: true };
  });
}
