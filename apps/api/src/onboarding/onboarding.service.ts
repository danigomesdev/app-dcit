import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getTasks(userId: string) {
    const [tasks, progress] = await Promise.all([
      this.prisma.onboardingTask.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.onboardingProgress.findMany({ where: { userId } }),
    ]);
    return { tasks, completedTaskIds: progress.map((p) => p.taskId) };
  }

  async toggleTask(userId: string, taskId: string) {
    const existing = await this.prisma.onboardingProgress.findUnique({
      where: { userId_taskId: { userId, taskId } },
    });

    if (existing) {
      await this.prisma.onboardingProgress.delete({
        where: { id: existing.id },
      });
      return { completed: false };
    }
    await this.prisma.onboardingProgress.create({ data: { userId, taskId } });
    return { completed: true };
  }
}
