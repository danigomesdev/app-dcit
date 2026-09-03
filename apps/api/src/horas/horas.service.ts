import { Injectable } from '@nestjs/common';
import type { PeriodoHoras, WorkedHoursEntryCreateInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { todaySaoPauloDateOnly } from '../common/sao-paulo-time';

// Parses an already-resolved "YYYY-MM-DD" as UTC midnight directly — never
// re-runs it through a São-Paulo conversion function a second time. That
// double-shift is the exact bug class documented in the Ponto Perdido
// sub-project (see apps/api/src/ponto-perdido — a symbolic UTC-midnight date
// run through dateOnlyInSaoPaulo again subtracts a day it shouldn't).
function mondayOfWeek(dateOnly: string): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  const day = date.getUTCDay(); // 0=Sunday..6=Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return date.toISOString().slice(0, 10);
}

function sundayOfWeek(dateOnly: string): string {
  const monday = new Date(`${mondayOfWeek(dateOnly)}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() + 6);
  return monday.toISOString().slice(0, 10);
}

function firstDayOfMonth(dateOnly: string): string {
  return `${dateOnly.slice(0, 7)}-01`;
}

function lastDayOfMonth(dateOnly: string): string {
  const [year, month] = dateOnly.split('-').map(Number);
  // Day 0 of the next month is the last day of this month — a standard
  // Date trick, safe here because everything stays in UTC.
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

export function resolvePeriodoRange(periodo: PeriodoHoras, today: string): { start: string; end: string } {
  if (periodo === 'dia') return { start: today, end: today };
  if (periodo === 'semana') return { start: mondayOfWeek(today), end: sundayOfWeek(today) };
  return { start: firstDayOfMonth(today), end: lastDayOfMonth(today) };
}

export function sumEntriesByUser(
  entries: { userId: string; horasTrabalhadas: number; horasTickets: number }[],
): Map<string, { horasTrabalhadas: number; horasTickets: number }> {
  const totals = new Map<string, { horasTrabalhadas: number; horasTickets: number }>();
  for (const entry of entries) {
    const current = totals.get(entry.userId) ?? { horasTrabalhadas: 0, horasTickets: 0 };
    current.horasTrabalhadas += entry.horasTrabalhadas;
    current.horasTickets += entry.horasTickets;
    totals.set(entry.userId, current);
  }
  return totals;
}

@Injectable()
export class HorasService {
  constructor(private readonly prisma: PrismaService) {}

  lancar(input: WorkedHoursEntryCreateInput, gestorId: string) {
    const date = new Date(`${input.date}T00:00:00.000Z`);
    return this.prisma.workedHoursEntry.upsert({
      where: { userId_date: { userId: input.userId, date } },
      create: {
        userId: input.userId,
        gestorId,
        date,
        horasTrabalhadas: input.horasTrabalhadas,
        horasTickets: input.horasTickets,
      },
      update: {
        gestorId,
        horasTrabalhadas: input.horasTrabalhadas,
        horasTickets: input.horasTickets,
      },
    });
  }

  // Batched: one findMany for all active employees, one findMany for all
  // entries in the range, summed in JS — matches this codebase's established
  // pattern for whole-roster summaries (see promotabilidade.service.ts's
  // listAll) instead of a query-per-employee loop.
  async resumo(periodo: PeriodoHoras) {
    const today = todaySaoPauloDateOnly();
    const { start, end } = resolvePeriodoRange(periodo, today);
    const rangeStart = new Date(`${start}T00:00:00.000Z`);
    const rangeEnd = new Date(`${end}T23:59:59.999Z`);

    const [employees, entries] = await Promise.all([
      this.prisma.employee.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
      this.prisma.workedHoursEntry.findMany({
        where: { date: { gte: rangeStart, lte: rangeEnd } },
      }),
    ]);

    const totals = sumEntriesByUser(entries);

    return employees.map((employee) => {
      const total = totals.get(employee.userId) ?? { horasTrabalhadas: 0, horasTickets: 0 };
      return {
        userId: employee.userId,
        name: employee.name,
        horasTrabalhadas: total.horasTrabalhadas,
        horasTickets: total.horasTickets,
      };
    });
  }

  list(userId: string, periodo: PeriodoHoras) {
    const today = todaySaoPauloDateOnly();
    const { start, end } = resolvePeriodoRange(periodo, today);
    return this.prisma.workedHoursEntry.findMany({
      where: {
        userId,
        date: { gte: new Date(`${start}T00:00:00.000Z`), lte: new Date(`${end}T23:59:59.999Z`) },
      },
      orderBy: { date: 'desc' },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.workedHoursEntry.delete({ where: { id } });
  }
}
