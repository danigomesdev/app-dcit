import type { TimeEntryRecord } from "@/context/ponto-context";
import { isSameDay, summarizeDay } from "@/context/ponto-context";

// No payroll/schedule backend exists yet, so this assumes a standard CLT
// week (8h, Mon–Fri, weekends off) and an illustrative hourly rate. Both
// are clearly-labeled placeholders for demo/testing, not real payroll data.
export const EXPECTED_MINUTES_WEEKDAY = 8 * 60;
export const HOURLY_RATE_BRL = 35;

export type DailyRecord = {
  dateKey: string; // YYYY-MM-DD
  date: Date;
  expectedMinutes: number;
  workedMinutes: number;
  diffMinutes: number;
  isToday: boolean;
  isSeeded: boolean;
};

function pseudoRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

function expectedMinutesFor(date: Date): number {
  const day = date.getDay();
  return day === 0 || day === 6 ? 0 : EXPECTED_MINUTES_WEEKDAY;
}

function seededWorkedMinutes(date: Date, expectedMinutes: number): number {
  if (expectedMinutes === 0) return 0;
  const roll = pseudoRandom(date.toISOString().slice(0, 10));
  if (roll < 0.08) return 0;
  const varianceMinutes = Math.round((roll - 0.5) * 120);
  return Math.max(0, expectedMinutes + varianceMinutes);
}

/**
 * Builds one record per day for [start, end] (inclusive). Uses the real
 * time-entry history (hydrated from GET /time-entries, see ponto-context's
 * hydrateEntries) for any day that actually has punches, and only falls
 * back to seeded plausible data for days with none — e.g. before the app
 * was ever used, or days that predate this employment. This means the
 * fallback shrinks to nothing as real punch history accumulates.
 */
export function buildDailyRecords(
  allEntries: TimeEntryRecord[],
  start: Date,
  end: Date,
): DailyRecord[] {
  const records: DailyRecord[] = [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endKey = end.toISOString().slice(0, 10);

  while (cursor.toISOString().slice(0, 10) <= endKey) {
    const date = new Date(cursor);
    const dateKey = date.toISOString().slice(0, 10);
    const expectedMinutes = expectedMinutesFor(date);
    const isToday = dateKey === todayKey;

    const dayEntries = allEntries.filter((entry) => isSameDay(entry.clockedAt, dateKey));
    const hasRealData = dayEntries.length > 0;
    const workedMinutes = hasRealData
      ? summarizeDay(dayEntries).workedMinutes
      : seededWorkedMinutes(date, expectedMinutes);

    records.push({
      dateKey,
      date,
      expectedMinutes,
      workedMinutes,
      diffMinutes: workedMinutes - expectedMinutes,
      isToday,
      isSeeded: !hasRealData,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return records;
}

export function startOfMonth(date: Date, monthsAgo = 0): Date {
  return new Date(date.getFullYear(), date.getMonth() - monthsAgo, 1);
}

export function endOfMonth(date: Date, monthsAgo = 0): Date {
  return new Date(date.getFullYear(), date.getMonth() - monthsAgo + 1, 0);
}

export function cumulativeBalance(records: DailyRecord[]): number {
  return records.reduce((total, record) => total + record.diffMinutes, 0);
}

export function formatSignedMinutes(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "+";
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

// Simplified illustrative estimate — not a payroll-accurate DSR
// calculation. Real DSR depends on salary composition and CBA rules this
// app has no data for; this approximates the common proportional formula
// (overtime ÷ worked days) × rest days in the period, capped at a sane
// bound so a bad week doesn't produce an absurd number on screen.
export function estimateDsrMinutes(records: DailyRecord[]): number {
  const workedDays = records.filter((r) => r.expectedMinutes > 0 && r.workedMinutes > 0);
  const restDays = records.filter((r) => r.expectedMinutes === 0).length;
  const overtimeMinutes = records
    .filter((r) => r.diffMinutes > 0)
    .reduce((sum, r) => sum + r.diffMinutes, 0);

  if (workedDays.length === 0 || overtimeMinutes === 0) return 0;
  return Math.round((overtimeMinutes / workedDays.length) * restDays);
}

export function estimateOvertimeValueBRL(records: DailyRecord[]): number {
  const overtimeMinutes = records
    .filter((r) => r.diffMinutes > 0)
    .reduce((sum, r) => sum + r.diffMinutes, 0);
  return Math.round((overtimeMinutes / 60) * HOURLY_RATE_BRL * 100) / 100;
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
