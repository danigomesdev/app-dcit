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
    await prisma.careerGoal.deleteMany({ where: { userId: { in: ['metas-spec-user', 'metas-spec-salary-user'] } } });
    await prisma.employee.deleteMany({ where: { userId: 'metas-spec-salary-user' } });
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

  describe('salary-step progression on goal completion', () => {
    beforeAll(async () => {
      await prisma.employee.create({
        data: {
          userId: 'metas-spec-salary-user',
          name: 'Bruno Teste',
          role: 'colaborador',
          nivel: 'pleno',
          salarioMensal: 4000,
          hireDate: new Date('2024-01-01'),
        },
      });
    });

    it('advances salarioMensal to the next fixed step when a goal is completed', async () => {
      const goal = await service.create({ userId: 'metas-spec-salary-user', tipo: 'entrega', title: 'Entrega X' });
      await service.updateStatus(goal.id, 'concluida');
      const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: 'metas-spec-salary-user' } });
      expect(employee.salarioMensal).toBe(4700); // pleno's second degrau
    });

    it('does not advance again when the same goal is re-saved as concluida (idempotent)', async () => {
      const goal = await service.create({ userId: 'metas-spec-salary-user', tipo: 'pdi', title: 'PDI Y' });
      await service.updateStatus(goal.id, 'concluida');
      const afterFirst = await prisma.employee.findUniqueOrThrow({ where: { userId: 'metas-spec-salary-user' } });
      await service.updateStatus(goal.id, 'concluida');
      const afterSecond = await prisma.employee.findUniqueOrThrow({ where: { userId: 'metas-spec-salary-user' } });
      expect(afterSecond.salarioMensal).toBe(afterFirst.salarioMensal);
    });

    it('does not advance past the top step of the current nível', async () => {
      await prisma.employee.update({ where: { userId: 'metas-spec-salary-user' }, data: { salarioMensal: 6200 } }); // pleno's top step
      const goal = await service.create({ userId: 'metas-spec-salary-user', tipo: 'entrega', title: 'Entrega Z' });
      await service.updateStatus(goal.id, 'concluida');
      const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: 'metas-spec-salary-user' } });
      expect(employee.salarioMensal).toBe(6200); // capped, no auto level-up
    });

    it('does not change salarioMensal when moving to a non-concluida status', async () => {
      await prisma.employee.update({ where: { userId: 'metas-spec-salary-user' }, data: { salarioMensal: 4000 } });
      const goal = await service.create({ userId: 'metas-spec-salary-user', tipo: 'entrega', title: 'Entrega W' });
      await service.updateStatus(goal.id, 'andamento');
      const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: 'metas-spec-salary-user' } });
      expect(employee.salarioMensal).toBe(4000);
    });
  });
});
