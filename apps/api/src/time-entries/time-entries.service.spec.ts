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
      where: {
        userId: {
          in: [
            'team-open',
            'team-closed',
            'team-none',
            'presence-folga-sat',
            'presence-folga-sun',
            'presence-ferias',
            'presence-ferias-pendente',
            'presence-atestado-today',
            'presence-atestado-lastday',
            'presence-atestado-nextday',
            'presence-4-entries',
            'presence-odd-1',
            'presence-odd-3',
            'presence-2-entries',
            'presence-atrasado',
            'presence-tolerancia',
            'presence-sem-horario',
          ],
        },
      },
    });
    await prisma.vacationRequest.deleteMany({
      where: {
        userId: { in: ['presence-ferias', 'presence-ferias-pendente'] },
      },
    });
    await prisma.atestado.deleteMany({
      where: {
        userId: {
          in: [
            'presence-atestado-today',
            'presence-atestado-lastday',
            'presence-atestado-nextday',
          ],
        },
      },
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
      expect(open?.status).toBe('trabalhando');
      expect(open?.entries).toHaveLength(1);
      expect(open?.workedMinutes).toBe(0);

      const closed = results.find((r) => r.userId === 'team-closed');
      expect(closed?.status).toBe('pausa');
      expect(closed?.entries).toHaveLength(2);
      expect(closed?.workedMinutes).toBe(240);

      const none = results.find((r) => r.userId === 'team-none');
      expect(none?.status).toBe('sem_registro');
      expect(none?.entries).toEqual([]);
      expect(none?.workedMinutes).toBe(0);
    });
  });

  describe('listTeamToday status derivation', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    // Baseline: Thursday 2026-08-27, 15:00 UTC = 12:00 in São Paulo (UTC-3).
    // Not a weekend, well past a typical 09:00 start.
    const WEEKDAY_NOON_SP = new Date('2026-08-27T15:00:00.000Z');

    function baseEmployee(
      userId: string,
      expectedStartTime: string | null = null,
    ) {
      return {
        userId,
        name: userId,
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
        expectedStartTime,
      };
    }

    it('is "folga" on a Saturday, even if expectedStartTime would otherwise make it "atrasado"', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-29T15:00:00.000Z')); // Saturday, 12:00 SP
      await prisma.employee.create({
        data: baseEmployee('presence-folga-sat', '09:00'),
      });

      const results = await service.listTeamToday();

      expect(
        results.find((r) => r.userId === 'presence-folga-sat')?.status,
      ).toBe('folga');
    });

    it('is "folga" on a Sunday', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-30T15:00:00.000Z')); // Sunday, 12:00 SP
      await prisma.employee.create({
        data: baseEmployee('presence-folga-sun'),
      });

      const results = await service.listTeamToday();

      expect(
        results.find((r) => r.userId === 'presence-folga-sun')?.status,
      ).toBe('folga');
    });

    it('is "ferias" with the period when an approved vacation covers today', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({ data: baseEmployee('presence-ferias') });
      await prisma.vacationRequest.create({
        data: {
          userId: 'presence-ferias',
          startDate: new Date('2026-08-25T00:00:00.000Z'),
          endDate: new Date('2026-08-29T00:00:00.000Z'),
          days: 5,
          status: 'aprovado',
        },
      });

      const results = await service.listTeamToday();

      const found = results.find((r) => r.userId === 'presence-ferias');
      expect(found?.status).toBe('ferias');
      expect(found?.periodStart?.toISOString()).toBe(
        '2026-08-25T00:00:00.000Z',
      );
      expect(found?.periodEnd?.toISOString()).toBe('2026-08-29T00:00:00.000Z');
    });

    it('does not count a pending (not yet approved) vacation as "ferias"', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({
        data: baseEmployee('presence-ferias-pendente'),
      });
      await prisma.vacationRequest.create({
        data: {
          userId: 'presence-ferias-pendente',
          startDate: new Date('2026-08-25T00:00:00.000Z'),
          endDate: new Date('2026-08-29T00:00:00.000Z'),
          days: 5,
          status: 'pendente',
        },
      });

      const results = await service.listTeamToday();

      expect(
        results.find((r) => r.userId === 'presence-ferias-pendente')?.status,
      ).toBe('sem_registro');
    });

    it('is "atestado" when submitted earlier today — same-day submission still covers today', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({
        data: baseEmployee('presence-atestado-today'),
      });
      await prisma.atestado.create({
        data: {
          userId: 'presence-atestado-today',
          userName: 'presence-atestado-today',
          dias: 2,
          status: 'aprovado',
          createdAt: WEEKDAY_NOON_SP, // submitted at noon today, not midnight
        },
      });

      const results = await service.listTeamToday();

      const found = results.find((r) => r.userId === 'presence-atestado-today');
      expect(found?.status).toBe('atestado');
      expect(found?.periodStart?.toISOString()).toBe(
        '2026-08-27T00:00:00.000Z',
      );
      expect(found?.periodEnd?.toISOString()).toBe('2026-08-29T00:00:00.000Z');
    });

    it('is still "atestado" on the last day of the period (início + dias - 1)', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP); // today = 2026-08-27
      await prisma.employee.create({
        data: baseEmployee('presence-atestado-lastday'),
      });
      await prisma.atestado.create({
        data: {
          userId: 'presence-atestado-lastday',
          userName: 'presence-atestado-lastday',
          dias: 2,
          status: 'aprovado',
          createdAt: new Date('2026-08-26T09:00:00.000Z'), // início = ontem, cobre ontem e hoje
        },
      });

      const results = await service.listTeamToday();

      expect(
        results.find((r) => r.userId === 'presence-atestado-lastday')?.status,
      ).toBe('atestado');
    });

    it('is no longer "atestado" the day after the period ends', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP); // today = 2026-08-27
      await prisma.employee.create({
        data: baseEmployee('presence-atestado-nextday'),
      });
      await prisma.atestado.create({
        data: {
          userId: 'presence-atestado-nextday',
          userName: 'presence-atestado-nextday',
          dias: 2,
          status: 'aprovado',
          createdAt: new Date('2026-08-25T09:00:00.000Z'), // início 2 dias atrás, retornou ontem
        },
      });

      const results = await service.listTeamToday();

      expect(
        results.find((r) => r.userId === 'presence-atestado-nextday')?.status,
      ).toBe('sem_registro');
    });

    it('is "nao_presente" with 4 punches today', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({
        data: baseEmployee('presence-4-entries'),
      });
      for (const time of ['09:00', '12:00', '13:00', '18:00']) {
        await service.create({
          userId: 'presence-4-entries',
          clockedAt: `2026-08-27T${time}:00.000Z`,
        });
      }

      const results = await service.listTeamToday();

      expect(
        results.find((r) => r.userId === 'presence-4-entries')?.status,
      ).toBe('nao_presente');
    });

    it('is "trabalhando" with 1 punch today', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({ data: baseEmployee('presence-odd-1') });
      await service.create({
        userId: 'presence-odd-1',
        clockedAt: '2026-08-27T09:00:00.000Z',
      });

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-odd-1')?.status).toBe(
        'trabalhando',
      );
    });

    it('is "trabalhando" with 3 punches today', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({ data: baseEmployee('presence-odd-3') });
      for (const time of ['09:00', '12:00', '13:00']) {
        await service.create({
          userId: 'presence-odd-3',
          clockedAt: `2026-08-27T${time}:00.000Z`,
        });
      }

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-odd-3')?.status).toBe(
        'trabalhando',
      );
    });

    it('is "pausa" with exactly 2 punches today', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({
        data: baseEmployee('presence-2-entries'),
      });
      for (const time of ['09:00', '12:00']) {
        await service.create({
          userId: 'presence-2-entries',
          clockedAt: `2026-08-27T${time}:00.000Z`,
        });
      }

      const results = await service.listTeamToday();

      expect(
        results.find((r) => r.userId === 'presence-2-entries')?.status,
      ).toBe('pausa');
    });

    it('is "atrasado" with 0 punches, an expectedStartTime, and more than 10min past it', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP); // 12:00 SP
      await prisma.employee.create({
        data: baseEmployee('presence-atrasado', '09:00'),
      });

      const results = await service.listTeamToday();

      expect(
        results.find((r) => r.userId === 'presence-atrasado')?.status,
      ).toBe('atrasado');
    });

    it('is "sem_registro" (not yet "atrasado") within the 10min tolerance', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP); // 12:00 SP
      await prisma.employee.create({
        data: baseEmployee('presence-tolerancia', '11:55'),
      });

      const results = await service.listTeamToday();

      expect(
        results.find((r) => r.userId === 'presence-tolerancia')?.status,
      ).toBe('sem_registro');
    });

    it('is "sem_registro", never "atrasado", when expectedStartTime is not set', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({
        data: baseEmployee('presence-sem-horario'),
      });

      const results = await service.listTeamToday();

      expect(
        results.find((r) => r.userId === 'presence-sem-horario')?.status,
      ).toBe('sem_registro');
    });
  });
});
