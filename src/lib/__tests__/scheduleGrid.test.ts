import { describe, expect, it } from 'vitest';
import {
  gapsWithin,
  invertRanges,
  minuteLabel,
  offHoursOnDay,
  rangeOnDay,
  shiftDayKey,
  zoneMinuteOfDay,
  zoneWallToUtc,
} from '@/lib/scheduleGrid';

describe('zone wall clock', () => {
  it('turns a minute of a day in a zone into the right instant', () => {
    // Mexico City has no DST: UTC-6.
    expect(zoneWallToUtc('2026-11-05', 10 * 60, 'America/Mexico_City').toISOString()).toBe('2026-11-05T16:00:00.000Z');
    // Madrid on 5 Nov 2026 is CET, UTC+1.
    expect(zoneWallToUtc('2026-11-05', 10 * 60, 'Europe/Madrid').toISOString()).toBe('2026-11-05T09:00:00.000Z');
    // Kolkata is UTC+5:30.
    expect(zoneWallToUtc('2026-11-05', 0, 'Asia/Kolkata').toISOString()).toBe('2026-11-04T18:30:00.000Z');
  });

  it('reads the minute of the day back in any zone', () => {
    const t = new Date('2026-11-05T16:00:00Z');
    expect(zoneMinuteOfDay(t, 'America/Mexico_City')).toBe(10 * 60);
    expect(zoneMinuteOfDay(t, 'Europe/Madrid')).toBe(17 * 60);
    expect(zoneMinuteOfDay(t, 'Asia/Tokyo')).toBe(1 * 60);
  });

  it('survives a DST change (New York, 1 Nov 2026)', () => {
    expect(zoneWallToUtc('2026-11-01', 9 * 60, 'America/New_York').toISOString()).toBe('2026-11-01T14:00:00.000Z');
    expect(zoneWallToUtc('2026-10-31', 9 * 60, 'America/New_York').toISOString()).toBe('2026-10-31T13:00:00.000Z');
  });

  it('labels a minute in the zone', () => {
    expect(minuteLabel('2026-11-05', 13 * 60 + 30, 'Asia/Tokyo')).toBe('1:30 PM');
  });

  it('shifts day keys across months', () => {
    expect(shiftDayKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDayKey('2026-11-01', -1)).toBe('2026-10-31');
  });
});

describe('holds on a day', () => {
  const tz = 'America/Mexico_City';
  it('clips a hold to the day it overlaps', () => {
    // 22:00 on the 4th to 02:00 on the 5th, Mexico City.
    const start = zoneWallToUtc('2026-11-04', 22 * 60, tz);
    const end = zoneWallToUtc('2026-11-05', 2 * 60, tz);
    expect(rangeOnDay(start, end, '2026-11-05', tz)).toEqual({ startMin: 0, endMin: 120 });
    expect(rangeOnDay(start, end, '2026-11-04', tz)).toEqual({ startMin: 22 * 60, endMin: 24 * 60 });
    expect(rangeOnDay(start, end, '2026-11-06', tz)).toBeNull();
  });

  it('moves with the zone the grid is shown in', () => {
    const start = new Date('2026-11-05T16:00:00Z');
    const end = new Date('2026-11-05T17:00:00Z');
    expect(rangeOnDay(start, end, '2026-11-05', 'America/Mexico_City')).toEqual({ startMin: 600, endMin: 660 });
    expect(rangeOnDay(start, end, '2026-11-06', 'Asia/Tokyo')).toEqual({ startMin: 60, endMin: 120 });
  });
});

describe('free time', () => {
  it('finds gaps inside working hours around holds', () => {
    const within = [{ startMin: 480, endMin: 1200 }];
    const blocked = [{ startMin: 600, endMin: 660 }, { startMin: 650, endMin: 720 }, { startMin: 1180, endMin: 1300 }];
    expect(gapsWithin(within, blocked)).toEqual([
      { startMin: 480, endMin: 600 },
      { startMin: 720, endMin: 1180 },
    ]);
  });

  it('drops gaps shorter than the minimum', () => {
    expect(gapsWithin([{ startMin: 0, endMin: 100 }], [{ startMin: 20, endMin: 100 }], 30)).toEqual([]);
  });

  it('dims a teammate abroad by their own day', () => {
    // Shown in Mexico City (UTC-6); the teammate is in Madrid (UTC+1): their 8:00–20:00 is 1:00–13:00 here.
    const off = offHoursOnDay('2026-11-05', 'America/Mexico_City', 'Europe/Madrid');
    expect(off).toEqual([
      { startMin: 0, endMin: 60 },
      { startMin: 13 * 60, endMin: 24 * 60 },
    ]);
    expect(invertRanges(off)).toEqual([{ startMin: 60, endMin: 13 * 60 }]);
  });
});
