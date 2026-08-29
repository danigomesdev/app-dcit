import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { dateOnlyInSaoPaulo, isWeekend, todaySaoPauloDateOnly } from '../common/sao-paulo-time';

const DEFAULT_EXPECTED_DAILY_MINUTES = 480; // 8h — mesma suposição que o mock mobile antigo fazia
const DEFAULT_OVERTIME_PERCENT = 0; // sem convenção, não presumimos nenhum percentual legal de acréscimo
const AVERAGE_BUSINESS_DAYS_PER_MONTH = 22; // aproximação padrão pra converter salário mensal em valor-hora

export type BancoDeHorasDay = {
  date: string;
  expectedMinutes: number;
  workedMinutes: number;
  diffMinutes: number;
};

export type BancoDeHorasSummary = {
  days: BancoDeHorasDay[];
  balanceMinutes: number;
  dsrMinutes: number;
  hourlyRateBRL: number | null;
  overtimeValueBRL: number | null;
};

// Primeiro dia do mês corrente (São Paulo) até hoje (São Paulo), a menos que
// start/end explícitos sejam passados — não faz sentido consultar banco de
// horas de dias futuros.
export function resolveDefaultPeriod(
  start?: string,
  end?: string,
): { startDateOnly: string; endDateOnly: string } {
  const todaySP = todaySaoPauloDateOnly();
  return {
    startDateOnly: start ?? `${todaySP.slice(0, 7)}-01`,
    endDateOnly: end ?? todaySP,
  };
}

@Injectable()
export class BancoDeHorasService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    userId: string,
    startDateOnly: string,
    endDateOnly: string,
  ): Promise<BancoDeHorasSummary> {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    const convencao = employee?.convencaoId
      ? await this.prisma.convencaoColetiva.findUnique({
          where: { id: employee.convencaoId },
        })
      : null;
    const expectedDailyMinutes =
      convencao?.expectedDailyMinutes ?? DEFAULT_EXPECTED_DAILY_MINUTES;
    const overtimePercent = convencao?.overtimePercent ?? DEFAULT_OVERTIME_PERCENT;

    // São Paulo midnight = UTC 03:00 (UTC-3, no DST) — same convention as
    // TimeEntriesService.listTeamToday and AlertasService.
    const queryStart = new Date(`${startDateOnly}T03:00:00.000Z`);
    const queryEndExclusive = new Date(`${endDateOnly}T03:00:00.000Z`);
    queryEndExclusive.setUTCDate(queryEndExclusive.getUTCDate() + 1);

    const entries = await this.prisma.timeEntry.findMany({
      where: { userId, clockedAt: { gte: queryStart, lt: queryEndExclusive } },
      orderBy: { clockedAt: 'asc' },
    });
    const entriesByDay = new Map<string, Date[]>();
    for (const entry of entries) {
      const dayKey = dateOnlyInSaoPaulo(entry.clockedAt);
      const list = entriesByDay.get(dayKey) ?? [];
      list.push(entry.clockedAt);
      entriesByDay.set(dayKey, list);
    }

    const days: BancoDeHorasDay[] = [];
    let cursor = new Date(`${startDateOnly}T00:00:00.000Z`);
    const endCursor = new Date(`${endDateOnly}T00:00:00.000Z`);
    while (cursor <= endCursor) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const expectedMinutes = isWeekend(dateKey) ? 0 : expectedDailyMinutes;

      // Pairs punches as [in, out, in, out, ...] within this São-Paulo
      // calendar day, mirroring TimeEntriesService.listTeamToday's pairing
      // semantics (the old mobile mock had the same limitation). Two
      // pre-existing, intentionally-not-fixed-here edge cases fall out of
      // this:
      // (a) an odd number of punches on a day — still clocked in, or a
      //     missed punch — leaves the trailing punch unpaired, so it
      //     contributes 0 minutes to workedMinutes; and
      // (b) a shift that crosses midnight is split across two calendar days
      //     by the São-Paulo-midnight bucketing above (entriesByDay keys on
      //     dateOnlyInSaoPaulo), so each day's workedMinutes only reflects
      //     the punches that landed in that day, not the full overnight
      //     shift.
      const dayEntries = entriesByDay.get(dateKey) ?? [];
      let workedMinutes = 0;
      for (let i = 0; i + 1 < dayEntries.length; i += 2) {
        workedMinutes += (dayEntries[i + 1].getTime() - dayEntries[i].getTime()) / 60000;
      }
      workedMinutes = Math.round(workedMinutes);

      days.push({
        date: dateKey,
        expectedMinutes,
        workedMinutes,
        diffMinutes: workedMinutes - expectedMinutes,
      });
      cursor = new Date(cursor);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const workedDaysCount = days.filter(
      (d) => d.expectedMinutes > 0 && d.workedMinutes > 0,
    ).length;
    const restDaysCount = days.filter((d) => d.expectedMinutes === 0).length;
    const overtimeMinutes = days
      .filter((d) => d.diffMinutes > 0)
      .reduce((sum, d) => sum + d.diffMinutes, 0);
    const balanceMinutes = days.reduce((sum, d) => sum + d.diffMinutes, 0);
    const dsrMinutes =
      workedDaysCount === 0 || overtimeMinutes === 0
        ? 0
        : Math.round((overtimeMinutes / workedDaysCount) * restDaysCount);

    const salarioMensal = employee?.salarioMensal ?? null;
    const hourlyRateBRL =
      salarioMensal === null
        ? null
        : salarioMensal / ((expectedDailyMinutes / 60) * AVERAGE_BUSINESS_DAYS_PER_MONTH);
    const overtimeValueBRL =
      hourlyRateBRL === null
        ? null
        : Math.round(
            (overtimeMinutes / 60) * hourlyRateBRL * (1 + overtimePercent / 100) * 100,
          ) / 100;

    return { days, balanceMinutes, dsrMinutes, hourlyRateBRL, overtimeValueBRL };
  }

  // Reuses getSummary per employee rather than re-deriving the same logic —
  // an extra Employee lookup per person is cheap at this app's scale, and
  // keeping one source of truth for the calculation matters more than
  // avoiding a redundant query.
  async getTeamSummary(startDateOnly: string, endDateOnly: string) {
    const employees = await this.prisma.employee.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return Promise.all(
      employees.map(async (employee) => {
        const summary = await this.getSummary(employee.userId, startDateOnly, endDateOnly);
        return {
          userId: employee.userId,
          userName: employee.name,
          balanceMinutes: summary.balanceMinutes,
          dsrMinutes: summary.dsrMinutes,
          hourlyRateBRL: summary.hourlyRateBRL,
          overtimeValueBRL: summary.overtimeValueBRL,
        };
      }),
    );
  }
}
