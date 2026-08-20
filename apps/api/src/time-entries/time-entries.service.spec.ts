process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { TimeEntriesService } from './time-entries.service';
import { PrismaService } from './prisma.service';

describe('TimeEntriesService', () => {
  let service: TimeEntriesService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimeEntriesService, PrismaService],
    }).compile();

    service = module.get(TimeEntriesService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.timeEntry.deleteMany();
    await prisma.onModuleDestroy();
  });

  it('creates and persists a time entry', async () => {
    const created = await service.create({
      userId: 'user-123',
      clockedAt: '2026-08-19T13:00:00.000Z',
    });

    expect(created.userId).toBe('user-123');
    expect(created.clockedAt.toISOString()).toBe('2026-08-19T13:00:00.000Z');

    const found = await prisma.timeEntry.findUnique({
      where: { id: created.id },
    });
    expect(found).not.toBeNull();
  });
});
