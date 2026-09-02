process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;
  const sendToUser = jest.fn();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        PrismaService,
        { provide: ExpoPushService, useValue: { sendToUser } },
      ],
    }).compile();

    service = module.get(NotificationsService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(() => {
    sendToUser.mockReset();
  });

  afterEach(async () => {
    await prisma.notification.deleteMany();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  describe('sendPagamento', () => {
    it('creates one Notification per userId with the category message', async () => {
      await service.sendPagamento('vale_transporte', ['user-1', 'user-2']);

      const notifications = await prisma.notification.findMany({
        orderBy: { userId: 'asc' },
      });
      expect(notifications).toHaveLength(2);
      expect(notifications[0]).toMatchObject({
        userId: 'user-1',
        type: 'pagamento',
        category: 'vale_transporte',
        message: 'Seu vale-transporte foi depositado.',
      });
      expect(notifications[1]).toMatchObject({
        userId: 'user-2',
        type: 'pagamento',
        category: 'vale_transporte',
      });
    });

    it('sends a push to every recipient with the notification id and link in the data payload', async () => {
      await service.sendPagamento('salario', ['user-1', 'user-2']);

      expect(sendToUser).toHaveBeenCalledTimes(2);

      const notifications = await prisma.notification.findMany({ orderBy: { userId: 'asc' } });
      expect(notifications).toHaveLength(2);

      for (const notification of notifications) {
        expect(sendToUser).toHaveBeenCalledWith(notification.userId, {
          title: 'Ponto DCIT',
          body: 'Seu salário foi depositado.',
          data: { notificationId: notification.id, link: null },
        });
      }
    });
  });

  describe('pagamentoStatus', () => {
    it('returns only notifications within the date range', async () => {
      await prisma.notification.create({
        data: {
          userId: 'user-1',
          type: 'pagamento',
          category: 'salario',
          message: 'Seu salário foi depositado.',
          createdAt: new Date('2026-09-05T12:00:00.000Z'),
        },
      });
      await prisma.notification.create({
        data: {
          userId: 'user-2',
          type: 'pagamento',
          category: 'salario',
          message: 'Seu salário foi depositado.',
          createdAt: new Date('2026-08-05T12:00:00.000Z'), // outside the range below
        },
      });

      const status = await service.pagamentoStatus('salario', '2026-09-01', '2026-09-30');

      expect(status).toEqual([{ userId: 'user-1', sentAt: '2026-09-05T12:00:00.000Z' }]);
    });

    it('keeps only the most recent sentAt when a userId was notified twice', async () => {
      await prisma.notification.create({
        data: {
          userId: 'user-1',
          type: 'pagamento',
          category: 'salario',
          message: 'Seu salário foi depositado.',
          createdAt: new Date('2026-09-05T12:00:00.000Z'),
        },
      });
      await prisma.notification.create({
        data: {
          userId: 'user-1',
          type: 'pagamento',
          category: 'salario',
          message: 'Seu salário foi depositado.',
          createdAt: new Date('2026-09-10T12:00:00.000Z'),
        },
      });

      const status = await service.pagamentoStatus('salario', '2026-09-01', '2026-09-30');

      expect(status).toEqual([{ userId: 'user-1', sentAt: '2026-09-10T12:00:00.000Z' }]);
    });

    it('includes a notification sent late evening São Paulo time on the last day of the range (already the next day in UTC)', async () => {
      await prisma.notification.create({
        data: {
          userId: 'user-1',
          type: 'pagamento',
          category: 'salario',
          message: 'Seu salário foi depositado.',
          // 2026-09-30T23:30 in São Paulo (UTC-3) is 2026-10-01T02:30Z —
          // outside a bare-UTC ['2026-09-01', '2026-09-30T23:59:59.999Z']
          // window, but still squarely within the São-Paulo calendar range.
          createdAt: new Date('2026-09-30T23:30:00.000-03:00'),
        },
      });

      const status = await service.pagamentoStatus('salario', '2026-09-01', '2026-09-30');

      expect(status).toEqual([
        { userId: 'user-1', sentAt: new Date('2026-09-30T23:30:00.000-03:00').toISOString() },
      ]);
    });

    it('does not mix categories', async () => {
      await prisma.notification.create({
        data: {
          userId: 'user-1',
          type: 'pagamento',
          category: 'vale_alimentacao',
          message: 'Seu vale-alimentação foi depositado.',
          createdAt: new Date('2026-09-05T12:00:00.000Z'),
        },
      });

      const status = await service.pagamentoStatus('salario', '2026-09-01', '2026-09-30');

      expect(status).toEqual([]);
    });
  });

  describe('listMine', () => {
    it('returns only the given userId\'s notifications, newest first', async () => {
      await prisma.notification.create({
        data: { userId: 'user-1', type: 'pagamento', message: 'Primeira', createdAt: new Date('2026-09-01T00:00:00.000Z') },
      });
      await prisma.notification.create({
        data: { userId: 'user-1', type: 'pagamento', message: 'Segunda', createdAt: new Date('2026-09-02T00:00:00.000Z') },
      });
      await prisma.notification.create({
        data: { userId: 'user-2', type: 'pagamento', message: 'De outro usuário' },
      });

      const mine = await service.listMine('user-1');

      expect(mine.map((n) => n.message)).toEqual(['Segunda', 'Primeira']);
    });
  });

  describe('markRead', () => {
    it('sets readAt on the caller\'s own notification', async () => {
      const created = await prisma.notification.create({
        data: { userId: 'user-1', type: 'pagamento', message: 'Teste' },
      });

      await service.markRead(created.id, 'user-1');

      const updated = await prisma.notification.findUniqueOrThrow({ where: { id: created.id } });
      expect(updated.readAt).not.toBeNull();
    });

    it('does not mark another user\'s notification as read', async () => {
      const created = await prisma.notification.create({
        data: { userId: 'user-1', type: 'pagamento', message: 'Teste' },
      });

      await service.markRead(created.id, 'user-2');

      const untouched = await prisma.notification.findUniqueOrThrow({ where: { id: created.id } });
      expect(untouched.readAt).toBeNull();
    });
  });
});
