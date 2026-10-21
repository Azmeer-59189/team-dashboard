import { test } from "node:test";
import assert from "node:assert/strict";
import { todayInTimeZone, monthLabel, windowStart } from "./dates";
import { getPeriodRange } from "./goals";

const iso = (d: Date) => d.toISOString().slice(0, 10);

test("today follows the configured timezone, not the server's UTC clock", () => {
  // 21:30 UTC on Oct 31 is already Nov 1 in Karachi (UTC+5)
  const now = new Date("2026-10-31T21:30:00Z");
  assert.equal(iso(todayInTimeZone(now, "UTC")), "2026-10-31");
  assert.equal(iso(todayInTimeZone(now, "Asia/Karachi")), "2026-11-01");
  assert.equal(monthLabel(todayInTimeZone(now, "Asia/Karachi")), "2026-11");
});

test("a 30-day window includes today", () => {
  assert.equal(iso(windowStart(30, new Date("2026-10-21T00:00:00Z"))), "2026-09-22");
  assert.equal(iso(windowStart(1, new Date("2026-10-21T00:00:00Z"))), "2026-10-21");
});

test("period ranges: Monday-Sunday weeks, calendar months and years", () => {
  const wed = new Date("2026-10-21T00:00:00Z");
  assert.deepEqual(Object.values(getPeriodRange("WEEKLY", wed)).map(iso), ["2026-10-19", "2026-10-25"]);
  const sun = new Date("2026-10-25T00:00:00Z");
  assert.deepEqual(Object.values(getPeriodRange("WEEKLY", sun)).map(iso), ["2026-10-19", "2026-10-25"]);
  const feb = new Date("2028-02-10T00:00:00Z");
  assert.deepEqual(Object.values(getPeriodRange("MONTHLY", feb)).map(iso), ["2028-02-01", "2028-02-29"]);
  assert.deepEqual(Object.values(getPeriodRange("ANNUAL", wed)).map(iso), ["2026-01-01", "2026-12-31"]);
});
