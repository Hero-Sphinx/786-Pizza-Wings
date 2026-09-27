// Opening hours and order-time slots, computed in the store's time zone.
// Pure functions: pass `now` in, so they're deterministic and unit-tested.

export type DayHours = { dayOfWeek: number; isClosed: boolean; opensAt: string; closesAt: string }; // "HH:MM"
export type HoursConfig = {
  timezone: string;
  hours: DayHours[];
  /** Store-local dates "YYYY-MM-DD" the store is closed. */
  closures: string[];
  lastOrderMinutes: number;
};

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const fmtCache = new Map<string, Intl.DateTimeFormat>();

export function localParts(instant: Date, timezone: string): LocalParts {
  let fmt = fmtCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    });
    fmtCache.set(timezone, fmt);
  }
  const parts = Object.fromEntries(fmt.formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday],
  };
}

/** The instant when the store's wall clock shows the given local date and time. */
export function zonedTime(year: number, month: number, day: number, hour: number, minute: number, timezone: string): Date {
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wanted;
  // Two passes settle the offset, including across DST changes.
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(guess), timezone);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wanted - shown;
  }
  return new Date(guess);
}

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (p: { year: number; month: number; day: number }) => `${p.year}-${pad(p.month)}-${pad(p.day)}`;
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export type OpenWindow = { opens: Date; closes: Date; weekday: number; date: string };

/** The opening window that starts on the store-local calendar day `offset` days from `now`. */
function windowForDay(now: Date, offset: number, cfg: HoursConfig): OpenWindow | null {
  const today = localParts(now, cfg.timezone);
  // Noon avoids DST edge cases when stepping whole days.
  const noon = zonedTime(today.year, today.month, today.day, 12, 0, cfg.timezone);
  const day = localParts(new Date(noon.getTime() + offset * 86_400_000), cfg.timezone);
  const date = dateKey(day);
  const h = cfg.hours.find((x) => x.dayOfWeek === day.weekday);
  if (!h || h.isClosed || cfg.closures.includes(date)) return null;
  const openMin = toMinutes(h.opensAt);
  let closeMin = toMinutes(h.closesAt);
  if (closeMin <= openMin) closeMin += 24 * 60; // closes after midnight
  const opens = zonedTime(day.year, day.month, day.day, Math.floor(openMin / 60), openMin % 60, cfg.timezone);
  const closes = new Date(opens.getTime() + (closeMin - openMin) * 60_000);
  return { opens, closes, weekday: day.weekday, date };
}

/** The window containing `at`, if the store is open then. Checks yesterday for after-midnight hours. */
export function windowAt(at: Date, cfg: HoursConfig): OpenWindow | null {
  for (const offset of [0, -1]) {
    const w = windowForDay(at, offset, cfg);
    if (w && at >= w.opens && at < w.closes) return w;
  }
  return null;
}

export function isOpen(now: Date, cfg: HoursConfig): boolean {
  return windowAt(now, cfg) !== null;
}

/** Can an ASAP order be placed right now? (Open, and not inside the last-order cutoff.) */
export function acceptsAsap(now: Date, cfg: HoursConfig): boolean {
  const w = windowAt(now, cfg);
  return w !== null && now.getTime() <= w.closes.getTime() - cfg.lastOrderMinutes * 60_000;
}

export function nextOpening(now: Date, cfg: HoursConfig): OpenWindow | null {
  for (let offset = 0; offset <= 14; offset++) {
    const w = windowForDay(now, offset, cfg);
    if (w && w.opens > now) return w;
  }
  return null;
}

const SLOT_MINUTES = 15;

/**
 * Times a customer may schedule an order for: every 15 minutes from now + lead time until the
 * last-order cutoff, over the current and next opening window.
 */
export function orderSlots(now: Date, leadMinutes: number, cfg: HoursConfig): Date[] {
  const earliest = now.getTime() + leadMinutes * 60_000;
  const windows: OpenWindow[] = [];
  const current = windowAt(now, cfg);
  if (current) windows.push(current);
  for (let offset = 0; offset <= 7 && windows.length < 2; offset++) {
    const w = windowForDay(now, offset, cfg);
    if (w && w.opens > now && !windows.some((x) => x.opens.getTime() === w.opens.getTime())) windows.push(w);
  }
  const slots: Date[] = [];
  const step = SLOT_MINUTES * 60_000;
  for (const w of windows) {
    const cutoff = w.closes.getTime() - cfg.lastOrderMinutes * 60_000;
    // First slot: opening + lead (kitchen needs prep time too), rounded up to the slot grid.
    let t = Math.max(earliest, w.opens.getTime() + leadMinutes * 60_000);
    t = Math.ceil(t / step) * step;
    for (; t <= cutoff; t += step) slots.push(new Date(t));
  }
  return slots;
}

export function isValidSlot(at: Date, now: Date, leadMinutes: number, cfg: HoursConfig): boolean {
  return orderSlots(now, leadMinutes, cfg).some((s) => s.getTime() === at.getTime());
}

/** "11:30 AM" in the store's time zone. */
export function formatTime(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hour: "numeric", minute: "2-digit", hour12: true }).format(at);
}

/** "Today", "Tomorrow" or "Friday", relative to `now` in the store's time zone. */
export function formatDayLabel(at: Date, now: Date, timezone: string): string {
  const a = dateKey(localParts(at, timezone));
  const today = localParts(now, timezone);
  if (a === dateKey(today)) return "Today";
  const noon = zonedTime(today.year, today.month, today.day, 12, 0, timezone);
  if (a === dateKey(localParts(new Date(noon.getTime() + 86_400_000), timezone))) return "Tomorrow";
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, weekday: "long" }).format(at);
}

/** "11:30 AM – 11:30 PM" for a DayHours row. */
export function formatHoursRange(h: DayHours): string {
  if (h.isClosed) return "Closed";
  const fmt = (hhmm: string) => {
    const [hh, mm] = hhmm.split(":").map(Number);
    const suffix = hh >= 12 ? "PM" : "AM";
    return `${((hh + 11) % 12) + 1}:${pad(mm)} ${suffix}`;
  };
  return `${fmt(h.opensAt)} – ${fmt(h.closesAt)}`;
}
