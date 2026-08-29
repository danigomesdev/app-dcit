process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { BancoDeHorasService, resolveDefaultPeriod } from './banco-de-horas.service';
import { PrismaService } from '../prisma/prisma.service';

describe('resolveDefaultPeriod', () => {
  it('defaults to the first day of the current São Paulo month through today when no params are given', () => {
    const { startDateOnly, endDateOnly } = resolveDefaultPeriod();
    const todaySP = endDateOnly; // whatever "today" resolves to, per the function itself
    expect(startDateOnly).toBe(`${todaySP.slice(0, 7)}-01`);
    expect(startDateOnly.length).toBe(10);
    expect(endDateOnly.length).toBe(10);
  });

  it('uses the explicit start/end when both are given', () => {
    const result = resolveDefaultPeriod('2026-01-01', '2026-01-15');
    expect(result).toEqual({ startDateOnly: '2026-01-01', endDateOnly: '2026-01-15' });
  });
});

describe('BancoDeHorasService', () => {
  let service: BancoDeHorasService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BancoDeHorasService, PrismaService],
    }).compile();

    service = module.get(BancoDeHorasService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.timeEntry.deleteMany({
      where: { userId: { startsWith: 'user-bdh-' } },
    });
    await prisma.employee.deleteMany({
      where: { userId: { startsWith: 'user-bdh-' } },
    });
    await prisma.convencaoColetiva.deleteMany({
      where: { nome: { startsWith: 'Convenção BDH Teste' } },
    });
    await prisma.onModuleDestroy();
  });

  it('treats a day with no punches as zero worked minutes, not fabricated data', async () => {
    // 2026-09-01 is a Tuesday — a weekday, so expectedMinutes > 0 with no
    // convenção/employee row at all (defaults apply even for an unknown user).
    const summary = await service.getSummary('user-bdh-nodata', '2026-09-01', '2026-09-01');

    expect(summary.days).toEqual([
      { date: '2026-09-01', expectedMinutes: 480, workedMinutes: 0, diffMinutes: -480 },
    ]);
    expect(summary.balanceMinutes).toBe(-480);
  });

  it('sums paired punches into worked minutes for a day with real entries', async () => {
    await prisma.timeEntry.create({
      data: { userId: 'user-bdh-a', clockedAt: new Date('2026-09-01T12:00:00.000Z') }, // 09:00 SP
    });
    await prisma.timeEntry.create({
      data: { userId: 'user-bdh-a', clockedAt: new Date('2026-09-01T20:00:00.000Z') }, // 17:00 SP
    });

    const summary = await service.getSummary('user-bdh-a', '2026-09-01', '2026-09-01');

    expect(summary.days[0].workedMinutes).toBe(8 * 60);
    expect(summary.days[0].diffMinutes).toBe(0); // 8h worked, 8h expected (default)
  });

  it('has expectedMinutes: 0 on a weekend', async () => {
    // 2026-09-05 is a Saturday.
    const summary = await service.getSummary('user-bdh-weekend', '2026-09-05', '2026-09-05');

    expect(summary.days[0]).toEqual({
      date: '2026-09-05',
      expectedMinutes: 0,
      workedMinutes: 0,
      diffMinutes: 0,
    });
  });

  it("uses the employee's convenção jornada/percentual instead of the defaults", async () => {
    const convencao = await prisma.convencaoColetiva.create({
      data: {
        nome: 'Convenção BDH Teste A',
        cnpj: null,
        categoriaSindical: null,
        expectedDailyMinutes: 360,
        overtimePercent: 100,
      },
    });
    await prisma.employee.create({
      data: {
        userId: 'user-bdh-convencao',
        name: 'Com Convenio',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
        convencaoId: convencao.id,
        salarioMensal: 6000,
      },
    });
    await prisma.timeEntry.create({
      data: { userId: 'user-bdh-convencao', clockedAt: new Date('2026-09-01T12:00:00.000Z') },
    });
    await prisma.timeEntry.create({
      data: { userId: 'user-bdh-convencao', clockedAt: new Date('2026-09-01T20:00:00.000Z') }, // 8h worked
    });

    const summary = await service.getSummary('user-bdh-convencao', '2026-09-01', '2026-09-01');

    expect(summary.days[0].expectedMinutes).toBe(360); // convenção's jornada, not the 480 default
    expect(summary.days[0].diffMinutes).toBe(120); // 480 worked - 360 expected
  });

  it('treats a convencaoId that does not resolve to a real row as "no convenção" (defaults apply)', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-bdh-dangling',
        name: 'Convenio Fantasma',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
        convencaoId: 'does-not-exist',
      },
    });

    const summary = await service.getSummary('user-bdh-dangling', '2026-09-01', '2026-09-01');

    expect(summary.days[0].expectedMinutes).toBe(480); // default, not a crash

    await prisma.employee.delete({ where: { userId: 'user-bdh-dangling' } });
  });

  it('returns null hourlyRateBRL/overtimeValueBRL when there is no salarioMensal on file', async () => {
    const summary = await service.getSummary('user-bdh-nosalary', '2026-09-01', '2026-09-01');

    expect(summary.hourlyRateBRL).toBeNull();
    expect(summary.overtimeValueBRL).toBeNull();
  });

  it('computes hourlyRateBRL and overtimeValueBRL when salarioMensal is set', async () => {
    // Reuses 'user-bdh-convencao' from the earlier test: convenção 360min/day,
    // 100% overtime, salário 6000, 120 diffMinutes (2h) of overtime on 2026-09-01.
    const summary = await service.getSummary('user-bdh-convencao', '2026-09-01', '2026-09-01');

    // hourlyRate = 6000 / (6h * 22) = 45.454545...
    expect(summary.hourlyRateBRL).toBeCloseTo(45.4545, 3);
    // overtimeValue = 2h * 45.4545 * (1 + 100/100) = 181.818...
    expect(summary.overtimeValueBRL).toBeCloseTo(181.82, 1);
  });

  it('computes dsrMinutes using the same proportional formula as the old mobile mock', async () => {
    // A 3-day window spanning a weekend: Fri 2026-09-04 (worked 10h, 2h
    // overtime), Sat 2026-09-05 and Sun 2026-09-06 (no punches, both rest
    // days since expectedMinutes is 0 on weekends).
    await prisma.timeEntry.create({
      data: { userId: 'user-bdh-dsr', clockedAt: new Date('2026-09-04T11:00:00.000Z') }, // 08:00 SP
    });
    await prisma.timeEntry.create({
      data: { userId: 'user-bdh-dsr', clockedAt: new Date('2026-09-04T21:00:00.000Z') }, // 18:00 SP, 10h worked
    });

    const summary = await service.getSummary('user-bdh-dsr', '2026-09-04', '2026-09-06');

    // workedDays = 1 (only Fri has expectedMinutes>0 && workedMinutes>0),
    // restDays = 2 (Sat + Sun), overtimeMinutes = 120 (10h - 8h).
    // dsrMinutes = round((120 / 1) * 2) = 240.
    expect(summary.dsrMinutes).toBe(240);
  });

  it('returns 0 dsrMinutes when there is no overtime in the period', async () => {
    const summary = await service.getSummary('user-bdh-no-overtime', '2026-09-01', '2026-09-01');

    expect(summary.dsrMinutes).toBe(0);
  });

  describe('getTeamSummary', () => {
    it('aggregates every active employee, ordered by name, without the days array', async () => {
      const employees = await service.getTeamSummary('2026-09-01', '2026-09-01');

      const convencaoEntry = employees.find((e) => e.userId === 'user-bdh-convencao');
      expect(convencaoEntry?.userName).toBe('Com Convenio');
      expect(convencaoEntry?.hourlyRateBRL).toBeCloseTo(45.4545, 3);
      expect((convencaoEntry as unknown as { days?: unknown }).days).toBeUndefined();

      const names = employees.map((e) => e.userName);
      expect(names).toEqual([...names].sort());
    });
  });
});
