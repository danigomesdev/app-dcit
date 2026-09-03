import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type StatusPromotabilidade = 'verde' | 'amarelo' | 'branco';

type Avaliacao = { proatividade: number; trabalhoEquipe: number; comunicacao: number; lideranca: number };

function diffInMonths(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

export function calcularStatusPromotabilidade(input: {
  hireDate: Date;
  now: Date;
  requisitos: { status: string }[];
  metasPdi: { status: string }[];
  ultimaAvaliacao: Avaliacao | null;
}): StatusPromotabilidade {
  const mesesDeCasa = diffInMonths(input.hireDate, input.now);
  if (mesesDeCasa < 3) return 'branco';

  const nadaRegistrado = input.requisitos.length === 0 && input.metasPdi.length === 0 && !input.ultimaAvaliacao;
  if (nadaRegistrado) return 'branco';

  const todosRequisitosOk = input.requisitos.every((r) => r.status === 'concluido');
  const todasMetasOk = input.metasPdi.every((m) => m.status === 'concluida');
  const mediaAvaliacao = input.ultimaAvaliacao
    ? (input.ultimaAvaliacao.proatividade +
        input.ultimaAvaliacao.trabalhoEquipe +
        input.ultimaAvaliacao.comunicacao +
        input.ultimaAvaliacao.lideranca) /
      4
    : 0;

  if (todosRequisitosOk && todasMetasOk && mediaAvaliacao >= 4) return 'verde';
  return 'amarelo';
}

@Injectable()
export class PromotabilidadeService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(): Promise<Record<string, StatusPromotabilidade>> {
    const employees = await this.prisma.employee.findMany({ where: { deletedAt: null } });
    const now = new Date();
    const result: Record<string, StatusPromotabilidade> = {};
    for (const employee of employees) {
      const detail = await this.calcularDetalhe(employee.userId, employee.hireDate, now);
      result[employee.userId] = detail.status;
    }
    return result;
  }

  async getOne(userId: string) {
    const employee = await this.prisma.employee.findUniqueOrThrow({ where: { userId } });
    return this.calcularDetalhe(userId, employee.hireDate, new Date());
  }

  private async calcularDetalhe(userId: string, hireDate: Date, now: Date) {
    const [requisitos, metasPdi, ultimaAvaliacao] = await Promise.all([
      this.prisma.trackRequirement.findMany({ where: { userId } }),
      this.prisma.careerGoal.findMany({ where: { userId, tipo: 'pdi' } }),
      this.prisma.performanceEvaluation.findFirst({ where: { userId }, orderBy: { date: 'desc' } }),
    ]);
    const status = calcularStatusPromotabilidade({ hireDate, now, requisitos, metasPdi, ultimaAvaliacao });
    return {
      status,
      mesesDeCasa: diffInMonths(hireDate, now),
      requisitosPendentes: requisitos.filter((r) => r.status !== 'concluido').length,
      metasPendentes: metasPdi.filter((m) => m.status !== 'concluida').length,
      ultimaMediaAvaliacao: ultimaAvaliacao
        ? (ultimaAvaliacao.proatividade +
            ultimaAvaliacao.trabalhoEquipe +
            ultimaAvaliacao.comunicacao +
            ultimaAvaliacao.lideranca) /
          4
        : null,
    };
  }
}
