process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { PromotabilidadeService, calcularStatusPromotabilidade } from './promotabilidade.service';
import { PrismaService } from '../prisma/prisma.service';

describe('calcularStatusPromotabilidade (pure function)', () => {
  const now = new Date('2026-09-02T00:00:00.000Z');

  it('returns branco when tenure is under 3 months, even with everything else complete', () => {
    const status = calcularStatusPromotabilidade({
      hireDate: new Date('2026-08-01'),
      now,
      requisitos: [{ status: 'concluido' }],
      metasPdi: [{ status: 'concluida' }],
      ultimaAvaliacao: { proatividade: 5, trabalhoEquipe: 5, comunicacao: 5, lideranca: 5 },
    });
    expect(status).toBe('branco');
  });

  it('returns branco when tenure is enough but nothing was ever registered', () => {
    const status = calcularStatusPromotabilidade({
      hireDate: new Date('2025-01-01'),
      now,
      requisitos: [],
      metasPdi: [],
      ultimaAvaliacao: null,
    });
    expect(status).toBe('branco');
  });

  it('returns amarelo when tenure is enough and something started, but not everything is complete', () => {
    const status = calcularStatusPromotabilidade({
      hireDate: new Date('2025-01-01'),
      now,
      requisitos: [{ status: 'pendente' }],
      metasPdi: [{ status: 'concluida' }],
      ultimaAvaliacao: { proatividade: 5, trabalhoEquipe: 5, comunicacao: 5, lideranca: 5 },
    });
    expect(status).toBe('amarelo');
  });

  it('returns amarelo when everything is complete but the average score is below 4', () => {
    const status = calcularStatusPromotabilidade({
      hireDate: new Date('2025-01-01'),
      now,
      requisitos: [{ status: 'concluido' }],
      metasPdi: [{ status: 'concluida' }],
      ultimaAvaliacao: { proatividade: 4, trabalhoEquipe: 4, comunicacao: 3, lideranca: 4 }, // média 3.75
    });
    expect(status).toBe('amarelo');
  });

  it('returns verde when tenure, requisitos, metas and average score (exactly 4) are all met', () => {
    const status = calcularStatusPromotabilidade({
      hireDate: new Date('2025-01-01'),
      now,
      requisitos: [{ status: 'concluido' }],
      metasPdi: [{ status: 'concluida' }],
      ultimaAvaliacao: { proatividade: 4, trabalhoEquipe: 4, comunicacao: 4, lideranca: 4 },
    });
    expect(status).toBe('verde');
  });

  it('returns amarelo (not verde) when track requirements are empty even though metas and avaliação qualify — no vacuous truth', () => {
    const status = calcularStatusPromotabilidade({
      hireDate: new Date('2025-01-01'),
      now,
      requisitos: [],
      metasPdi: [{ status: 'concluida' }],
      ultimaAvaliacao: { proatividade: 4, trabalhoEquipe: 4, comunicacao: 4, lideranca: 4 },
    });
    expect(status).toBe('amarelo');
  });

  it('does not count a month as complete until the day-of-month has been reached (day-aware tenure)', () => {
    // Dec 31 -> Mar 1 is 3 calendar months by naive year/month subtraction,
    // but only ~2 months and 1 day have actually elapsed — day 1 hasn't
    // reached day 31 yet, so the 3rd month isn't complete.
    const status = calcularStatusPromotabilidade({
      hireDate: new Date('2025-12-31'),
      now: new Date('2026-03-01'),
      requisitos: [{ status: 'concluido' }],
      metasPdi: [{ status: 'concluida' }],
      ultimaAvaliacao: { proatividade: 4, trabalhoEquipe: 4, comunicacao: 4, lideranca: 4 },
    });
    expect(status).toBe('branco');
  });

  it('treats exactly 3 months of tenure (same day-of-month) as meeting the minimum', () => {
    const status = calcularStatusPromotabilidade({
      hireDate: new Date('2026-06-02'),
      now: new Date('2026-09-02'),
      requisitos: [{ status: 'concluido' }],
      metasPdi: [{ status: 'concluida' }],
      ultimaAvaliacao: { proatividade: 4, trabalhoEquipe: 4, comunicacao: 4, lideranca: 4 },
    });
    expect(status).toBe('verde');
  });

  it('treats 2 months of tenure as under the minimum (branco)', () => {
    const status = calcularStatusPromotabilidade({
      hireDate: new Date('2026-07-02'),
      now: new Date('2026-09-02'),
      requisitos: [{ status: 'concluido' }],
      metasPdi: [{ status: 'concluida' }],
      ultimaAvaliacao: { proatividade: 4, trabalhoEquipe: 4, comunicacao: 4, lideranca: 4 },
    });
    expect(status).toBe('branco');
  });
});

describe('PromotabilidadeService', () => {
  let service: PromotabilidadeService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromotabilidadeService, PrismaService],
    }).compile();
    service = module.get(PromotabilidadeService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
    await prisma.employee.create({
      data: {
        userId: 'promotabilidade-spec-user',
        name: 'Promotabilidade Spec',
        role: 'colaborador',
        hireDate: new Date('2025-01-01'),
      },
    });
    await prisma.employee.create({
      data: {
        userId: 'promotabilidade-spec-user-2',
        name: 'Promotabilidade Spec 2',
        role: 'colaborador',
        hireDate: new Date('2025-01-01'),
      },
    });
    await prisma.trackRequirement.create({
      data: { userId: 'promotabilidade-spec-user-2', title: 'Requisito', status: 'concluido' },
    });
    await prisma.careerGoal.create({
      data: { userId: 'promotabilidade-spec-user-2', tipo: 'pdi', title: 'Meta', status: 'concluida' },
    });
    await prisma.performanceEvaluation.create({
      data: {
        userId: 'promotabilidade-spec-user-2',
        evaluatorId: 'promotabilidade-spec-evaluator',
        proatividade: 4,
        trabalhoEquipe: 4,
        comunicacao: 4,
        lideranca: 4,
      },
    });
  });

  afterAll(async () => {
    await prisma.performanceEvaluation.deleteMany({
      where: { userId: { in: ['promotabilidade-spec-user', 'promotabilidade-spec-user-2'] } },
    });
    await prisma.trackRequirement.deleteMany({
      where: { userId: { in: ['promotabilidade-spec-user', 'promotabilidade-spec-user-2'] } },
    });
    await prisma.careerGoal.deleteMany({
      where: { userId: { in: ['promotabilidade-spec-user', 'promotabilidade-spec-user-2'] } },
    });
    await prisma.employee.delete({ where: { userId: 'promotabilidade-spec-user' } });
    await prisma.employee.delete({ where: { userId: 'promotabilidade-spec-user-2' } });
    await prisma.onModuleDestroy();
  });

  it('listAll includes a branco entry for an employee with nothing registered', async () => {
    const all = await service.listAll();
    expect(all['promotabilidade-spec-user']).toBe('branco');
  });

  it('listAll reports each employee independently from batched queries (no cross-contamination)', async () => {
    const all = await service.listAll();
    expect(all['promotabilidade-spec-user']).toBe('branco');
    expect(all['promotabilidade-spec-user-2']).toBe('verde');
  });

  it('getOne reports the same status as listAll for the same employee', async () => {
    const detail = await service.getOne('promotabilidade-spec-user');
    expect(detail.status).toBe('branco');
  });
});
