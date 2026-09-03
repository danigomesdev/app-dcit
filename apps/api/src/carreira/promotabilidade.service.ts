import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type StatusPromotabilidade = 'verde' | 'amarelo' | 'branco';

type Avaliacao = { proatividade: number; trabalhoEquipe: number; comunicacao: number; lideranca: number };

// hireDate/now are calendar dates (not timestamps we care about the time-of-day
// of), so this uses UTC getters rather than local ones — matching this
// codebase's convention (see documentos.service.ts's parseDateBR,
// operacional.service.ts's week math) for date-only arithmetic that must not
// drift depending on the server's local timezone.
function diffInMonths(from: Date, to: Date): number {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  // A month only counts as fully elapsed once the day-of-month has been
  // reached or passed — e.g. hireDate 2025-12-31 to now 2026-03-01 is a
  // naive 3 calendar months apart, but only ~2 months and 1 day have
  // actually elapsed.
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months;
}

function mediaAvaliacao(avaliacao: Avaliacao): number {
  return (avaliacao.proatividade + avaliacao.trabalhoEquipe + avaliacao.comunicacao + avaliacao.lideranca) / 4;
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

  // `.every()` is vacuously true on an empty array, so each category must
  // also be non-empty to count as genuinely fulfilled — otherwise an
  // employee with e.g. zero track requirements could reach verde without a
  // single requirement ever having been tracked for them.
  const todosRequisitosOk = input.requisitos.length > 0 && input.requisitos.every((r) => r.status === 'concluido');
  const todasMetasOk = input.metasPdi.length > 0 && input.metasPdi.every((m) => m.status === 'concluida');
  const mediaOk = input.ultimaAvaliacao !== null && mediaAvaliacao(input.ultimaAvaliacao) >= 4;

  if (todosRequisitosOk && todasMetasOk && mediaOk) return 'verde';
  return 'amarelo';
}

type DetalheInput = {
  hireDate: Date;
  now: Date;
  requisitos: { status: string }[];
  metasPdi: { status: string }[];
  ultimaAvaliacao: Avaliacao | null;
};

// Shared by both getOne (single-employee fetch) and listAll (batched fetch) —
// only the data-fetching differs between the two call sites; the branching
// logic itself lives in exactly one place.
function calcularDetalhe(input: DetalheInput) {
  return {
    status: calcularStatusPromotabilidade(input),
    mesesDeCasa: diffInMonths(input.hireDate, input.now),
    requisitosPendentes: input.requisitos.filter((r) => r.status !== 'concluido').length,
    metasPendentes: input.metasPdi.filter((m) => m.status !== 'concluida').length,
    ultimaMediaAvaliacao: input.ultimaAvaliacao ? mediaAvaliacao(input.ultimaAvaliacao) : null,
  };
}

function agruparPorUsuario<T extends { userId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const lista = map.get(row.userId);
    if (lista) lista.push(row);
    else map.set(row.userId, [row]);
  }
  return map;
}

function maisRecentePorUsuario<T extends { userId: string; date: Date }>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const atual = map.get(row.userId);
    if (!atual || row.date > atual.date) map.set(row.userId, row);
  }
  return map;
}

@Injectable()
export class PromotabilidadeService {
  constructor(private readonly prisma: PrismaService) {}

  // Batched: one findMany per data source across the whole roster, then
  // in-memory grouping/lookup per employee — matches this codebase's
  // established pattern for whole-roster summaries (see
  // onboarding.service.ts's listTeamProgress) instead of N sequential
  // per-employee query rounds.
  async listAll(): Promise<Record<string, StatusPromotabilidade>> {
    const now = new Date();
    const employees = await this.prisma.employee.findMany({ where: { deletedAt: null } });
    const userIds = employees.map((e) => e.userId);

    const [requisitos, metasPdi, avaliacoes] = await Promise.all([
      this.prisma.trackRequirement.findMany({ where: { userId: { in: userIds } } }),
      this.prisma.careerGoal.findMany({ where: { userId: { in: userIds }, tipo: 'pdi' } }),
      this.prisma.performanceEvaluation.findMany({ where: { userId: { in: userIds } } }),
    ]);

    const requisitosByUser = agruparPorUsuario(requisitos);
    const metasByUser = agruparPorUsuario(metasPdi);
    const ultimaAvaliacaoByUser = maisRecentePorUsuario(avaliacoes);

    const result: Record<string, StatusPromotabilidade> = {};
    for (const employee of employees) {
      const detalhe = calcularDetalhe({
        hireDate: employee.hireDate,
        now,
        requisitos: requisitosByUser.get(employee.userId) ?? [],
        metasPdi: metasByUser.get(employee.userId) ?? [],
        ultimaAvaliacao: ultimaAvaliacaoByUser.get(employee.userId) ?? null,
      });
      result[employee.userId] = detalhe.status;
    }
    return result;
  }

  async getOne(userId: string) {
    const employee = await this.prisma.employee.findUniqueOrThrow({ where: { userId } });
    const now = new Date();
    const [requisitos, metasPdi, ultimaAvaliacao] = await Promise.all([
      this.prisma.trackRequirement.findMany({ where: { userId } }),
      this.prisma.careerGoal.findMany({ where: { userId, tipo: 'pdi' } }),
      this.prisma.performanceEvaluation.findFirst({ where: { userId }, orderBy: { date: 'desc' } }),
    ]);
    return calcularDetalhe({ hireDate: employee.hireDate, now, requisitos, metasPdi, ultimaAvaliacao });
  }
}
