import { Injectable } from '@nestjs/common';
import type { CareerGoalCreateInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CareerGoalsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.careerGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: CareerGoalCreateInput) {
    return this.prisma.careerGoal.create({
      data: {
        userId: input.userId,
        tipo: input.tipo,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      },
    });
  }

  updateStatus(id: string, status: string) {
    return this.prisma.careerGoal.update({ where: { id }, data: { status } });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.careerGoal.delete({ where: { id } });
  }
}
