// Fallback used only until the real hire date loads from GET
// /solicitacoes/ferias (see ferias.tsx) — e.g. during the initial fetch, or
// if a user somehow has no Employee row yet. Once the fetch resolves, the
// real hireDate is what currentVacationCycle actually runs on.
export const HIRE_DATE = new Date(2024, 2, 15); // 15/03/2024
// No payroll/HR balance backend exists yet for the accrued-days count
// itself — CLT gives 30 days/year and this is an illustrative remaining
// balance, not computed from real absence/accrual data.
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
export function currentVacationCycle(
  hireDate: Date = HIRE_DATE,
  referenceDate = new Date(),
): VacationCycle {
  let n = 0;
  while (addYears(hireDate, n + 2).getTime() <= referenceDate.getTime()) {
    n++;
  }
  return {
    aquisitivoInicio: addYears(hireDate, n),
    aquisitivoFim: addYears(hireDate, n + 1),
    vencimento: addYears(hireDate, n + 2),
  };
}

export function daysUntil(date: Date, referenceDate = new Date()): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((date.getTime() - referenceDate.getTime()) / msPerDay);
}

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
