/**
 * Thin Intl.DateTimeFormat wrappers for rendering times in an explicit IANA timezone.
 * No extra dependency — Intl handles DST and offsets natively.
 */

const FALLBACK_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Rome',
  'Europe/Warsaw',
  'Europe/Athens',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'Asia/Jerusalem',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Perth',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export function isValidTimeZone(tz: string | undefined | null): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function detectTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(tz) ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Format a date in a specific timezone. Falls back to local time if the zone is invalid. */
export function formatInTimeZone(
  date: Date | string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(d);
  } catch {
    return new Intl.DateTimeFormat(locale, options).format(d);
  }
}

/** "9:30 AM" in the given zone. */
export function formatZoneTime(date: Date | string, timeZone: string): string {
  return formatInTimeZone(date, timeZone, { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** "9:30" (no meridiem) in the given zone — for ranges like "9:30 – 10:00 AM". */
export function formatZoneTimeShort(date: Date | string, timeZone: string): string {
  return formatInTimeZone(date, timeZone, { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s?[AP]M$/i, '');
}

/** "Wednesday, June 3, 2026" in the given zone. */
export function formatZoneFullDate(date: Date | string, timeZone: string): string {
  return formatInTimeZone(date, timeZone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "Wednesday, June 3" in the given zone. */
export function formatZoneDayHeading(date: Date | string, timeZone: string): string {
  return formatInTimeZone(date, timeZone, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Zone-local calendar day key, e.g. "2026-06-03". */
export function zoneDayKey(date: Date | string, timeZone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

/** Build a Date at local midday for a "yyyy-MM-dd" day key (safe for calendar cells). */
export function dayKeyToLocalDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

/** "CST", "GMT+2" — short zone name at the given instant. */
export function zoneAbbr(timeZone: string, date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
        .formatToParts(d)
        .find((p) => p.type === 'timeZoneName')?.value ?? ''
    );
  } catch {
    return '';
  }
}

/** "GMT-6" style offset label. */
export function zoneOffsetLabel(timeZone: string, date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    const value = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName')?.value;
    if (!value) return '';
    return value.replace(/^GMT([+-])0?(\d+):00$/, 'GMT$1$2').replace(/^GMT$/, 'GMT+0');
  } catch {
    return '';
  }
}

/** Friendly city label from an IANA identifier: "America/Mexico_City" → "Mexico City". */
export function zoneCityLabel(timeZone: string): string {
  const parts = timeZone.split('/');
  return (parts[parts.length - 1] || timeZone).replace(/_/g, ' ');
}

/** Region group from an IANA identifier: "America/Mexico_City" → "America". */
export function zoneRegion(timeZone: string): string {
  const region = timeZone.split('/')[0];
  return region === 'UTC' || region === 'Etc' ? 'Other' : region.replace(/_/g, ' ');
}

export interface TimeZoneOption {
  value: string;
  city: string;
  region: string;
  offset: string;
}

let cachedZones: string[] | null = null;

export function listTimeZones(): string[] {
  if (cachedZones) return cachedZones;
  let zones: string[] = [];
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf;
    if (typeof supported === 'function') {
      zones = supported('timeZone') || [];
    }
  } catch {
    zones = [];
  }
  if (!zones.length) zones = FALLBACK_TIMEZONES;
  cachedZones = zones;
  return zones;
}

/** All timezone options, grouped-friendly and sorted by region then city. */
export function timeZoneOptions(extra?: string): TimeZoneOption[] {
  const zones = new Set(listTimeZones());
  if (extra && isValidTimeZone(extra)) zones.add(extra);
  const now = new Date();
  return Array.from(zones)
    .map((value) => ({
      value,
      city: zoneCityLabel(value),
      region: zoneRegion(value),
      offset: zoneOffsetLabel(value, now),
    }))
    .sort((a, b) => a.region.localeCompare(b.region) || a.city.localeCompare(b.city));
}
