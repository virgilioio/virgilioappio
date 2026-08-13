import { useCallback, useMemo, useRef, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

/* ------------------------------------------------------------------ *
 * Geometry — day runs 9:00 → 18:00. Every bar is positioned purely in
 * percentages of its own clipped track (no calc(), no pixel offsets).
 * ------------------------------------------------------------------ */
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 18;
const DAY_HOURS = DAY_END_HOUR - DAY_START_HOUR;
const SNAP_MIN = 15;

/** minutes from midnight → % of the track */
export const pctOfMinutes = (min: number) =>
  ((min / 60 - DAY_START_HOUR) / DAY_HOURS) * 100;

const clampMin = (m: number) =>
  Math.min(Math.max(m, DAY_START_HOUR * 60), DAY_END_HOUR * 60);

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

export interface BusyInterval {
  start: string;
  end: string;
  title?: string;
}

export interface StripPanelist {
  id: string;
  name: string;
  avatarUrl?: string | null;
  initials: string;
  busy: BusyInterval[];
}

export interface FreeWindow {
  startMin: number;
  endMin: number;
}

/* ------------------------------------------------------------------ *
 * Free-window computation: merge every panelist's busy intervals for
 * the day, invert across 9→18, keep gaps of at least 30 minutes.
 * ------------------------------------------------------------------ */
export function computeFreeWindows(
  panelists: StripPanelist[],
  date: Date | null,
  minGap = 30,
): FreeWindow[] {
  if (!date) return [];
  const raw: FreeWindow[] = [];
  panelists.forEach((p) =>
    p.busy.forEach((b) => {
      const s = new Date(b.start);
      const e = new Date(b.end);
      if (!isSameDay(s, date)) return;
      const startMin = clampMin(minutesOf(s));
      const endMin = clampMin(minutesOf(e));
      if (endMin > startMin) raw.push({ startMin, endMin });
    }),
  );
  raw.sort((a, b) => a.startMin - b.startMin);

  const merged: FreeWindow[] = [];
  raw.forEach((iv) => {
    const last = merged[merged.length - 1];
    if (last && iv.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, iv.endMin);
    } else {
      merged.push({ ...iv });
    }
  });

  const free: FreeWindow[] = [];
  let cursor = DAY_START_HOUR * 60;
  merged.forEach((iv) => {
    if (iv.startMin - cursor >= minGap) free.push({ startMin: cursor, endMin: iv.startMin });
    cursor = Math.max(cursor, iv.endMin);
  });
  if (DAY_END_HOUR * 60 - cursor >= minGap)
    free.push({ startMin: cursor, endMin: DAY_END_HOUR * 60 });
  return free;
}

export interface OverlapHit {
  name: string;
  title: string;
}

/** Which panelist events does the chosen window cross? Informational only. */
export function findOverlaps(
  panelists: StripPanelist[],
  date: Date | null,
  startMin: number,
  endMin: number,
): OverlapHit[] {
  if (!date) return [];
  const hits: OverlapHit[] = [];
  panelists.forEach((p) =>
    p.busy.forEach((b) => {
      const s = new Date(b.start);
      const e = new Date(b.end);
      if (!isSameDay(s, date)) return;
      const bs = minutesOf(s);
      const be = minutesOf(e);
      if (startMin < be && endMin > bs) {
        hits.push({ name: p.name.split(' ')[0], title: b.title || 'a hold' });
      }
    }),
  );
  return hits;
}

export function minutesToLabel(date: Date, min: number) {
  const d = new Date(date);
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return format(d, 'h:mm a');
}

/* ------------------------------------------------------------------ */

const HOUR_TICKS = Array.from({ length: DAY_HOURS + 1 }, (_, i) => DAY_START_HOUR + i);
const hourLabel = (h: number) => {
  if (h === 9) return '9a';
  if (h === 12) return '12p';
  if (h === 18) return '6p';
  return h > 12 ? `${h - 12}` : `${h}`;
};

function Gridlines() {
  return (
    <>
      {HOUR_TICKS.slice(1, -1).map((h) => (
        <span
          key={h}
          className="absolute top-0 bottom-0 w-px pointer-events-none"
          style={{ left: `${pctOfMinutes(h * 60)}%`, background: 'rgba(13,13,9,0.045)' }}
        />
      ))}
    </>
  );
}

/** Lane row — declared at module scope so lanes never remount mid-gesture. */
function Row({
  label,
  children,
  className,
  trackRef,
  trackClassName,
  trackStyle,
  onTrackPointerDown,
}: {
  label: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  trackRef?: React.Ref<HTMLDivElement>;
  trackClassName?: string;
  trackStyle?: React.CSSProperties;
  onTrackPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={cn('grid items-center', className)}
      style={{ gridTemplateColumns: '64px minmax(0, 1fr)' }}
    >
      <div className="min-w-0 pr-1">{label}</div>
      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        className={cn(
          'relative my-1 mx-1.5 rounded-[3px] cursor-pointer overflow-hidden',
          trackClassName,
        )}
        style={trackStyle}
      >
        <Gridlines />
        {children}
      </div>
    </div>
  );
}


interface Props {
  date: Date | null;
  panelists: StripPanelist[];
  durationMinutes: number;
  /** minutes-from-midnight start of the selection, or null */
  selectedStartMin: number | null;
  onSelectStartMin: (min: number) => void;
  onDurationChange: (minutes: number) => void;
  isLoading?: boolean;
}

export function AvailabilityStrip({
  date,
  panelists,
  durationMinutes,
  selectedStartMin,
  onSelectStartMin,
  onDurationChange,
  isLoading,
}: Props) {
  const freeWindows = useMemo(() => computeFreeWindows(panelists, date), [panelists, date]);
  const [drag, setDrag] = useState<null | 'move' | 'resize'>(null);

  const maxStart = DAY_END_HOUR * 60 - durationMinutes;

  const xToMinutes = useCallback((clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const raw = DAY_START_HOUR * 60 + pct * DAY_HOURS * 60;
    return Math.round(raw / SNAP_MIN) * SNAP_MIN;
  }, []);

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag) return;
    const start = Math.min(Math.max(xToMinutes(e.clientX, e.currentTarget), DAY_START_HOUR * 60), maxStart);
    onSelectStartMin(start);
  };

  /** Drag / resize of the selection block, tracked on the window. */
  const beginPointerGesture = (
    e: React.PointerEvent,
    mode: 'move' | 'resize',
    track: HTMLElement | null,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!track || selectedStartMin === null) return;
    setDrag(mode);
    const grabOffset =
      mode === 'move' ? xToMinutes(e.clientX, track) - selectedStartMin : 0;

    const onMove = (ev: PointerEvent) => {
      const m = xToMinutes(ev.clientX, track);
      if (mode === 'move') {
        onSelectStartMin(
          Math.min(Math.max(m - grabOffset, DAY_START_HOUR * 60), DAY_END_HOUR * 60 - durationMinutes),
        );
      } else {
        const next = Math.min(Math.max(m - selectedStartMin, SNAP_MIN), DAY_END_HOUR * 60 - selectedStartMin);
        onDurationChange(next);
      }
    };
    const onUp = () => {
      setDrag(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const bookTrackRef = useRef<HTMLDivElement>(null);

  const selEnd = selectedStartMin !== null ? selectedStartMin + durationMinutes : null;
  const selLeft = selectedStartMin !== null ? pctOfMinutes(selectedStartMin) : 0;
  const selWidth =
    selectedStartMin !== null && selEnd !== null
      ? pctOfMinutes(selEnd) - pctOfMinutes(selectedStartMin)
      : 0;

  const busyBars = (p: StripPanelist) =>
    p.busy
      .map((b) => {
        const s = new Date(b.start);
        const e = new Date(b.end);
        if (!date || !isSameDay(s, date)) return null;
        const startMin = clampMin(minutesOf(s));
        const endMin = clampMin(minutesOf(e));
        if (endMin <= startMin) return null;
        return {
          key: `${b.start}-${b.end}`,
          left: pctOfMinutes(startMin),
          width: pctOfMinutes(endMin) - pctOfMinutes(startMin),
          tooltip: `${b.title || 'Busy'} · ${minutesToLabel(date, startMin)}–${minutesToLabel(
            date,
            endMin,
          )} — bookable anyway`,
        };
      })
      .filter(Boolean) as { key: string; left: number; width: number; tooltip: string }[];

  const Row = ({
    label,
    children,
    className,
    trackRef,
    trackClassName,
    trackStyle,
  }: {
    label: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    trackRef?: React.Ref<HTMLDivElement>;
    trackClassName?: string;
    trackStyle?: React.CSSProperties;
  }) => (
    <div
      className={cn('grid items-center', className)}
      style={{ gridTemplateColumns: '64px minmax(0, 1fr)' }}
    >
      <div className="min-w-0 pr-1">{label}</div>
      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        className={cn(
          'relative my-1 mx-1.5 rounded-[3px] cursor-pointer overflow-hidden',
          trackClassName,
        )}
        style={trackStyle}
      >
        <Gridlines />
        {children}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-[#E7E8EE] bg-white overflow-hidden">
      {/* Hour ruler */}
      <div
        className="grid items-center pt-2"
        style={{ gridTemplateColumns: '64px minmax(0, 1fr)' }}
      >
        <div />
        <div className="relative h-4 mx-1.5">
          {HOUR_TICKS.map((h) => (
            <span
              key={h}
              className="absolute top-0 text-[10px] font-inter text-[#8B8F9E] whitespace-nowrap"
              style={{
                left: `${pctOfMinutes(h * 60)}%`,
                transform:
                  h === DAY_START_HOUR
                    ? 'none'
                    : h === DAY_END_HOUR
                    ? 'translateX(-100%)'
                    : 'translateX(-50%)',
              }}
            >
              {hourLabel(h)}
            </span>
          ))}
        </div>
      </div>

      {/* Lanes + selection band */}
      <div className="relative pb-1">
        {panelists.length === 0 ? (
          <Row
            label={<span className="text-[10px] font-inter text-[#8B8F9E]">—</span>}
            trackClassName="h-6 bg-[#FAFAF7] border border-[#E7E8EE]"
          />
        ) : (
          panelists.map((p) => (
            <Row
              key={p.id}
              label={
                <div className="flex items-center gap-1.5 min-w-0">
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={p.avatarUrl || undefined} />
                    <AvatarFallback className="text-[9px]">{p.initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-[11.5px] font-inter text-[#1F2230] truncate">
                    {p.name.split(' ')[0]}
                  </span>
                </div>
              }
              trackClassName="h-6 bg-white border border-[#E7E8EE]"
            >
              {isLoading ? (
                <Skeleton className="absolute inset-0" />
              ) : (
                busyBars(p).map((b) => (
                  <div
                    key={b.key}
                    title={b.tooltip}
                    className="absolute top-0 bottom-0 rounded-[3px]"
                    style={{
                      left: `${b.left}%`,
                      width: `${b.width}%`,
                      backgroundImage:
                        'repeating-linear-gradient(135deg, #E4E2DA 0 4px, #EDEBE4 4px 8px)',
                    }}
                  />
                ))
              )}
            </Row>
          ))
        )}

        {/* BOOK lane */}
        <Row
          className="pt-1 border-t border-[#F1F0EC]"
          label={
            <span className="text-[10px] font-poppins font-semibold uppercase tracking-[0.08em] text-[#6F3FF5]">
              Book
            </span>
          }
          trackRef={bookTrackRef}
          trackClassName="h-7 bg-[#FAF8FF] border border-[#EDE4FF]"
        >
          {isLoading ? (
            <Skeleton className="absolute inset-0" />
          ) : (
            <>
              {freeWindows.map((w) => (
                <button
                  key={`${w.startMin}-${w.endMin}`}
                  type="button"
                  title={
                    date
                      ? `Panel free ${minutesToLabel(date, w.startMin)}–${minutesToLabel(
                          date,
                          w.endMin,
                        )}`
                      : undefined
                  }
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelectStartMin(Math.min(w.startMin, maxStart));
                  }}
                  className="absolute top-0.5 bottom-0.5 rounded-[4px] bg-[#DDCAFA]"
                  style={{
                    left: `${pctOfMinutes(w.startMin)}%`,
                    width: `${pctOfMinutes(w.endMin) - pctOfMinutes(w.startMin)}%`,
                  }}
                />
              ))}

              {selectedStartMin !== null && date && (
                <div
                  className="absolute -top-0.5 -bottom-0.5 rounded-[4px] bg-[#6F3FF5] border-2 border-[#0d0d09] flex items-center justify-center z-10 cursor-grab active:cursor-grabbing"
                  style={{ left: `${selLeft}%`, width: `${selWidth}%` }}
                  onPointerDown={(e) => beginPointerGesture(e, 'move', bookTrackRef.current)}
                >
                  {durationMinutes >= 30 && (
                    <span className="text-[10px] font-poppins font-semibold text-white truncate px-1">
                      {minutesToLabel(date, selectedStartMin).replace(':00', '')}
                    </span>
                  )}
                  <span
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize"
                    onPointerDown={(e) => beginPointerGesture(e, 'resize', bookTrackRef.current)}
                  />
                </div>
              )}
            </>
          )}
        </Row>

        {/* Selection band across all lanes */}
        {selectedStartMin !== null && (
          <div
            className="absolute inset-y-0 pointer-events-none"
            style={{ left: '64px', right: 0 }}
          >
            <div className="relative h-full mx-1.5">
              <div
                className="absolute inset-y-0"
                style={{
                  left: `${selLeft}%`,
                  width: `${selWidth}%`,
                  background: 'rgba(111,63,245,0.07)',
                  borderLeft: '1px solid rgba(111,63,245,0.45)',
                  borderRight: '1px solid rgba(111,63,245,0.45)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t border-[#F1F0EC] bg-[#FAFAF7] px-2.5 py-[7px]">
        <span className="flex items-center gap-1.5 text-[10.5px] font-inter text-[#5A6072]">
          <span className="inline-block rounded-[2px] bg-[#DDCAFA]" style={{ width: 12, height: 8 }} />
          Panel free
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] font-inter text-[#5A6072]">
          <span
            className="inline-block rounded-[2px]"
            style={{
              width: 12,
              height: 8,
              backgroundImage:
                'repeating-linear-gradient(135deg, #E4E2DA 0 4px, #EDEBE4 4px 8px)',
            }}
          />
          Existing hold
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] font-inter text-[#5A6072]">
          <span
            className="inline-block rounded-[2px] bg-[#6F3FF5] border border-[#0d0d09]"
            style={{ width: 12, height: 8 }}
          />
          This interview
        </span>
        <span className="ml-auto text-[10.5px] font-inter text-[#8B8F9E] whitespace-nowrap">
          Holds don't block booking
        </span>
      </div>
    </div>
  );
}
