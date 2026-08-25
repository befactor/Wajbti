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

// Consecutive-day logging streak. dateStrs are the days that have at least
// one entry (any order). Today not having an entry yet doesn't break a
// streak that's still active as of yesterday - it starts counting from
// whichever of today/yesterday is present.
export function computeStreak(dateStrs: string[], today: string = localDateStr()): number {
  const present = new Set(dateStrs);
  let cursor = present.has(today) ? today : addDays(today, -1);
  if (!present.has(cursor)) return 0;

  let streak = 0;
  while (present.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
