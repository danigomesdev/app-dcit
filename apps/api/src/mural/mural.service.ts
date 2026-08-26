import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MuralService {
  constructor(private readonly prisma: PrismaService) {}

  async listPosts(userId: string) {
    const [posts, myReactions] = await Promise.all([
      this.prisma.muralPost.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.muralReaction.findMany({ where: { userId } }),
    ]);
    const reactedPostIds = new Set(myReactions.map((r) => r.postId));

    return Promise.all(
      posts.map(async (post) => ({
        ...post,
        reactionCount: await this.prisma.muralReaction.count({
          where: { postId: post.id },
        }),
        reacted: reactedPostIds.has(post.id),
      })),
    );
  }

  async toggleReaction(postId: string, userId: string) {
    const post = await this.prisma.muralPost.findUnique({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existing = await this.prisma.muralReaction.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await this.prisma.muralReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.muralReaction.create({ data: { postId, userId } });
    }

    const reactionCount = await this.prisma.muralReaction.count({
      where: { postId },
    });
    return { reactionCount, reacted: !existing };
  }

  listBirthdays() {
    return this.prisma.birthday.findMany();
  }
}
