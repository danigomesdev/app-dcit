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
    // Scoped to this file's own fixture ids, not a blanket deleteMany(): the
    // Employee table is shared with solicitacoes.service.spec.ts, which runs
    // as a separate Jest worker against the same test.db — a blanket delete
    // here raced with that suite's own Employee rows and made both suites
    // flaky.
    await prisma.employee.deleteMany({
      where: { userId: { in: ['team-open', 'team-closed', 'team-none'] } },
    });
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

  describe('listTeamToday', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("pairs today's punches per employee and reports who's currently clocked in", async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-27T15:00:00.000Z'));

      await prisma.employee.create({
        data: {
          userId: 'team-open',
          name: 'Ana Aberta',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });
      await prisma.employee.create({
        data: {
          userId: 'team-closed',
          name: 'Beto Fechado',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });
      await prisma.employee.create({
        data: {
          userId: 'team-none',
          name: 'Carla Sem Registro',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      // Yesterday's punch must not leak into today's summary.
      await service.create({
        userId: 'team-open',
        clockedAt: '2026-08-26T12:00:00.000Z',
      });
      await service.create({
        userId: 'team-open',
        clockedAt: '2026-08-27T09:00:00.000Z',
      });
      await service.create({
        userId: 'team-closed',
        clockedAt: '2026-08-27T09:00:00.000Z',
      });
      await service.create({
        userId: 'team-closed',
        clockedAt: '2026-08-27T13:00:00.000Z',
      });

      const results = await service.listTeamToday();

      const open = results.find((r) => r.userId === 'team-open');
      expect(open?.name).toBe('Ana Aberta');
      expect(open?.isOpen).toBe(true);
      expect(open?.entries).toHaveLength(1);
      expect(open?.workedMinutes).toBe(0);

      const closed = results.find((r) => r.userId === 'team-closed');
      expect(closed?.isOpen).toBe(false);
      expect(closed?.entries).toHaveLength(2);
      expect(closed?.workedMinutes).toBe(240);

      const none = results.find((r) => r.userId === 'team-none');
      expect(none?.isOpen).toBe(false);
      expect(none?.entries).toEqual([]);
      expect(none?.workedMinutes).toBe(0);
    });
  });
});
