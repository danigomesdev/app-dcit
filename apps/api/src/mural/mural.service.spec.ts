process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MuralService } from './mural.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MuralService', () => {
  let service: MuralService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MuralService, PrismaService],
    }).compile();

    service = module.get(MuralService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.muralReaction.deleteMany();
    await prisma.muralPost.deleteMany();
    await prisma.birthday.deleteMany();
    await prisma.onModuleDestroy();
  });

  it('lists posts with reaction count and whether the user reacted', async () => {
    const post = await prisma.muralPost.create({
      data: { glyph: '🎉', title: 'Bem-vindo', body: 'Corpo do post' },
    });
    await prisma.muralReaction.create({
      data: { postId: post.id, userId: 'user-a' },
    });

    const asReactor = await service.listPosts('user-a');
    const asOther = await service.listPosts('user-b');

    const reactorView = asReactor.find((p) => p.id === post.id);
    const otherView = asOther.find((p) => p.id === post.id);

    expect(reactorView?.reactionCount).toBe(1);
    expect(reactorView?.reacted).toBe(true);
    expect(otherView?.reactionCount).toBe(1);
    expect(otherView?.reacted).toBe(false);
  });

  it('toggles a reaction on and off', async () => {
    const post = await prisma.muralPost.create({
      data: { glyph: '🎁', title: 'Novidade', body: 'Corpo' },
    });

    const first = await service.toggleReaction(post.id, 'user-c');
    expect(first).toEqual({ reactionCount: 1, reacted: true });

    const second = await service.toggleReaction(post.id, 'user-c');
    expect(second).toEqual({ reactionCount: 0, reacted: false });
  });

  it('throws when reacting to a post that does not exist', async () => {
    await expect(
      service.toggleReaction('missing-id', 'user-d'),
    ).rejects.toThrow(NotFoundException);
  });

  it('lists birthdays', async () => {
    await prisma.birthday.create({
      data: { name: 'Test Person', day: 1, month: 1 },
    });

    const results = await service.listBirthdays();

    expect(results.some((b) => b.name === 'Test Person')).toBe(true);
  });
});
