import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { IconTip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatInTimeZone, zoneAbbr, zoneDayKey } from '@/lib/timezoneFormat';
import {
  DAY_MINUTES,
  SNAP_MIN,
  WORK_END_HOUR,
  WORK_START_HOUR,
  busyOnDay,
  clampStart,
  hourLabel,
  minuteLabel,
  offHoursOnDay,
  panelFreeWindows,
  snapMinutes,
  zoneMinuteOfDay,
  zoneWallToUtc,
  type GridPerson,
} from '@/lib/scheduleGrid';

/* ------------------------------------------------------------------ *
 * The Schedule Interview sheet's day view (2026-10-30): the Calendar
 * page's day grid turned into a picker. One zone's whole day, 00:00 →
 * 24:00, in a 360px box that scrolls; one column per panelist with their
 * own holds and their own night dimmed; one interview block across all
 * columns, placed by click, moved by drag, resized from its bottom edge.
 * ------------------------------------------------------------------ */

const HOUR_PX = 48;
const GUTTER_PX = 56;
const MIN_COL_PX = 120;
const VIEW_PX = 360;
const BODY_PX = 24 * HOUR_PX;

const C = {
  border: '#E7E8EE',
  hairline: '#F1F0EC',
  ink: '#1F2230',
  muted: '#5A6072',
  tertiary: '#8B8F9E',
  disabled: '#B5B9C4',
  purple: '#6F3FF5',
  purpleText: '#5B21B6',
  purpleLight: '#EDE4FF',
  free: '#F4EEFF',
  night: 'rgba(13,13,9,0.035)',
  red: '#FA5252',
} as const;

const HOLD_BG = 'repeating-linear-gradient(135deg, #E4E2DA 0 4px, #EDEBE4 4px 8px)';

export interface GridPanelist extends GridPerson {
  avatarUrl?: string | null;
  initials: string;
}

interface Props {
  /** "yyyy-MM-dd" of the day shown, in `timeZone` */
  dayKey: string | null;
  timeZone: string;
  panelists: GridPanelist[];
  durationMinutes: number;
  selectedStartMin: number | null;
  onSelectStartMin: (min: number) => void;
  onDurationChange: (minutes: number) => void;
  onShiftDay: (days: number) => void;
  /** False on the first bookable day, so ‹ can't go into the past. */
  canGoBack?: boolean;
  isLoading?: boolean;
  /** When rescheduling: the time it's booked at now, shown dashed. */
  originStartMin?: number | null;
  originDurationMinutes?: number | null;
}

const minToPx = (min: number) => (min / 60) * HOUR_PX;

export function DayTimeGrid({
  dayKey,
  timeZone,
  panelists,
  durationMinutes,
  selectedStartMin,
  onSelectStartMin,
  onDurationChange,
  onShiftDay,
  canGoBack = true,
  isLoading,
  originStartMin = null,
  originDurationMinutes = null,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<null | 'move' | 'resize'>(null);
  const startRef = useRef(selectedStartMin);
  startRef.current = selectedStartMin;
  const durationRef = useRef(durationMinutes);
  durationRef.current = durationMinutes;

  const columns = useMemo(
    () =>
      panelists.map((p) => ({
        person: p,
        holds: dayKey ? busyOnDay(p.busy, dayKey, timeZone) : [],
        night: dayKey ? offHoursOnDay(dayKey, timeZone, p.timeZone) : [],
        abbr: p.timeZone !== timeZone ? zoneAbbr(p.timeZone) : null,
      })),
    [panelists, dayKey, timeZone],
  );
  // With nobody on the panel yet, the one column dims the shown zone's own night.
  const ownNight = useMemo(
    () => (dayKey ? offHoursOnDay(dayKey, timeZone, timeZone) : []),
    [dayKey, timeZone],
  );
  const freeWindows = useMemo(
    () => panelFreeWindows(panelists, dayKey, timeZone),
    [panelists, dayKey, timeZone],
  );

  // The "now" line, when the shown day is today in the shown zone.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const nowMin = dayKey && zoneDayKey(now, timeZone) === dayKey ? zoneMinuteOfDay(now, timeZone) : null;

  /* ---------- scroll: open on something useful, keep the block in view ---------- */
  const firstFree = freeWindows[0]?.startMin ?? null;
  const openedFor = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || !dayKey || isLoading) return;
    const key = `${dayKey}|${timeZone}`;
    if (openedFor.current === key) return;
    openedFor.current = key;
    const target = selectedStartMin ?? firstFree ?? 9 * 60;
    el.scrollTop = Math.max(0, minToPx(target) - HOUR_PX * 0.75);
  }, [dayKey, timeZone, isLoading, selectedStartMin, firstFree]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || dragging || selectedStartMin === null) return;
    const top = minToPx(selectedStartMin);
    const bottom = minToPx(selectedStartMin + durationMinutes);
    const headerPx = 40;
    if (top < el.scrollTop) el.scrollTop = Math.max(0, top - HOUR_PX / 2);
    else if (bottom > el.scrollTop + el.clientHeight - headerPx)
      el.scrollTop = bottom - el.clientHeight + headerPx + HOUR_PX / 2;
  }, [selectedStartMin, durationMinutes, dragging]);

  /* ---------- pointer → minutes ---------- */
  const yToMinutes = (clientY: number) => {
    const el = bodyRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return Math.min(Math.max(((clientY - rect.top) / HOUR_PX) * 60, 0), DAY_MINUTES);
  };

  // Near the top or bottom edge of the box while dragging, keep scrolling.
  const edgeScroll = (clientY: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (clientY < rect.top + 56) el.scrollTop -= 10;
    else if (clientY > rect.bottom - 16) el.scrollTop += 10;
  };

  // A click places it (a click never follows a scroll, so touch scrolling stays free).
  const placeAt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragging || e.button !== 0) return;
    const m = yToMinutes(e.clientY);
    if (m === null) return;
    onSelectStartMin(clampStart(Math.floor(m / SNAP_MIN) * SNAP_MIN, durationMinutes));
  };

  const beginGesture = (e: React.PointerEvent<HTMLElement>, mode: 'move' | 'resize') => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startAtDown = startRef.current;
    const downMin = yToMinutes(e.clientY);
    if (startAtDown === null || downMin === null) return;
    const grab = mode === 'move' ? downMin - startAtDown : 0;
    setDragging(mode);
    const onMove = (ev: PointerEvent) => {
      edgeScroll(ev.clientY);
      const m = yToMinutes(ev.clientY);
      if (m === null) return;
      if (mode === 'move') {
        onSelectStartMin(clampStart(snapMinutes(m - grab), durationRef.current));
      } else {
        const anchor = startRef.current ?? startAtDown;
        onDurationChange(Math.min(Math.max(snapMinutes(m - anchor), SNAP_MIN), DAY_MINUTES - anchor));
      }
    };
    const onUp = () => {
      setDragging(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const onBlockKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (selectedStartMin === null) return;
    const step = e.shiftKey ? 60 : SNAP_MIN;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = selectedStartMin + (e.key === 'ArrowUp' ? -step : step);
      onSelectStartMin(clampStart(next, durationMinutes));
    }
  };

  const dayLabel = dayKey
    ? formatInTimeZone(zoneWallToUtc(dayKey, 12 * 60, timeZone), timeZone, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Pick a date';
  const isToday = !!dayKey && zoneDayKey(new Date(), timeZone) === dayKey;
  const colTemplate = `repeat(${Math.max(columns.length, 1)}, minmax(${MIN_COL_PX}px, 1fr))`;
  const minWidth = GUTTER_PX + Math.max(columns.length, 1) * MIN_COL_PX;
  const selEnd = selectedStartMin !== null ? selectedStartMin + durationMinutes : null;
  const zoneShort = zoneAbbr(timeZone);
  const anyAbroad = columns.some((c) => c.abbr);

  return (
    <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: C.border }}>
      {/* Day bar */}
      <div className="flex items-center gap-1.5 px-2 h-10 border-b" style={{ borderColor: C.hairline }}>
        <IconTip label="Previous day" side="top">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => onShiftDay(-1)}
            disabled={!dayKey || !canGoBack}
            className="gio-pressable inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5A6072] hover:bg-[#F1F0EC] hover:text-[#1F2230] transition-colors duration-hover disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </IconTip>
        <IconTip label="Next day" side="top">
          <button
            type="button"
            aria-label="Next day"
            onClick={() => onShiftDay(1)}
            disabled={!dayKey}
            className="gio-pressable inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5A6072] hover:bg-[#F1F0EC] hover:text-[#1F2230] transition-colors duration-hover disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </IconTip>
        <span className="font-inter text-[12.5px] font-semibold truncate" style={{ color: isToday ? C.purple : C.ink }}>
          {dayLabel}
        </span>
        {isToday && (
          <span
            className="font-inter text-[10px] font-semibold rounded-full px-[7px] py-[2px] shrink-0"
            style={{ color: C.purpleText, background: C.purpleLight }}
          >
            Today
          </span>
        )}
        <span className="ml-auto font-inter text-[11px] tabular-nums shrink-0" style={{ color: C.tertiary }}>
          Times in {zoneShort}
        </span>
      </div>

      {/* One box scrolls both ways; header row and hour gutter stay put. */}
      <div
        ref={scrollerRef}
        className="relative overflow-auto overscroll-contain"
        style={{ height: VIEW_PX }}
        data-no-swipe
      >
        <div style={{ minWidth, position: 'relative' }}>
          {/* Header row */}
          <div
            className="sticky top-0 z-30 grid bg-white border-b"
            style={{ gridTemplateColumns: `${GUTTER_PX}px minmax(0,1fr)`, borderColor: C.hairline }}
          >
            <div className="sticky left-0 z-10 bg-white" />
            <div className="grid" style={{ gridTemplateColumns: colTemplate }}>
              {columns.length === 0 ? (
                <div className="h-10 flex items-center px-2.5 font-inter text-[11.5px] border-l" style={{ color: C.tertiary, borderColor: C.hairline }}>
                  No panelists yet
                </div>
              ) : (
                columns.map(({ person, abbr }) => (
                  <div key={person.id} className="h-10 min-w-0 flex items-center gap-1.5 px-2.5 border-l" style={{ borderColor: C.hairline }}>
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarImage src={person.avatarUrl || undefined} />
                      <AvatarFallback className="text-[9px]">{person.initials}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 truncate font-inter text-[12px] font-medium" style={{ color: C.ink }}>
                      {person.name.split(' ')[0]}
                    </span>
                    {abbr && (
                      <span className="shrink-0 rounded-[5px] px-1 py-px font-inter text-[10px] font-medium tabular-nums" style={{ color: C.muted, background: C.hairline }}>
                        {abbr}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Body */}
          <div className="grid" style={{ gridTemplateColumns: `${GUTTER_PX}px minmax(0,1fr)`, height: BODY_PX }}>
            {/* Hour gutter */}
            <div className="sticky left-0 z-20 bg-white" aria-hidden>
              {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
                <span
                  key={h}
                  className="absolute right-2 -translate-y-1/2 font-inter text-[10px] tabular-nums whitespace-nowrap"
                  style={{ top: h * HOUR_PX, color: C.tertiary }}
                >
                  {hourLabel(h)}
                </span>
              ))}
            </div>

            {/* Columns */}
            <div
              ref={bodyRef}
              className="relative cursor-pointer select-none"
              style={{
                touchAction: 'pan-x pan-y',
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR_PX - 1}px, ${C.hairline} ${HOUR_PX - 1}px ${HOUR_PX}px)`,
              }}
              onClick={placeAt}
            >
              {/* Whole panel free */}
              {!isLoading &&
                freeWindows.map((w) => (
                  <div
                    key={`f-${w.startMin}`}
                    className="absolute inset-x-0 pointer-events-none"
                    style={{ top: minToPx(w.startMin), height: minToPx(w.endMin - w.startMin), background: C.free }}
                  />
                ))}

              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: colTemplate }}>
                {(columns.length ? columns : [null]).map((col, ci) => (
                  <div key={col?.person.id ?? 'empty'} className="relative border-l" style={{ borderColor: C.hairline }}>
                    {isLoading ? (
                      <Skeleton className="absolute inset-x-1.5 rounded-md" style={{ top: minToPx(9 * 60), height: minToPx(2 * 60) }} />
                    ) : (
                      <>
                          {(col ? col.night : ownNight).map((r) => (
                            <div
                              key={`pn-${ci}-${r.startMin}`}
                              className="absolute inset-x-0 pointer-events-none"
                              style={{ top: minToPx(r.startMin), height: minToPx(r.endMin - r.startMin), background: C.night }}
                            />
                          ))}
                          {col?.holds.map((r) => {
                            const h = minToPx(r.endMin - r.startMin);
                            return (
                              <div
                                key={`${r.hold.start}-${r.hold.end}`}
                                className="absolute left-1.5 right-1.5 rounded-[6px] overflow-hidden pointer-events-none"
                                style={{
                                  top: minToPx(r.startMin) + 1,
                                  height: Math.max(h - 2, 6),
                                  backgroundImage: HOLD_BG,
                                  borderLeft: '3px solid #C9CBD3',
                                }}
                              >
                                {h >= 22 && (
                                  <span className="block truncate px-1.5 pt-[3px] font-inter text-[10.5px] font-medium" style={{ color: C.muted }}>
                                    {r.hold.title || 'Busy'} · {minuteLabel(dayKey!, r.startMin, timeZone).replace(':00', '')}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </>
                    )}
                  </div>
                ))}
              </div>

              {/* Currently booked (reschedule) */}
              {originStartMin !== null && originDurationMinutes ? (
                <div
                  className="absolute inset-x-1 rounded-[7px] border border-dashed pointer-events-none z-[3]"
                  style={{
                    top: minToPx(originStartMin),
                    height: minToPx(originDurationMinutes),
                    borderColor: C.purple,
                  }}
                />
              ) : null}

              {/* Now */}
              {nowMin !== null && (
                <div className="absolute inset-x-0 pointer-events-none z-[4]" style={{ top: minToPx(nowMin), height: 2, background: C.red }}>
                  <span className="absolute -left-1 -top-[3px] rounded-full" style={{ width: 8, height: 8, background: C.red }} />
                </div>
              )}

              {/* The interview, across every column */}
              {selectedStartMin !== null && selEnd !== null && dayKey && (
                <div
                  role="slider"
                  tabIndex={0}
                  aria-label="Interview time"
                  aria-valuemin={0}
                  aria-valuemax={DAY_MINUTES - durationMinutes}
                  aria-valuenow={selectedStartMin}
                  aria-valuetext={`${minuteLabel(dayKey, selectedStartMin, timeZone)} to ${minuteLabel(dayKey, selEnd, timeZone)}`}
                  onKeyDown={onBlockKey}
                  onPointerDown={(e) => beginGesture(e, 'move')}
                  // The click that ends a drag must not place the block again.
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'absolute inset-x-1 z-[5] rounded-[7px] border-2',
                    dragging === 'move' ? 'cursor-grabbing' : 'cursor-grab',
                  )}
                  style={{
                    top: minToPx(selectedStartMin),
                    height: minToPx(durationMinutes),
                    borderColor: C.purple,
                    background: 'rgba(111,63,245,0.14)',
                    touchAction: 'none',
                  }}
                >
                  {minToPx(durationMinutes) >= 22 && (
                    <span className="absolute left-0 top-0 rounded-br-[6px] px-1.5 py-[2px] font-inter text-[10.5px] font-semibold text-white tabular-nums whitespace-nowrap" style={{ background: C.purple }}>
                      {minuteLabel(dayKey, selectedStartMin, timeZone)} – {minuteLabel(dayKey, selEnd, timeZone)}
                    </span>
                  )}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-[3px] h-[7px] cursor-ns-resize"
                    onPointerDown={(e) => beginGesture(e, 'resize')}
                  >
                    <span className="absolute left-1/2 top-[1px] h-[3px] w-6 -translate-x-1/2 rounded-full" style={{ background: C.purple }} />
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-2.5 py-[7px]" style={{ borderColor: C.hairline, background: '#FAFAF7' }}>
        <LegendSwatch style={{ background: C.free, border: '1px solid #E4D8FD' }} label="Panel free" />
        <LegendSwatch style={{ backgroundImage: HOLD_BG }} label="Busy" />
        <LegendSwatch style={{ background: 'rgba(111,63,245,0.14)', border: `1.5px solid ${C.purple}` }} label="This interview" />
        <LegendSwatch
          style={{ background: 'rgba(13,13,9,0.07)' }}
          label={anyAbroad ? `Outside ${WORK_START_HOUR} AM–${WORK_END_HOUR - 12} PM their time` : `Outside ${WORK_START_HOUR} AM–${WORK_END_HOUR - 12} PM`}
        />
        <span className="ml-auto font-inter text-[10.5px] whitespace-nowrap" style={{ color: C.tertiary }}>
          Busy times don't block booking
        </span>
      </div>
    </div>
  );
}

function LegendSwatch({ style, label }: { style: React.CSSProperties; label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-inter text-[10.5px]" style={{ color: C.muted }}>
      <span className="inline-block rounded-[2px]" style={{ width: 12, height: 8, ...style }} />
      {label}
    </span>
  );
}
