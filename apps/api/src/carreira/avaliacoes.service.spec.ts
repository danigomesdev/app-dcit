process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceEvaluationsService } from './avaliacoes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PerformanceEvaluationsService', () => {
  let service: PerformanceEvaluationsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PerformanceEvaluationsService, PrismaService],
    }).compile();
    service = module.get(PerformanceEvaluationsService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.performanceEvaluation.deleteMany({ where: { userId: 'avaliacoes-spec-user' } });
    await prisma.onModuleDestroy();
  });

  it('creates an evaluation with the given evaluatorId, never from input', async () => {
    const evaluation = await service.create('gestor-1', {
      userId: 'avaliacoes-spec-user',
      proatividade: 4,
      trabalhoEquipe: 5,
      comunicacao: 4,
      lideranca: 3,
    });
    expect(evaluation.evaluatorId).toBe('gestor-1');
  });

  it('lists evaluations for the user ordered most-recent first', async () => {
    const first = await service.create('gestor-1', {
      userId: 'avaliacoes-spec-user',
      proatividade: 3,
      trabalhoEquipe: 3,
      comunicacao: 3,
      lideranca: 3,
    });
    const second = await service.create('gestor-1', {
      userId: 'avaliacoes-spec-user',
      proatividade: 5,
      trabalhoEquipe: 5,
      comunicacao: 5,
      lideranca: 5,
    });
    const evaluations = await service.list('avaliacoes-spec-user');
    expect(evaluations[0].id).toBe(second.id);
    expect(evaluations.some((e) => e.id === first.id)).toBe(true);
  });
});
