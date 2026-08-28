// "What day/time is it right now" for business-facing decisions (weekend
// detection, lateness) must follow the company's actual timezone, not the
// server's ambient one (often UTC in production) — same reasoning as
// apps/web/src/app/(app)/escala/page.tsx's todaySaoPauloDateOnly, which this
// mirrors for the API side (a different runtime, so not directly
// importable from there). Storage/comparison of already-known date-only
// values (VacationRequest.startDate, etc.) stays UTC-midnight throughout,
// unaffected by this — only "what is today/now" is timezone-aware here.

export function dateOnlyInSaoPaulo(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function todaySaoPauloDateOnly(): string {
  return dateOnlyInSaoPaulo(new Date());
}

export function nowSaoPauloTimeOnly(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('hour')}:${get('minute')}`;
}

// 0=Sunday..6=Saturday, matching Date.prototype.getUTCDay's convention.
// dateOnly is a plain "YYYY-MM-DD" (already resolved to São Paulo by the
// caller), so parsing it as UTC midnight is unambiguous here.
export function dayOfWeekFromDateOnly(dateOnly: string): number {
  return new Date(`${dateOnly}T00:00:00.000Z`).getUTCDay();
}

export function isWeekend(dateOnly: string): boolean {
  const day = dayOfWeekFromDateOnly(dateOnly);
  return day === 0 || day === 6;
}

// Minutes since midnight, for comparing two "HH:mm" wall-clock values.
export function minutesSinceMidnight(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}
