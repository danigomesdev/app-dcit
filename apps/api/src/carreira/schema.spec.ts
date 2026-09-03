process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';

describe('carreira Prisma models', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
    await prisma.employee.create({
      data: {
        userId: 'schema-spec-employee',
        name: 'Schema Spec Employee',
        role: 'colaborador',
        hireDate: new Date('2025-01-01'),
      },
    });
  });

  afterAll(async () => {
    await prisma.oneOnOneAcao.deleteMany();
    await prisma.oneOnOne.deleteMany();
    await prisma.nineBoxPlacement.deleteMany();
    await prisma.performanceEvaluation.deleteMany();
    await prisma.trackRequirement.deleteMany();
    await prisma.careerGoal.deleteMany();
    await prisma.employee.delete({ where: { userId: 'schema-spec-employee' } });
    await prisma.onModuleDestroy();
  });

  it('creates and reads a CareerGoal', async () => {
    const goal = await prisma.careerGoal.create({
      data: { userId: 'schema-spec-employee', tipo: 'pdi', title: 'Tirar certificação' },
    });
    expect(goal.status).toBe('pendente');
  });

  it('creates and reads a TrackRequirement', async () => {
    const req = await prisma.trackRequirement.create({
      data: { userId: 'schema-spec-employee', title: 'Certificação AWS' },
    });
    expect(req.status).toBe('pendente');
  });

  it('creates and reads a PerformanceEvaluation', async () => {
    const evaluation = await prisma.performanceEvaluation.create({
      data: {
        userId: 'schema-spec-employee',
        evaluatorId: 'schema-spec-gestor',
        proatividade: 4,
        trabalhoEquipe: 4,
        comunicacao: 4,
        lideranca: 4,
      },
    });
    expect(evaluation.proatividade).toBe(4);
  });

  it('creates and reads a NineBoxPlacement', async () => {
    const placement = await prisma.nineBoxPlacement.create({
      data: {
        userId: 'schema-spec-employee',
        gestorId: 'schema-spec-gestor',
        desempenho: 'alto',
        potencial: 'medio',
      },
    });
    expect(placement.desempenho).toBe('alto');
  });

  it('creates a OneOnOne with its acoes', async () => {
    const oneOnOne = await prisma.oneOnOne.create({
      data: { userId: 'schema-spec-employee', gestorId: 'schema-spec-gestor', pauta: 'Alinhamento mensal' },
    });
    const acao = await prisma.oneOnOneAcao.create({
      data: { oneOnOneId: oneOnOne.id, descricao: 'Enviar relatório' },
    });
    expect(acao.status).toBe('pendente');
  });
});
