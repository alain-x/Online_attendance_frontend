export function utcDateString(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

export function addUtcDays(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

export function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function endOfUtcMonth(d: Date): Date {
  return addUtcDays(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)), -1);
}

export function startOfUtcWeekMonday(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addUtcDays(d, diff);
}

export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
