process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { TimeEntriesService } from './time-entries.service';
import { PrismaService } from '../prisma/prisma.service';

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

  it("lists only the given user's entries, oldest first", async () => {
    await service.create({
      userId: 'user-a',
      clockedAt: '2026-08-20T09:00:00.000Z',
    });
    await service.create({
      userId: 'user-b',
      clockedAt: '2026-08-20T09:30:00.000Z',
    });
    await service.create({
      userId: 'user-a',
      clockedAt: '2026-08-20T18:00:00.000Z',
    });

    const results = await service.listForUser('user-a');

    expect(results).toHaveLength(2);
    expect(results.every((entry) => entry.userId === 'user-a')).toBe(true);
    expect(results[0].clockedAt.toISOString()).toBe('2026-08-20T09:00:00.000Z');
    expect(results[1].clockedAt.toISOString()).toBe('2026-08-20T18:00:00.000Z');
  });
});
