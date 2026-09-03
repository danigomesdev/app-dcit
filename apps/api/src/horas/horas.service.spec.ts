process.env.DATABASE_URL = 'file:./test.db';

import { resolvePeriodoRange, sumEntriesByUser } from './horas.service';

describe('resolvePeriodoRange (pure function)', () => {
  it('dia resolves to just today', () => {
    expect(resolvePeriodoRange('dia', '2026-09-03')).toEqual({ start: '2026-09-03', end: '2026-09-03' });
  });

  it('semana resolves to Monday through Sunday when today is a Thursday', () => {
    // 2026-09-03 is a Thursday
    expect(resolvePeriodoRange('semana', '2026-09-03')).toEqual({ start: '2026-08-31', end: '2026-09-06' });
  });

  it('semana resolves correctly when today is itself a Sunday', () => {
    // 2026-09-06 is a Sunday — must still resolve back to the Monday that started this week, not roll into next week
    expect(resolvePeriodoRange('semana', '2026-09-06')).toEqual({ start: '2026-08-31', end: '2026-09-06' });
  });

  it('semana resolves correctly when today is itself a Monday', () => {
    expect(resolvePeriodoRange('semana', '2026-08-31')).toEqual({ start: '2026-08-31', end: '2026-09-06' });
  });

  it('mes resolves to the 1st through the last day of a 30-day month', () => {
    expect(resolvePeriodoRange('mes', '2026-09-15')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  });

  it('mes resolves to the 1st through the last day of a 31-day month', () => {
    expect(resolvePeriodoRange('mes', '2026-10-15')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
  });

  it('mes resolves to the 1st through the 28th in a non-leap February', () => {
    expect(resolvePeriodoRange('mes', '2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('mes resolves to the 1st through the 29th in a leap February', () => {
    expect(resolvePeriodoRange('mes', '2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });
});

describe('sumEntriesByUser (pure function)', () => {
  it('sums both metrics per userId across multiple entries', () => {
    const totals = sumEntriesByUser([
      { userId: 'a', horasTrabalhadas: 8, horasTickets: 6 },
      { userId: 'a', horasTrabalhadas: 4, horasTickets: 3 },
      { userId: 'b', horasTrabalhadas: 5, horasTickets: 5 },
    ]);
    expect(totals.get('a')).toEqual({ horasTrabalhadas: 12, horasTickets: 9 });
    expect(totals.get('b')).toEqual({ horasTrabalhadas: 5, horasTickets: 5 });
  });

  it('returns an empty map for no entries', () => {
    const totals = sumEntriesByUser([]);
    expect(totals.size).toBe(0);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { HorasService } from './horas.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HorasService', () => {
  let service: HorasService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HorasService, PrismaService],
    }).compile();
    service = module.get(HorasService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
    await prisma.employee.create({
      data: {
        userId: 'horas-spec-user',
        name: 'Horas Spec Colaborador',
        role: 'colaborador',
        hireDate: new Date('2025-01-01'),
      },
    });
  });

  afterAll(async () => {
    await prisma.workedHoursEntry.deleteMany({ where: { userId: 'horas-spec-user' } });
    await prisma.employee.delete({ where: { userId: 'horas-spec-user' } });
    await prisma.onModuleDestroy();
  });

  it('lancar creates a new entry', async () => {
    const entry = await service.lancar(
      { userId: 'horas-spec-user', date: '2026-01-05', horasTrabalhadas: 8, horasTickets: 6 },
      'horas-spec-gestor',
    );
    expect(entry.horasTrabalhadas).toBe(8);
    expect(entry.horasTickets).toBe(6);
    expect(entry.gestorId).toBe('horas-spec-gestor');
  });

  it('lancar again for the same (userId, date) updates the existing row instead of creating a second one', async () => {
    await service.lancar(
      { userId: 'horas-spec-user', date: '2026-01-06', horasTrabalhadas: 4, horasTickets: 2 },
      'horas-spec-gestor',
    );
    const updated = await service.lancar(
      { userId: 'horas-spec-user', date: '2026-01-06', horasTrabalhadas: 7, horasTickets: 5 },
      'horas-spec-gestor',
    );
    expect(updated.horasTrabalhadas).toBe(7);
    expect(updated.horasTickets).toBe(5);

    const all = await prisma.workedHoursEntry.findMany({
      where: { userId: 'horas-spec-user', date: new Date('2026-01-06T00:00:00.000Z') },
    });
    expect(all).toHaveLength(1);
  });

  it('resumo includes an active employee with zero entries in the period as 0/0', async () => {
    const resumo = await service.resumo('mes');
    const entry = resumo.find((item) => item.userId === 'horas-spec-user');
    expect(entry).toBeDefined();
  });

  it('resumo sums only entries inside the resolved period', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await service.lancar(
      { userId: 'horas-spec-user', date: today, horasTrabalhadas: 3, horasTickets: 1 },
      'horas-spec-gestor',
    );
    const resumo = await service.resumo('dia');
    const entry = resumo.find((item) => item.userId === 'horas-spec-user');
    expect(entry?.horasTrabalhadas).toBe(3);
    expect(entry?.horasTickets).toBe(1);
    // The Jan 2026 entries from earlier tests must not leak into "dia" (today).
  });

  it('list returns only entries for the given user within the period, most recent first', async () => {
    const list = await service.list('horas-spec-user', 'mes');
    expect(list.every((entry) => entry.userId === 'horas-spec-user')).toBe(true);
  });

  it('remove deletes the entry', async () => {
    const entry = await service.lancar(
      { userId: 'horas-spec-user', date: '2026-01-07', horasTrabalhadas: 1, horasTickets: 1 },
      'horas-spec-gestor',
    );
    await service.remove(entry.id);
    const found = await prisma.workedHoursEntry.findUnique({ where: { id: entry.id } });
    expect(found).toBeNull();
  });
});
