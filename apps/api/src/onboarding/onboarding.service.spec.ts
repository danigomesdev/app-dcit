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
});
