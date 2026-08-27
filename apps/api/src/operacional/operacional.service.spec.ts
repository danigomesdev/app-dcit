process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { OperacionalService, resolveWeekRange } from './operacional.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OperacionalService', () => {
  let service: OperacionalService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OperacionalService, PrismaService],
    }).compile();

    service = module.get(OperacionalService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.sobreavisoRecord.deleteMany();
    await prisma.deslocamentoRecord.deleteMany();
    // Blanket-safe: plantaoShift is a table this task introduces and no
    // other spec file writes to it (unlike `employee`, shared with
    // solicitacoes.service.spec.ts/time-entries.service.spec.ts — a
    // blanket deleteMany() there previously caused cross-suite flakiness,
    // so the two tests below that touch `employee` clean up their own
    // rows inline by userId instead of relying on this afterAll).
    await prisma.plantaoShift.deleteMany();
    await prisma.onModuleDestroy();
  });

  it('reports inactive sobreaviso when there is no open record', async () => {
    const status = await service.getSobreavisoStatus('user-a');
    expect(status).toEqual({ active: false, startedAt: null });
  });

  it('toggles sobreaviso on then off', async () => {
    const activated = await service.toggleSobreaviso('user-b');
    expect(activated.active).toBe(true);
    expect(activated.startedAt).toBeInstanceOf(Date);

    const statusWhileActive = await service.getSobreavisoStatus('user-b');
    expect(statusWhileActive.active).toBe(true);

    const deactivated = await service.toggleSobreaviso('user-b');
    expect(deactivated).toEqual({ active: false, startedAt: null });

    const statusAfter = await service.getSobreavisoStatus('user-b');
    expect(statusAfter).toEqual({ active: false, startedAt: null });
  });

  it('creates and lists deslocamentos scoped to the user, newest first', async () => {
    await service.createDeslocamento('user-c', {
      startedAt: '2026-08-20T10:00:00.000Z',
      endedAt: '2026-08-20T10:30:00.000Z',
    });
    await service.createDeslocamento('user-c', {
      startedAt: '2026-08-21T09:00:00.000Z',
      endedAt: '2026-08-21T09:45:00.000Z',
    });
    await service.createDeslocamento('user-other', {
      startedAt: '2026-08-21T09:00:00.000Z',
      endedAt: '2026-08-21T09:45:00.000Z',
    });

    const results = await service.listDeslocamentos('user-c');

    expect(results).toHaveLength(2);
    expect(results[0].startedAt.toISOString()).toBe('2026-08-21T09:00:00.000Z');
  });

  describe('resolveWeekRange', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('defaults to Monday–Sunday of the current week when start/end are omitted', () => {
      // 2026-08-27 is a Thursday.
      jest.useFakeTimers().setSystemTime(new Date('2026-08-27T15:00:00.000Z'));

      const range = resolveWeekRange(undefined, undefined);

      expect(range.start.toISOString()).toBe('2026-08-24T00:00:00.000Z');
      expect(range.end.toISOString()).toBe('2026-08-30T23:59:59.999Z');
    });

    it('still resolves Monday correctly when today is itself a Sunday', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-30T09:00:00.000Z'));

      const range = resolveWeekRange(undefined, undefined);

      expect(range.start.toISOString()).toBe('2026-08-24T00:00:00.000Z');
      expect(range.end.toISOString()).toBe('2026-08-30T23:59:59.999Z');
    });

    it('uses explicit start/end when both are given', () => {
      const range = resolveWeekRange('2026-09-01', '2026-09-07');

      expect(range.start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(range.end.toISOString()).toBe('2026-09-07T23:59:59.999Z');
    });

    it('defaults end to start+6 days when only start is given', () => {
      const range = resolveWeekRange('2026-09-01', undefined);

      expect(range.start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(range.end.toISOString()).toBe('2026-09-07T23:59:59.999Z');
    });
  });

  describe('shifts', () => {
    it('creates and lists shifts within a date range, joined with the employee name', async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-shift-a',
          name: 'Shift Ana',
          role: 'colaborador',
          hireDate: new Date('2024-03-15'),
        },
      });

      const inRange = await service.createShift({
        date: '2026-09-02',
        label: 'Manhã',
        userId: 'user-shift-a',
      });
      const outOfRange = await service.createShift({
        date: '2026-09-15',
        label: 'Manhã',
        userId: 'user-shift-a',
      });

      const results = await service.listShifts(
        new Date('2026-09-01T00:00:00.000Z'),
        new Date('2026-09-07T23:59:59.999Z'),
      );

      const ids = results.map((r) => r.id);
      expect(ids).toContain(inRange.id);
      expect(ids).not.toContain(outOfRange.id);
      expect(results.find((r) => r.id === inRange.id)?.userName).toBe(
        'Shift Ana',
      );

      await prisma.plantaoShift.deleteMany({
        where: { id: { in: [inRange.id, outOfRange.id] } },
      });
      await prisma.employee.deleteMany({ where: { userId: 'user-shift-a' } });
    });

    it('falls back to the bare userId when no Employee row exists', async () => {
      const created = await service.createShift({
        date: '2026-09-03',
        label: 'Backup',
        userId: 'user-shift-unknown',
      });

      const results = await service.listShifts(
        new Date('2026-09-01T00:00:00.000Z'),
        new Date('2026-09-07T23:59:59.999Z'),
      );

      expect(results.find((r) => r.id === created.id)?.userName).toBe(
        'user-shift-unknown',
      );

      await prisma.plantaoShift.delete({ where: { id: created.id } });
    });

    it('deletes a shift', async () => {
      const created = await service.createShift({
        date: '2026-09-04',
        label: 'Noite',
        userId: 'user-shift-delete',
      });

      await service.deleteShift(created.id);

      const found = await prisma.plantaoShift.findUnique({
        where: { id: created.id },
      });
      expect(found).toBeNull();
    });

    it('does not throw when deleting an id that does not exist', async () => {
      await expect(
        service.deleteShift('does-not-exist'),
      ).resolves.not.toThrow();
    });

    it('rejects a duplicate shift (same date, label, userId)', async () => {
      await service.createShift({
        date: '2026-09-05',
        label: 'Dup',
        userId: 'user-shift-dup',
      });

      await expect(
        service.createShift({
          date: '2026-09-05',
          label: 'Dup',
          userId: 'user-shift-dup',
        }),
      ).rejects.toThrow(ConflictException);

      await prisma.plantaoShift.deleteMany({
        where: { userId: 'user-shift-dup' },
      });
    });
  });
});
