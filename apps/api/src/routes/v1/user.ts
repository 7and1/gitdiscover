import type { FastifyInstance } from "fastify";
import { NotFoundError } from "../../utils/errors";

export async function userRoutes(server: FastifyInstance): Promise<void> {
  server.get("/user", async (req) => {
    const auth = await server.requireAuthUser(req);

    const user = await server.prisma.user.findUnique({
      where: { id: auth.id }
    });
    if (!user) throw new NotFoundError("User");

    const [bookmarks, comments, votes] = await Promise.all([
      server.prisma.bookmark.count({ where: { userId: user.id } }),
      server.prisma.comment.count({ where: { userId: user.id, isDeleted: false } }),
      server.prisma.vote.count({ where: { userId: user.id } })
    ]);

    return {
      data: {
        id: user.id,
        githubId: Number(user.githubId),
        login: user.login,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        stats: {
          bookmarks,
          comments,
          votes
        },
        createdAt: user.createdAt.toISOString()
      }
    };
  });
}
