import { describe, expect, it } from "vitest";
import { calculateNextRunDate, isDueToRun } from "@/lib/recurring-invoice-schedule";

describe("calculateNextRunDate", () => {
  it("advances weekly by 7 days", () => {
    const next = calculateNextRunDate(new Date("2026-08-01"), "WEEKLY");
    expect(next.toISOString().slice(0, 10)).toBe("2026-08-08");
  });

  it("advances monthly by one calendar month", () => {
    const next = calculateNextRunDate(new Date("2026-01-15"), "MONTHLY");
    expect(next.toISOString().slice(0, 10)).toBe("2026-02-15");
  });

  it("advances quarterly by three months", () => {
    const next = calculateNextRunDate(new Date("2026-01-31"), "QUARTERLY");
    // Jan 31 + 3 months overflows April (30 days) to May 1 — documenting JS Date's
    // own month-overflow behavior, which this function deliberately doesn't correct.
    expect(next.toISOString().slice(0, 10)).toBe("2026-05-01");
  });

  it("advances yearly by one year", () => {
    const next = calculateNextRunDate(new Date("2026-03-10"), "YEARLY");
    expect(next.toISOString().slice(0, 10)).toBe("2027-03-10");
  });

  it("advances from the given date, not from today — so early generation doesn't shift the schedule", () => {
    const scheduled = new Date("2020-01-01");
    const next = calculateNextRunDate(scheduled, "MONTHLY");
    expect(next.toISOString().slice(0, 10)).toBe("2020-02-01");
  });
});

describe("isDueToRun", () => {
  it("is due when the date is in the past", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(isDueToRun(past)).toBe(true);
  });

  it("is due when the date is today (midnight-normalized, as a @db.Date column reads back)", () => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    expect(isDueToRun(todayMidnight)).toBe(true);
  });

  it("is not due when the date is in the future", () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    expect(isDueToRun(future)).toBe(false);
  });
});
