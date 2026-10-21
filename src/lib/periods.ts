import { todayInTimeZone } from "./dates";

export type Period = "WEEKLY" | "MONTHLY" | "ANNUAL";

// Returns the [start, end] date range for the period containing `reference`.
// Weekly = Monday to Sunday. Monthly = 1st to last day of month. Annual = Jan 1 to Dec 31.
export function getPeriodRange(period: Period, reference: Date = todayInTimeZone()) {
  const ref = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));

  if (period === "ANNUAL") {
    const start = new Date(Date.UTC(ref.getUTCFullYear(), 0, 1));
    const end = new Date(Date.UTC(ref.getUTCFullYear(), 11, 31));
    return { start, end };
  }

  if (period === "MONTHLY") {
    const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
    const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
    return { start, end };
  }

  // WEEKLY: Monday-start week
  const day = ref.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(ref);
  start.setUTCDate(ref.getUTCDate() + diffToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}

