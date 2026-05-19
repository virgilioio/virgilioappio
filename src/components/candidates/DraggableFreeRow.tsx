import { useEffect, useRef, useState } from 'react';
import { parseISO, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type Slot = { start: string; end: string };

interface Props {
  slots: Slot[];
  selectedSlot: Slot | null;
  onSelect: (slot: Slot) => void;
  durationMinutes: number;
  isLoading: boolean;
}

const DAY_START_HOUR = 9;
const DAY_HOURS = 8;

const hoursOf = (iso: string) => {
  const d = parseISO(iso);
  return d.getHours() + d.getMinutes() / 60;
};

const pctLeft = (iso: string) =>
  Math.max(0, ((hoursOf(iso) - DAY_START_HOUR) / DAY_HOURS) * 100);

const pctWidth = (durationMinutes: number) =>
  (durationMinutes / 60 / DAY_HOURS) * 100;

export function DraggableFreeRow({
  slots,
  selectedSlot,
  onSelect,
  durationMinutes,
  isLoading,
}: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragLeftPct, setDragLeftPct] = useState<number | null>(null);
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);

  const width = pctWidth(durationMinutes);

  // Snap a left% to the nearest available slot left%
  const snapToNearest = (leftPct: number): Slot | null => {
    if (!slots.length) return null;
    let best = slots[0];
    let bestDist = Infinity;
    for (const s of slots) {
      const d = Math.abs(pctLeft(s.start) - leftPct);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  };

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const row = rowRef.current;
      if (!row) return;
      const rect = row.getBoundingClientRect();
      const xPct = Math.min(
        Math.max(((e.clientX - rect.left) / rect.width) * 100 - width / 2, 0),
        100 - width,
      );
      setDragLeftPct(xPct);
      const snapped = snapToNearest(xPct);
      if (snapped) {
        setPreviewLabel(format(parseISO(snapped.start), 'h:mm a'));
      }
    };

    const onUp = () => {
      setDragging(false);
      if (dragLeftPct !== null) {
        const snapped = snapToNearest(dragLeftPct);
        if (snapped) onSelect(snapped);
      }
      setDragLeftPct(null);
      setPreviewLabel(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, dragLeftPct, slots, width, onSelect]);

  return (
    <div
      ref={rowRef}
      className="relative h-7 flex-1 rounded-md bg-white border border-virgilio-border/60 overflow-visible select-none"
      style={{
        backgroundImage:
          'repeating-linear-gradient(to right, transparent 0, transparent calc(12.5% - 1px), hsl(var(--border) / 0.5) calc(12.5% - 1px), hsl(var(--border) / 0.5) 12.5%)',
      }}
    >
      {isLoading ? (
        <Skeleton className="absolute inset-0" />
      ) : slots.length === 0 ? (
        <span className="absolute inset-0 flex items-center justify-center text-body-xs text-virgilio-muted">
          No slots — try another day.
        </span>
      ) : (
        <>
          {/* Tick marks for every valid slot */}
          {slots.map((s) => {
            const left = pctLeft(s.start);
            const isSel = selectedSlot?.start === s.start;
            if (isSel && dragging) return null;
            return (
              <button
                key={s.start}
                type="button"
                onClick={() => onSelect(s)}
                title={`${format(parseISO(s.start), 'h:mm a')} – ${format(
                  new Date(parseISO(s.start).getTime() + durationMinutes * 60000),
                  'h:mm a',
                )}`}
                className={cn(
                  'absolute top-0 bottom-0 rounded-md flex items-center justify-center text-[10.5px] font-poppins font-medium transition-colors',
                  isSel
                    ? 'bg-virgilio-purple text-white ring-2 ring-virgilio-ink z-10 cursor-grab active:cursor-grabbing'
                    : 'bg-[hsl(var(--badge-lilac))] hover:bg-pastel-purple text-[hsl(var(--badge-lilac-foreground))]',
                )}
                style={{ left: `${left}%`, width: `${width}%` }}
                onPointerDown={(e) => {
                  if (!isSel) return;
                  e.preventDefault();
                  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  setDragLeftPct(left);
                  setDragging(true);
                  setPreviewLabel(format(parseISO(s.start), 'h:mm a'));
                }}
                onKeyDown={(e) => {
                  if (!isSel) return;
                  const idx = slots.findIndex((x) => x.start === s.start);
                  if (e.key === 'ArrowLeft' && idx > 0) {
                    e.preventDefault();
                    onSelect(slots[idx - 1]);
                  } else if (e.key === 'ArrowRight' && idx < slots.length - 1) {
                    e.preventDefault();
                    onSelect(slots[idx + 1]);
                  } else if (e.key === 'Home') {
                    e.preventDefault();
                    onSelect(slots[0]);
                  } else if (e.key === 'End') {
                    e.preventDefault();
                    onSelect(slots[slots.length - 1]);
                  }
                }}
              >
                {isSel ? format(parseISO(s.start), 'h:mm') : ''}
              </button>
            );
          })}

          {/* Drag ghost pill — follows the cursor */}
          {dragging && dragLeftPct !== null && selectedSlot && (
            <>
              <button
                ref={pillRef}
                type="button"
                tabIndex={-1}
                className="absolute top-0 bottom-0 rounded-md flex items-center justify-center text-[10.5px] font-poppins font-medium bg-virgilio-purple text-white ring-2 ring-virgilio-ink shadow-[0_4px_12px_-2px_rgba(0,0,0,0.25)] z-20 cursor-grabbing"
                style={{
                  left: `${dragLeftPct}%`,
                  width: `${width}%`,
                  transform: 'scale(1.02)',
                }}
              >
                {previewLabel ? previewLabel.replace(/\s?[AP]M/, '') : ''}
              </button>
              {previewLabel && (
                <span
                  className="absolute -top-6 px-1.5 py-0.5 rounded bg-virgilio-ink text-white text-[10px] font-poppins font-medium pointer-events-none whitespace-nowrap z-30"
                  style={{ left: `calc(${dragLeftPct + width / 2}% - 24px)` }}
                >
                  {previewLabel}
                </span>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
