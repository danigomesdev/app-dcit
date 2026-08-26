// Posts newer than this many days are shown as "unread" — a purely local,
// client-computed concept (no read-state persisted server-side).
export const UNREAD_WINDOW_DAYS = 3;

export type Birthday = {
  name: string;
  day: number;
  month: number; // 1-12
};

export function birthdaysToday(birthdays: Birthday[], referenceDate = new Date()): Birthday[] {
  return birthdays.filter(
    (b) => b.day === referenceDate.getDate() && b.month === referenceDate.getMonth() + 1,
  );
}

export function birthdaysThisMonthExcludingToday(
  birthdays: Birthday[],
  referenceDate = new Date(),
): Birthday[] {
  return birthdays.filter(
    (b) =>
      b.month === referenceDate.getMonth() + 1 &&
      !(b.day === referenceDate.getDate() && b.month === referenceDate.getMonth() + 1),
  );
}

export function formatRelativeDate(iso: string, referenceDate = new Date()): string {
  const date = new Date(iso);
  const days = Math.floor(
    (referenceDate.getTime() - date.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 7) return `Há ${days} dias`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
