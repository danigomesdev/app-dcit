import { buildDailyRecords } from "@/lib/banco-de-horas";
import type { TimeEntryRecord } from "@/context/ponto-context";

describe("buildDailyRecords", () => {
  // Local calendar-day boundaries, same as every real caller (daysAgo,
  // startOfMonth, endOfMonth) — a UTC-midnight ISO string would decode to
  // the previous local day in timezones behind UTC and throw the day count
  // off by one.
  it("uses real entries for a day that has them instead of seeded data", () => {
    const day = new Date(2026, 7, 20); // 20/08/2026 (August is month index 7)
    const dateKey = day.toISOString().slice(0, 10);
    const entries: TimeEntryRecord[] = [
      { id: "1", clockedAt: `${dateKey}T09:00:00.000Z`, synced: true },
      { id: "2", clockedAt: `${dateKey}T17:00:00.000Z`, synced: true },
    ];

    const records = buildDailyRecords(entries, day, day);

    expect(records).toHaveLength(1);
    expect(records[0].isSeeded).toBe(false);
    expect(records[0].workedMinutes).toBe(8 * 60);
  });

  it("falls back to seeded data for a day with no real entries", () => {
    const day = new Date(2026, 7, 21);

    const records = buildDailyRecords([], day, day);

    expect(records).toHaveLength(1);
    expect(records[0].isSeeded).toBe(true);
  });
});
