// No HR/payroll backend exists yet, so the hire date and history below are a
// fixed illustrative example — enough to demo the real CLT acquisitive/
// concessive-period math (see currentVacationCycle) without real employee data.
export const HIRE_DATE = new Date(2024, 2, 15); // 15/03/2024
export const AVAILABLE_DAYS = 22;

export type VacationCycle = {
  aquisitivoInicio: Date;
  aquisitivoFim: Date;
  vencimento: Date;
};

function addYears(date: Date, years: number): Date {
  const copy = new Date(date);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

/**
 * CLT gives 12 months to accrue vacation (período aquisitivo), then another
 * 12 months to take it (período concessivo) before the employer risks
 * paying it in double. This walks forward from the hire date to find the
 * cycle whose concessive deadline hasn't passed yet.
 */
export function currentVacationCycle(referenceDate = new Date()): VacationCycle {
  let n = 0;
  while (addYears(HIRE_DATE, n + 2).getTime() <= referenceDate.getTime()) {
    n++;
  }
  return {
    aquisitivoInicio: addYears(HIRE_DATE, n),
    aquisitivoFim: addYears(HIRE_DATE, n + 1),
    vencimento: addYears(HIRE_DATE, n + 2),
  };
}

export function daysUntil(date: Date, referenceDate = new Date()): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((date.getTime() - referenceDate.getTime()) / msPerDay);
}

export type VacationHistoryEntry = {
  year: number;
  daysTaken: number;
  startDate: Date;
  endDate: Date;
};

export const VACATION_HISTORY: VacationHistoryEntry[] = [
  {
    year: 2024,
    daysTaken: 30,
    startDate: new Date(2024, 6, 8),
    endDate: new Date(2024, 7, 6),
  },
  {
    year: 2025,
    daysTaken: 20,
    startDate: new Date(2025, 11, 15),
    endDate: new Date(2026, 0, 3),
  },
];

export function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR");
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysBetweenInclusive(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
}
