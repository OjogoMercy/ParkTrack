/**
 * Dates and times, always shown in Lagos time (WAT, UTC+1, no daylight
 * saving), whatever the server's or phone's timezone. Formats follow the
 * design copy: "4:12 PM", "Sat 22 Nov, 6:00 PM", "1 day 22 hours left".
 */

export const TIME_ZONE = "Africa/Lagos";
const LOCALE = "en-NG";

type DateIn = Date | string | number;
const toDate = (d: DateIn) => (d instanceof Date ? d : new Date(d));

function fmt(d: DateIn, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    ...opts,
  }).format(toDate(d));
}

function partsOf(d: DateIn) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(toDate(d));
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return {
    weekday: get("weekday"),
    day: get("day"),
    month: get("month"),
    year: get("year"),
    hour: Number(get("hour")),
    minute: get("minute"),
  };
}

/** "4:12 PM" */
export function formatTime(d: DateIn): string {
  const { hour, minute } = partsOf(d);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
}

/** "Fri 14 Nov" */
export function formatDay(d: DateIn): string {
  const { weekday, day, month } = partsOf(d);
  return `${weekday} ${day} ${month}`;
}

/** "Sat 22 Nov, 6:00 PM" */
export function formatDayTime(d: DateIn): string {
  return `${formatDay(d)}, ${formatTime(d)}`;
}

/** "Today", "Yesterday", or "Fri 14 Nov" (relative to `now`, in Lagos). */
export function formatRelativeDay(d: DateIn, now: DateIn = new Date()): string {
  const key = (x: DateIn) =>
    fmt(x, { year: "numeric", month: "2-digit", day: "2-digit" });
  const today = key(now);
  const yesterday = key(toDate(now).getTime() - 86_400_000);
  const k = key(d);
  if (k === today) return "Today";
  if (k === yesterday) return "Yesterday";
  return formatDay(d);
}

/** Whole hours/minutes until `target`; negative when past. */
export function minutesUntil(target: DateIn, now: DateIn = new Date()): number {
  return Math.floor(
    (toDate(target).getTime() - toDate(now).getTime()) / 60_000,
  );
}

/**
 * "1 day 22 hours left", "18 hours left", "12 min left", "Expired".
 * Used for drop-off deadlines and free pickup windows.
 */
export function formatTimeLeft(
  target: DateIn,
  now: DateIn = new Date(),
): string {
  const mins = minutesUntil(target, now);
  if (mins <= 0) return "Expired";
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) {
    const d = `${days} day${days === 1 ? "" : "s"}`;
    return hours > 0
      ? `${d} ${hours} hour${hours === 1 ? "" : "s"} left`
      : `${d} left`;
  }
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  return `${mins} min left`;
}

/** Compact countdown for lists: "18h free", "45m". */
export function formatShortDuration(mins: number): string {
  if (mins >= 60) return `${Math.floor(mins / 60)}h`;
  return `${Math.max(0, mins)}m`;
}

/** "9:41" for code expiry timers (mm:ss). */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function addHours(d: DateIn, hours: number): Date {
  return new Date(toDate(d).getTime() + hours * 3_600_000);
}

export function addMinutes(d: DateIn, minutes: number): Date {
  return new Date(toDate(d).getTime() + minutes * 60_000);
}

export type OpeningHours = Record<string, [string, string] | null>;
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Is the park open at `now` (Lagos time)? Returns closing time too ("19:00"). */
export function openStatus(
  hours: OpeningHours,
  now: DateIn = new Date(),
): { open: boolean; closesAt: string | null } {
  const { weekday, hour, minute } = partsOf(now);
  const key =
    DAY_KEYS[
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday)
    ];
  const today = key ? hours[key] : null;
  if (!today) return { open: false, closesAt: null };
  const current = `${String(hour).padStart(2, "0")}:${minute}`;
  const [opens, closes] = today;
  const open = current >= opens && current < closes;
  return { open, closesAt: open ? closes : null };
}

/** "19:00" → "7:00 PM" */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
