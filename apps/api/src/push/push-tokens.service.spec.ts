process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { PushTokensService } from './push-tokens.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PushTokensService', () => {
  let service: PushTokensService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PushTokensService, PrismaService],
    }).compile();

    service = module.get(PushTokensService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    // Scoped to this file's own fixture userIds, not a blanket deleteMany():
    // expo-push.service.spec.ts runs as a separate Jest worker against the
    // same test.db, and a blanket delete here could race with its mid-test
    // pushToken rows in the same way (see that file's own afterAll comment).
    await prisma.pushToken.deleteMany({
      where: {
        userId: { in: ['user-a', 'user-b', 'user-c', 'user-d', 'user-e'] },
      },
    });
    await prisma.onModuleDestroy();
  });

  it('registers a new token for a user', async () => {
    const result = await service.registerToken(
      'user-a',
      'ExponentPushToken[aaa]',
    );

    expect(result.userId).toBe('user-a');
    expect(result.token).toBe('ExponentPushToken[aaa]');
  });

  it('re-registering the same token reassigns it to the new user', async () => {
    await service.registerToken('user-a', 'ExponentPushToken[shared]');
    const result = await service.registerToken(
      'user-b',
      'ExponentPushToken[shared]',
    );

    expect(result.userId).toBe('user-b');

    const count = await prisma.pushToken.count({
      where: { token: 'ExponentPushToken[shared]' },
    });
    expect(count).toBe(1);
  });

  it('unregisters a token owned by the given user', async () => {
    await service.registerToken('user-c', 'ExponentPushToken[mine]');

    await service.unregisterToken('user-c', 'ExponentPushToken[mine]');

    const count = await prisma.pushToken.count({
      where: { token: 'ExponentPushToken[mine]' },
    });
    expect(count).toBe(0);
  });

  it('does not unregister a token owned by a different user', async () => {
    await service.registerToken('user-d', 'ExponentPushToken[not-yours]');

    await service.unregisterToken('user-e', 'ExponentPushToken[not-yours]');

    const count = await prisma.pushToken.count({
      where: { token: 'ExponentPushToken[not-yours]' },
    });
    expect(count).toBe(1);
  });
});
