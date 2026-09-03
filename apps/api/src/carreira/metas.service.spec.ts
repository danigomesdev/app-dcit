process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { CareerGoalsService } from './metas.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CareerGoalsService', () => {
  let service: CareerGoalsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CareerGoalsService, PrismaService],
    }).compile();
    service = module.get(CareerGoalsService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.careerGoal.deleteMany({ where: { userId: 'metas-spec-user' } });
    await prisma.onModuleDestroy();
  });

  it('creates a goal defaulting to pendente', async () => {
    const goal = await service.create({ userId: 'metas-spec-user', tipo: 'pdi', title: 'Certificação Azure' });
    expect(goal.status).toBe('pendente');
    expect(goal.tipo).toBe('pdi');
  });

  it('lists only goals for the given user', async () => {
    await service.create({ userId: 'metas-spec-other', tipo: 'entrega', title: 'Projeto X' });
    const goals = await service.list('metas-spec-user');
    expect(goals.every((g) => g.userId === 'metas-spec-user')).toBe(true);
  });

  it('updates status', async () => {
    const goal = await service.create({ userId: 'metas-spec-user', tipo: 'entrega', title: 'Projeto Y' });
    const updated = await service.updateStatus(goal.id, 'concluida');
    expect(updated.status).toBe('concluida');
  });

  it('removes a goal', async () => {
    const goal = await service.create({ userId: 'metas-spec-user', tipo: 'pdi', title: 'Temp' });
    await service.remove(goal.id);
    const goals = await service.list('metas-spec-user');
    expect(goals.find((g) => g.id === goal.id)).toBeUndefined();
  });
});
