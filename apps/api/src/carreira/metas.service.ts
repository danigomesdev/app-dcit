import { Injectable } from '@nestjs/common';
import type { CareerGoalCreateInput } from '@ponto-dcit/shared-types';
import { CAREER_LADDER, type NivelEscada } from '@ponto-dcit/shared-types';
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

  async updateStatus(id: string, status: string) {
    const previous = await this.prisma.careerGoal.findUnique({ where: { id } });
    const updated = await this.prisma.careerGoal.update({ where: { id }, data: { status } });
    if (status === 'concluida' && previous?.status !== 'concluida') {
      await this.advanceSalaryStep(updated.userId);
    }
    return updated;
  }

  private async advanceSalaryStep(userId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee?.nivel || employee.salarioMensal === null) return;

    const degraus = CAREER_LADDER[employee.nivel as NivelEscada]?.degraus;
    if (!degraus) return;

    // Índice do degrau mais alto que o colaborador já atingiu (<= salário atual).
    let currentStepIndex = -1;
    for (let i = 0; i < degraus.length; i++) {
      if (degraus[i] <= employee.salarioMensal) currentStepIndex = i;
    }
    if (currentStepIndex === -1 || currentStepIndex >= degraus.length - 1) return;

    await this.prisma.employee.update({
      where: { userId },
      data: { salarioMensal: degraus[currentStepIndex + 1] },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.careerGoal.delete({ where: { id } });
  }
}
