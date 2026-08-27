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

  async listTeamProgress() {
    const [totalCount, employees, progress] = await Promise.all([
      this.prisma.onboardingTask.count(),
      this.prisma.employee.findMany(),
      this.prisma.onboardingProgress.findMany(),
    ]);
    const completedByUser = new Map<string, number>();
    for (const entry of progress) {
      completedByUser.set(
        entry.userId,
        (completedByUser.get(entry.userId) ?? 0) + 1,
      );
    }
    return employees.map((employee) => ({
      userId: employee.userId,
      userName: employee.name,
      completedCount: completedByUser.get(employee.userId) ?? 0,
      totalCount,
    }));
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
