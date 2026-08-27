process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OnboardingService, PrismaService],
    }).compile();

    service = module.get(OnboardingService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onboardingProgress.deleteMany();
    await prisma.onboardingTask.deleteMany();
    await prisma.employee.deleteMany({
      where: { userId: { in: ['user-c', 'user-d'] } },
    });
    await prisma.onModuleDestroy();
  });

  it('returns tasks ordered and marks completed ones for the user', async () => {
    const task1 = await prisma.onboardingTask.create({
      data: {
        icon: 'document-outline',
        title: 'Contrato',
        description: 'Assine o contrato',
        order: 2,
      },
    });
    const task2 = await prisma.onboardingTask.create({
      data: {
        icon: 'key-outline',
        title: 'Acessos',
        description: 'Configure acessos',
        order: 1,
      },
    });
    await prisma.onboardingProgress.create({
      data: { userId: 'user-a', taskId: task1.id },
    });

    const result = await service.getTasks('user-a');

    expect(result.tasks.map((t) => t.id)).toEqual([task2.id, task1.id]);
    expect(result.completedTaskIds).toEqual([task1.id]);
  });

  it('toggles task completion on and off', async () => {
    const task = await prisma.onboardingTask.create({
      data: {
        icon: 'videocam-outline',
        title: 'Vídeo',
        description: 'Assista ao vídeo',
        order: 3,
      },
    });

    const toggledOn = await service.toggleTask('user-b', task.id);
    expect(toggledOn).toEqual({ completed: true });

    const toggledOff = await service.toggleTask('user-b', task.id);
    expect(toggledOff).toEqual({ completed: false });
  });

  it("summarizes each employee's onboarding progress against the total task count", async () => {
    const task = await prisma.onboardingTask.create({
      data: {
        icon: 'document-outline',
        title: 'Contrato',
        description: 'Assine o contrato',
        order: 1,
      },
    });
    await prisma.employee.create({
      data: {
        userId: 'user-c',
        name: 'Carla Onboarding',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });
    await prisma.employee.create({
      data: {
        userId: 'user-d',
        name: 'Davi Onboarding',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });
    await prisma.onboardingProgress.create({
      data: { userId: 'user-c', taskId: task.id },
    });

    const results = await service.listTeamProgress();

    const carla = results.find((r) => r.userId === 'user-c');
    const davi = results.find((r) => r.userId === 'user-d');
    expect(carla?.completedCount).toBe(1);
    expect(davi?.completedCount).toBe(0);
    expect(carla?.totalCount).toBe(davi?.totalCount);
    expect(carla?.completedTaskIds).toEqual([task.id]);
    expect(davi?.completedTaskIds).toEqual([]);
    expect(carla?.tasks.map((t) => t.id)).toContain(task.id);
  });
});
