import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CareerEvaluationSaveInput } from '@ponto-dcit/shared-types';
import {
  CAREER_LADDER,
  COMPETENCIA_CATEGORIA,
  ELEGIBILIDADE_MEDIA_MINIMA,
  calcularMediaGeral,
  calcularSubNivelIndex,
  subNivelLabel,
  type NivelEscada,
} from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CareerEvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getOpen(userId: string) {
    const evaluation = await this.prisma.careerEvaluation.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!evaluation) return null;
    return this.withChildren(evaluation);
  }

  private async withChildren<T extends { id: string }>(evaluation: T) {
    const [principios, competencias, requisitos] = await Promise.all([
      this.prisma.careerPrincipioScore.findMany({ where: { evaluationId: evaluation.id } }),
      this.prisma.careerCompetenciaScore.findMany({ where: { evaluationId: evaluation.id } }),
      this.prisma.careerRequisitoCheck.findMany({ where: { evaluationId: evaluation.id } }),
    ]);
    return { ...evaluation, principios, competencias, requisitos };
  }

  async save(evaluatorId: string, input: CareerEvaluationSaveInput) {
    const employee = await this.prisma.employee.findUniqueOrThrow({ where: { userId: input.userId } });
    const nivelAvaliado = (employee.nivel ?? 'junior') as NivelEscada;
    const proximoNivel = CAREER_LADDER[nivelAvaliado].proximoNivel;
    const requisitosLadder = proximoNivel ? CAREER_LADDER[proximoNivel].requisitos : [];
    const mediaGeral = calcularMediaGeral([
      ...input.principios.map((p) => p.nota),
      ...input.competencias.map((c) => c.nota),
    ]);
    // Every save re-derives which fixed degrau this cycle's média lands on,
    // and moves salarioMensal there — but never downward (a weaker cycle
    // must not cut pay that a stronger earlier cycle already earned).
    const subNivelIndex = calcularSubNivelIndex(mediaGeral);
    const salarioSubNivel = CAREER_LADDER[nivelAvaliado].degraus[subNivelIndex];
    const salarioAtual = employee.salarioMensal ?? 0;
    const novoSalario = Math.max(salarioAtual, salarioSubNivel);
    const salarioAumentou = novoSalario > salarioAtual;

    const evaluation = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.careerEvaluation.findFirst({
        where: { userId: input.userId, status: 'salva' },
        orderBy: { createdAt: 'desc' },
      });

      const evaluation = existing
        ? await tx.careerEvaluation.update({
            where: { id: existing.id },
            data: { evaluatorId, nivelAvaliado, proximoNivel, mediaGeral },
          })
        : await tx.careerEvaluation.create({
            data: { userId: input.userId, evaluatorId, nivelAvaliado, proximoNivel, mediaGeral, status: 'salva' },
          });

      if (existing) {
        await tx.careerPrincipioScore.deleteMany({ where: { evaluationId: evaluation.id } });
        await tx.careerCompetenciaScore.deleteMany({ where: { evaluationId: evaluation.id } });
        await tx.careerRequisitoCheck.deleteMany({ where: { evaluationId: evaluation.id } });
      }

      await tx.careerPrincipioScore.createMany({
        data: input.principios.map((p) => ({
          evaluationId: evaluation.id,
          principio: p.principio,
          nota: p.nota,
          justificativa: p.justificativa,
        })),
      });
      await tx.careerCompetenciaScore.createMany({
        data: input.competencias.map((c) => ({
          evaluationId: evaluation.id,
          categoria: COMPETENCIA_CATEGORIA[c.competencia],
          competencia: c.competencia,
          nota: c.nota,
          justificativa: c.justificativa,
        })),
      });
      if (requisitosLadder.length > 0) {
        await tx.careerRequisitoCheck.createMany({
          data: requisitosLadder.map((r) => ({
            evaluationId: evaluation.id,
            tipo: r.tipo,
            label: r.label,
            atendido: input.requisitosAtendidos.includes(r.label),
          })),
        });
      }

      if (salarioAumentou) {
        await tx.employee.update({ where: { userId: input.userId }, data: { salarioMensal: novoSalario } });
      }

      return evaluation;
    });

    if (salarioAumentou) {
      await this.notifications.sendCareerLevelUp(
        input.userId,
        subNivelLabel(nivelAvaliado, subNivelIndex),
        novoSalario,
        mediaGeral,
      );
    }

    return this.withChildren(evaluation);
  }

  async decidir(id: string, confirmarPromocao: boolean) {
    const evaluation = await this.prisma.careerEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('Avaliação não encontrada');
    if (evaluation.status === 'decidida') throw new BadRequestException('Avaliação já foi decidida');

    const requisitos = await this.prisma.careerRequisitoCheck.findMany({ where: { evaluationId: id } });
    const obrigatoriosOk = requisitos.filter((r) => r.tipo === 'obrigatorio').every((r) => r.atendido);
    const mediaOk = (evaluation.mediaGeral ?? 0) >= ELEGIBILIDADE_MEDIA_MINIMA;
    const elegivel = evaluation.proximoNivel !== null && obrigatoriosOk && mediaOk;
    const resultado = elegivel ? 'promovido' : 'em_desenvolvimento';

    return this.prisma.$transaction(async (tx) => {
      const decided = await tx.careerEvaluation.update({
        where: { id },
        data: { status: 'decidida', resultado, decidedAt: new Date() },
      });
      if (resultado === 'promovido' && confirmarPromocao && evaluation.proximoNivel) {
        const primeiroDegrau = CAREER_LADDER[evaluation.proximoNivel as NivelEscada].degraus[0];
        const employeeAtual = await tx.employee.findUniqueOrThrow({ where: { userId: evaluation.userId } });
        const novoSalario = Math.max(employeeAtual.salarioMensal ?? 0, primeiroDegrau);
        await tx.employee.update({
          where: { userId: evaluation.userId },
          data: { nivel: evaluation.proximoNivel, salarioMensal: novoSalario },
        });
      }
      return decided;
    });
  }
}
