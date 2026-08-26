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
    await prisma.pushToken.deleteMany();
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
});
