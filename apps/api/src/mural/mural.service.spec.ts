process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MuralService } from './mural.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ExpoPushService } from '../push/expo-push.service';

describe('MuralService', () => {
  let service: MuralService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MuralService,
        PrismaService,
        NotificationsService,
        { provide: ExpoPushService, useValue: { sendToUser: jest.fn() } },
      ],
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

  describe('createPost', () => {
    afterEach(async () => {
      await prisma.employee.deleteMany({ where: { userId: { startsWith: 'user-mural-create-' } } });
      await prisma.notification.deleteMany({ where: { type: 'mural' } });
    });

    it('creates the post with the given glyph/title/body', async () => {
      const post = await service.createPost(
        { glyph: '📣', title: 'Aviso importante', body: 'Confira o novo procedimento.' },
        'user-mural-create-poster',
      );

      expect(post).toMatchObject({
        glyph: '📣',
        title: 'Aviso importante',
        body: 'Confira o novo procedimento.',
      });
      const stored = await prisma.muralPost.findUnique({ where: { id: post.id } });
      expect(stored).toMatchObject({ glyph: '📣', title: 'Aviso importante' });
    });

    it('notifies every other active employee about the new post', async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-mural-create-recipient',
          name: 'Rita Recipient',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      await service.createPost(
        { glyph: '🎉', title: 'Boas-vindas!', body: 'Corpo.' },
        'user-mural-create-poster',
      );

      const notification = await prisma.notification.findFirst({
        where: { type: 'mural', userId: 'user-mural-create-recipient' },
      });
      expect(notification).toMatchObject({ message: '"Boas-vindas!" foi publicado no mural.' });
    });
  });
});
