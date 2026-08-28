import { Injectable } from '@nestjs/common';
import { TimeEntryInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import {
  dateOnlyInSaoPaulo,
  isWeekend,
  minutesSinceMidnight,
  nowSaoPauloTimeOnly,
  todaySaoPauloDateOnly,
} from '../common/sao-paulo-time';

@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: TimeEntryInput) {
    return this.prisma.timeEntry.create({
      data: {
        userId: input.userId,
        clockedAt: new Date(input.clockedAt),
      },
    });
  }

  listForUser(userId: string) {
    return this.prisma.timeEntry.findMany({
      where: { userId },
      orderBy: { clockedAt: 'asc' },
    });
  }

  // Same pairing rule as the mobile app's summarizeDay (ponto-context.tsx):
  // sequential punches alternate clock-in/clock-out. Which TimeEntry rows
  // count as "today" stays UTC-based (server clock), matching the rest of
  // this method's pre-existing behavior — only the *business* notion of
  // "today" used for the weekend/férias/atestado/atraso checks below is
  // São Paulo-aware (see ../common/sao-paulo-time).
  async listTeamToday() {
    const employees = await this.prisma.employee.findMany({
      orderBy: { name: 'asc' },
    });
    const userIds = employees.map((employee) => employee.userId);

    const todayKey = new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(`${todayKey}T00:00:00.000Z`);
    const endOfDay = new Date(`${todayKey}T23:59:59.999Z`);

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        userId: { in: userIds },
        clockedAt: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { clockedAt: 'asc' },
    });

    const todaySP = todaySaoPauloDateOnly();
    const todaySPMidnightUTC = new Date(`${todaySP}T00:00:00.000Z`);
    const weekend = isWeekend(todaySP);
    const nowSPMinutes = minutesSinceMidnight(nowSaoPauloTimeOnly());

    const vacations = await this.prisma.vacationRequest.findMany({
      where: {
        userId: { in: userIds },
        status: 'aprovado',
        startDate: { lte: todaySPMidnightUTC },
        endDate: { gte: todaySPMidnightUTC },
      },
    });
    const vacationByUserId = new Map(vacations.map((v) => [v.userId, v]));

    // Not filtered by createdAt in the query: createdAt carries a
    // time-of-day (submission moment), so a same-day submission after
    // midnight would wrongly fail a date-only `lte` comparison at the DB
    // level. The period-coverage check below (date-only, in memory) is the
    // real filter.
    const atestados = await this.prisma.atestado.findMany({
      where: {
        userId: { in: userIds },
        status: 'aprovado',
        dias: { not: null },
      },
    });
    const atestadoByUserId = new Map<
      string,
      { periodStart: Date; periodEnd: Date }
    >();
    for (const atestado of atestados) {
      const periodStart = new Date(
        `${dateOnlyInSaoPaulo(atestado.createdAt)}T00:00:00.000Z`,
      );
      const periodEnd = new Date(periodStart);
      periodEnd.setUTCDate(periodEnd.getUTCDate() + (atestado.dias ?? 0));
      // periodStart is always <= today (createdAt can't be in the future),
      // so the only real bound to check is the upper one.
      if (todaySPMidnightUTC < periodEnd) {
        atestadoByUserId.set(atestado.userId, { periodStart, periodEnd });
      }
    }

    return employees.map((employee) => {
      const dayEntries = entries.filter(
        (entry) => entry.userId === employee.userId,
      );

      let workedMinutes = 0;
      for (let i = 0; i + 1 < dayEntries.length; i += 2) {
        workedMinutes +=
          (dayEntries[i + 1].clockedAt.getTime() -
            dayEntries[i].clockedAt.getTime()) /
          60000;
      }

      const base = {
        userId: employee.userId,
        name: employee.name,
        entries: dayEntries.map((entry) => ({
          id: entry.id,
          clockedAt: entry.clockedAt,
        })),
        workedMinutes: Math.round(workedMinutes),
        // Declared here (not just on the ferias/atestado branches below) so
        // every branch's return type shares the same shape — otherwise
        // `periodStart`/`periodEnd` don't exist on the other branches'
        // inferred types and accessing them on the caller's union (e.g.
        // `result.find(...)?.periodStart`) is a compile error, not just a
        // runtime-safe `undefined`.
        periodStart: undefined as Date | undefined,
        periodEnd: undefined as Date | undefined,
      };

      if (weekend) {
        return { ...base, status: 'folga' as const };
      }

      const vacation = vacationByUserId.get(employee.userId);
      if (vacation) {
        return {
          ...base,
          status: 'ferias' as const,
          periodStart: vacation.startDate,
          periodEnd: vacation.endDate,
        };
      }

      const atestado = atestadoByUserId.get(employee.userId);
      if (atestado) {
        return {
          ...base,
          status: 'atestado' as const,
          periodStart: atestado.periodStart,
          periodEnd: atestado.periodEnd,
        };
      }

      if (dayEntries.length >= 4) {
        return { ...base, status: 'nao_presente' as const };
      }
      if (dayEntries.length % 2 === 1) {
        return { ...base, status: 'trabalhando' as const };
      }
      if (dayEntries.length === 2) {
        return { ...base, status: 'pausa' as const };
      }

      if (
        employee.expectedStartTime &&
        nowSPMinutes > minutesSinceMidnight(employee.expectedStartTime) + 10
      ) {
        return { ...base, status: 'atrasado' as const };
      }
      return { ...base, status: 'sem_registro' as const };
    });
  }
}
