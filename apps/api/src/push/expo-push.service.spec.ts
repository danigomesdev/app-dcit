process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { ExpoPushService } from './expo-push.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ExpoPushService', () => {
  let service: ExpoPushService;
  let prisma: PrismaService;
  const fetchMock = jest.fn();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExpoPushService, PrismaService],
    }).compile();

    service = module.get(ExpoPushService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(() => {
    fetchMock
      .mockReset()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    globalThis.fetch = fetchMock;
  });

  afterAll(async () => {
    // Scoped to this file's own fixture userIds, not a blanket deleteMany():
    // push-tokens.service.spec.ts runs as a separate Jest worker against
    // the same test.db, and a blanket delete here raced with its
    // mid-test pushToken rows, intermittently deleting them first.
    await prisma.pushToken.deleteMany({
      where: { userId: { in: ['expo-user-a', 'expo-user-b'] } },
    });
    await prisma.onModuleDestroy();
  });

  it('does nothing when the user has no registered tokens', async () => {
    await service.sendToUser('user-with-no-tokens', {
      title: 'Oi',
      body: 'Teste',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a push request for each registered token', async () => {
    await prisma.pushToken.createMany({
      data: [
        { userId: 'expo-user-a', token: 'ExponentPushToken[one]' },
        { userId: 'expo-user-a', token: 'ExponentPushToken[two]' },
      ],
    });

    await service.sendToUser('expo-user-a', {
      title: 'Atestado',
      body: 'Aprovado',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    const payload = JSON.parse(init.body as string) as unknown[];
    expect(payload).toEqual([
      { to: 'ExponentPushToken[one]', title: 'Atestado', body: 'Aprovado' },
      { to: 'ExponentPushToken[two]', title: 'Atestado', body: 'Aprovado' },
    ]);
  });

  it('includes data in the payload when provided', async () => {
    await prisma.pushToken.deleteMany({ where: { userId: 'expo-user-a' } });
    await prisma.pushToken.create({
      data: { userId: 'expo-user-a', token: 'ExponentPushToken[data]' },
    });

    await service.sendToUser('expo-user-a', {
      title: 'Pagamento',
      body: 'Depositado',
      data: { notificationId: 'notif-1', link: null },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(init.body as string) as unknown[];
    expect(payload).toEqual([
      {
        to: 'ExponentPushToken[data]',
        title: 'Pagamento',
        body: 'Depositado',
        data: { notificationId: 'notif-1', link: null },
      },
    ]);
  });

  it('omits data from the payload when not provided', async () => {
    await prisma.pushToken.deleteMany({ where: { userId: 'expo-user-a' } });
    await prisma.pushToken.create({
      data: { userId: 'expo-user-a', token: 'ExponentPushToken[nodata]' },
    });

    await service.sendToUser('expo-user-a', { title: 'Oi', body: 'Teste' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(init.body as string) as unknown[];
    expect(payload[0]).not.toHaveProperty('data');
  });

  it('swallows errors from a failed push request', async () => {
    await prisma.pushToken.create({
      data: { userId: 'expo-user-b', token: 'ExponentPushToken[three]' },
    });
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(
      service.sendToUser('expo-user-b', { title: 'Oi', body: 'Teste' }),
    ).resolves.toBeUndefined();
  });
});
