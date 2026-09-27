import { describe, expect, it } from "vitest";
import { acceptsAsap, formatDayLabel, formatHoursRange, formatTime, isOpen, isValidSlot, nextOpening, orderSlots, windowAt, zonedTime, type HoursConfig } from "./hours";

const TZ = "America/Toronto";
const daily = (opensAt: string, closesAt: string) =>
  [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, isClosed: false, opensAt, closesAt }));
const cfg: HoursConfig = { timezone: TZ, hours: daily("11:30", "23:30"), closures: [], lastOrderMinutes: 15 };
const at = (y: number, mo: number, d: number, h: number, mi: number) => zonedTime(y, mo, d, h, mi, TZ);

describe("zonedTime", () => {
  it("handles EDT and EST offsets", () => {
    expect(at(2026, 7, 1, 12, 0).toISOString()).toBe("2026-07-01T16:00:00.000Z");
    expect(at(2026, 1, 15, 12, 0).toISOString()).toBe("2026-01-15T17:00:00.000Z");
  });
});

describe("open and closed", () => {
  it("is closed before 11:30 and after 23:30", () => {
    expect(isOpen(at(2026, 9, 25, 11, 29), cfg)).toBe(false);
    expect(isOpen(at(2026, 9, 25, 11, 30), cfg)).toBe(true);
    expect(isOpen(at(2026, 9, 25, 23, 29), cfg)).toBe(true);
    expect(isOpen(at(2026, 9, 25, 23, 30), cfg)).toBe(false);
  });

  it("stops ASAP orders inside the last-order cutoff", () => {
    expect(acceptsAsap(at(2026, 9, 25, 23, 15), cfg)).toBe(true);
    expect(acceptsAsap(at(2026, 9, 25, 23, 16), cfg)).toBe(false);
  });

  it("honours holiday closures and closed weekdays", () => {
    const holiday = { ...cfg, closures: ["2026-12-25"] };
    expect(isOpen(at(2026, 12, 25, 14, 0), holiday)).toBe(false);
    const mondaysOff = { ...cfg, hours: cfg.hours.map((h) => (h.dayOfWeek === 1 ? { ...h, isClosed: true } : h)) };
    expect(isOpen(at(2026, 9, 28, 14, 0), mondaysOff)).toBe(false); // a Monday
  });

  it("supports closing after midnight", () => {
    const late = { ...cfg, hours: daily("11:30", "02:00") };
    const w = windowAt(at(2026, 9, 26, 1, 0), late);
    expect(w?.date).toBe("2026-09-25");
    expect(isOpen(at(2026, 9, 26, 2, 0), late)).toBe(false);
  });

  it("finds the next opening", () => {
    expect(nextOpening(at(2026, 9, 25, 23, 45), cfg)?.opens.toISOString()).toBe(at(2026, 9, 26, 11, 30).toISOString());
    expect(nextOpening(at(2026, 9, 25, 9, 0), cfg)?.opens.toISOString()).toBe(at(2026, 9, 25, 11, 30).toISOString());
  });
});

describe("order slots", () => {
  it("starts at now + lead, on a 15-minute grid, and ends at the last-order cutoff", () => {
    const now = at(2026, 9, 25, 22, 50);
    const slots = orderSlots(now, 20, cfg);
    const today = slots.filter((s) => s < at(2026, 9, 26, 0, 0));
    expect(today.map((s) => formatTime(s, TZ))).toEqual(["11:15 p.m."]);
    // tomorrow starts at opening + lead time
    expect(formatTime(slots[today.length], TZ)).toBe("12:00 p.m."); // 11:30 + 20 min = 11:50, rounded up to the grid
  });

  it("offers tomorrow's slots before opening and validates exact slots only", () => {
    const now = at(2026, 9, 25, 8, 0);
    expect(orderSlots(now, 20, cfg)[0].toISOString()).toBe(at(2026, 9, 25, 12, 0).toISOString());
    expect(isValidSlot(at(2026, 9, 25, 12, 0), now, 20, cfg)).toBe(true);
    expect(isValidSlot(at(2026, 9, 25, 12, 7), now, 20, cfg)).toBe(false);
    expect(isValidSlot(at(2026, 9, 25, 23, 30), now, 20, cfg)).toBe(false);
  });
});

describe("formatting", () => {
  it("labels days and ranges", () => {
    const now = at(2026, 9, 25, 12, 0);
    expect(formatDayLabel(at(2026, 9, 25, 18, 0), now, TZ)).toBe("Today");
    expect(formatDayLabel(at(2026, 9, 26, 18, 0), now, TZ)).toBe("Tomorrow");
    expect(formatHoursRange({ dayOfWeek: 1, isClosed: false, opensAt: "11:30", closesAt: "23:30" })).toBe("11:30 AM – 11:30 PM");
  });
});
