// Calendar-day helpers (YYYY-MM-DD), used by Diary/Water/MealPlan so a
// "day" always means the viewer's local day, stored as UTC midnight.

export function localDateStr(d: Date = new Date()): string {
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 10);
}

export function dateStrToUTCMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function addDays(dateStr: string, delta: number): string {
  const d = dateStrToUTCMidnight(dateStr);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
