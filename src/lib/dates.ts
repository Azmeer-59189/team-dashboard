// "Today" for period calculations (this week / this month / last 30 days) should
// follow the organization's clock, not the server's. Vercel runs in UTC, so a team
// in UTC+5 would otherwise see yesterday's date for the first five hours of each day.
// Set APP_TIME_ZONE to an IANA name such as "Asia/Karachi"; defaults to UTC.
export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "UTC";

// The calendar date it currently is in `timeZone`, as a Date at UTC midnight -
// the same shape as Task.taskDate values, so it compares cleanly with them.
export function todayInTimeZone(now: Date = new Date(), timeZone: string = APP_TIME_ZONE): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

// "YYYY-MM" for the month containing `date` (a UTC-midnight calendar date).
export function monthLabel(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// The first day of a window of `days` calendar days ending on (and including) `today`.
export function windowStart(days: number, today: Date = todayInTimeZone()): Date {
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}
