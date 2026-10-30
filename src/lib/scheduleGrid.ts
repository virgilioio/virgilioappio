/**
 * Day-grid geometry for the Schedule Interview sheet, in an explicit IANA time zone.
 *
 * Everything is "minutes since midnight on one day, in one zone": the grid shows
 * that zone's day from 00:00 to 24:00, holds are clipped to it, and a picked
 * minute turns back into a real instant with `zoneWallToUtc`. Intl does the
 * offsets and DST; no extra dependency.
 */
import { zoneDayKey } from '@/lib/timezoneFormat';

export const DAY_MINUTES = 24 * 60;
export const SNAP_MIN = 15;
/** A person's day in their own zone; outside it their column is dimmed (still bookable). */
export const WORK_START_HOUR = 8;
export const WORK_END_HOUR = 20;

export interface BusyInterval {
  start: string;
  end: string;
  title?: string;
  /** Whose hold it is; holds without an owner belong to everyone shown. */
  user_id?: string | null;
}

export interface MinuteRange {
  startMin: number;
  endMin: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string) {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

function wallParts(instant: Date, timeZone: string) {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
  };
}

/** Minutes since midnight of the instant's own day in `timeZone`. */
export function zoneMinuteOfDay(instant: Date, timeZone: string): number {
  const p = wallParts(instant, timeZone);
  return p.hour * 60 + p.minute;
}

/** The real instant for `minutes` past midnight of `dayKey` ("yyyy-MM-dd") in `timeZone`. */
export function zoneWallToUtc(dayKey: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  const offsetAt = (t: number) => {
    const p = wallParts(new Date(t), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(t / 60000) * 60000;
  };
  // Two passes settle the offset around DST changes.
  let utc = naive - offsetAt(naive);
  utc = naive - offsetAt(utc);
  return new Date(utc);
}

/** Next or previous calendar day key. */
export function shiftDayKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** Where an interval falls on `dayKey` in `timeZone`, clipped to the day; null when it doesn't. */
export function rangeOnDay(
  start: Date,
  end: Date,
  dayKey: string,
  timeZone: string,
): MinuteRange | null {
  const startKey = zoneDayKey(start, timeZone);
  const endKey = zoneDayKey(end, timeZone);
  if (startKey > dayKey || endKey < dayKey) return null;
  const startMin = startKey < dayKey ? 0 : zoneMinuteOfDay(start, timeZone);
  const endMin = endKey > dayKey ? DAY_MINUTES : zoneMinuteOfDay(end, timeZone);
  if (endMin <= startMin) return null;
  return { startMin, endMin };
}

export function mergeRanges(ranges: MinuteRange[]): MinuteRange[] {
  const sorted = [...ranges].sort((a, b) => a.startMin - b.startMin);
  const merged: MinuteRange[] = [];
  sorted.forEach((r) => {
    const last = merged[merged.length - 1];
    if (last && r.startMin <= last.endMin) last.endMin = Math.max(last.endMin, r.endMin);
    else merged.push({ ...r });
  });
  return merged;
}

/** Gaps of at least `minGap` minutes inside `within` that none of `blocked` covers. */
export function gapsWithin(within: MinuteRange[], blocked: MinuteRange[], minGap = 30): MinuteRange[] {
  const blocks = mergeRanges(blocked);
  const free: MinuteRange[] = [];
  mergeRanges(within).forEach((w) => {
    let cursor = w.startMin;
    blocks.forEach((b) => {
      if (b.endMin <= cursor || b.startMin >= w.endMin) return;
      if (b.startMin - cursor >= minGap) free.push({ startMin: cursor, endMin: b.startMin });
      cursor = Math.max(cursor, b.endMin);
    });
    if (w.endMin - cursor >= minGap) free.push({ startMin: cursor, endMin: w.endMin });
  });
  return free;
}

/** The parts of the shown day that fall outside 8:00–20:00 in `personZone`, in shown-zone minutes. */
export function offHoursOnDay(dayKey: string, viewZone: string, personZone: string): MinuteRange[] {
  const ranges: MinuteRange[] = [];
  for (let m = 0; m < DAY_MINUTES; m += SNAP_MIN) {
    const hour = zoneMinuteOfDay(zoneWallToUtc(dayKey, m, viewZone), personZone) / 60;
    const off = hour < WORK_START_HOUR || hour >= WORK_END_HOUR;
    if (!off) continue;
    const last = ranges[ranges.length - 1];
    if (last && last.endMin === m) last.endMin = m + SNAP_MIN;
    else ranges.push({ startMin: m, endMin: m + SNAP_MIN });
  }
  return ranges;
}

/** The complement of `ranges` across the whole day. */
export function invertRanges(ranges: MinuteRange[]): MinuteRange[] {
  return gapsWithin([{ startMin: 0, endMin: DAY_MINUTES }], ranges, 1);
}

export function snapMinutes(min: number): number {
  return Math.round(min / SNAP_MIN) * SNAP_MIN;
}

export function clampStart(min: number, duration: number): number {
  return Math.min(Math.max(min, 0), DAY_MINUTES - duration);
}

/** "10:30 AM" for a minute of `dayKey` in `timeZone`. */
export function minuteLabel(dayKey: string, min: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(zoneWallToUtc(dayKey, min, timeZone));
}

/** "9 AM", "12 PM" — the grid's hour labels. */
export function hourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/* ------------------------------------------------------------------ *
 * People on the panel
 * ------------------------------------------------------------------ */

export interface GridPerson {
  id: string;
  /** auth user id, matched against each hold's `user_id` */
  userId?: string | null;
  name: string;
  /** Their own zone (profile); their night is dimmed in their column. */
  timeZone: string;
  busy: BusyInterval[];
}

/** A person's holds: their own when holds carry owners, every hold when they don't (older server). */
export function holdsFor(person: GridPerson, all: BusyInterval[]): BusyInterval[] {
  const owned = all.some((b) => b.user_id);
  return owned ? all.filter((b) => b.user_id && b.user_id === person.userId) : all;
}

export function busyOnDay(busy: BusyInterval[], dayKey: string, timeZone: string): (MinuteRange & { hold: BusyInterval })[] {
  return busy
    .map((b) => {
      const r = rangeOnDay(new Date(b.start), new Date(b.end), dayKey, timeZone);
      return r ? { ...r, hold: b } : null;
    })
    .filter(Boolean) as (MinuteRange & { hold: BusyInterval })[];
}

/**
 * When the whole panel is free: nobody has a hold and it's daytime for everyone.
 * With nobody on the panel there is no "panel free" time.
 */
export function panelFreeWindows(
  people: GridPerson[],
  dayKey: string | null,
  timeZone: string,
  minGap = 30,
): MinuteRange[] {
  if (!dayKey || people.length === 0) return [];
  const blocked: MinuteRange[] = [];
  people.forEach((p) => {
    busyOnDay(p.busy, dayKey, timeZone).forEach((r) => blocked.push(r));
    offHoursOnDay(dayKey, timeZone, p.timeZone).forEach((r) => blocked.push(r));
  });
  return gapsWithin([{ startMin: 0, endMin: DAY_MINUTES }], blocked, minGap);
}

export interface OverlapHit {
  name: string;
  title: string;
}

/** Which holds the chosen time crosses. Informational only: holds never block booking. */
export function findOverlaps(
  people: GridPerson[],
  dayKey: string | null,
  timeZone: string,
  startMin: number,
  endMin: number,
): OverlapHit[] {
  if (!dayKey) return [];
  const hits: OverlapHit[] = [];
  people.forEach((p) =>
    busyOnDay(p.busy, dayKey, timeZone).forEach((r) => {
      if (startMin < r.endMin && endMin > r.startMin) {
        hits.push({ name: p.name.split(' ')[0], title: r.hold.title || 'busy time' });
      }
    }),
  );
  return hits;
}
