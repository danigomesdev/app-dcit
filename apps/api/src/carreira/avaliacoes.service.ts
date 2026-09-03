import { Injectable } from '@nestjs/common';
import type { PerformanceEvaluationCreateInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PerformanceEvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.performanceEvaluation.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  create(evaluatorId: string, input: PerformanceEvaluationCreateInput) {
    return this.prisma.performanceEvaluation.create({
      data: {
        userId: input.userId,
        evaluatorId,
        proatividade: input.proatividade,
        trabalhoEquipe: input.trabalhoEquipe,
        comunicacao: input.comunicacao,
        lideranca: input.lideranca,
        comentario: input.comentario,
      },
    });
  }
}
