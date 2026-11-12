import { useEffect, useMemo, useRef } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Loadable } from '@/components/ui/loadable';
import { LoadError } from '@/components/empty/LoadError';
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty';
import { useLoadTimeout } from '@/hooks/useLoadTimeout';
import { prefersReducedMotion } from '@/lib/motion';
import {
  callLength,
  clock,
  firefliesUrl,
  turnAt,
  useInterviewTranscript,
  type NotesStatusView,
} from '@/lib/interviewNotes';
import { cn } from '@/lib/utils';

/**
 * Interview notes, step 5 (2026-11-12): the status line on an interview's scorecard
 * and the Transcript tab beside it.
 */

const TONE: Record<NotesStatusView['tone'], { Icon: typeof Info | null; color: string }> = {
  working: { Icon: null, color: '#5B21B6' },
  done: { Icon: CheckCircle2, color: '#0E7A53' },
  note: { Icon: Info, color: '#6B7080' },
  problem: { Icon: AlertCircle, color: '#B91C1C' },
};

/** One line: where Gio's notes got to, with Retry when it would help. */
export function InterviewNotesStatusLine({
  view,
  onRetry,
  retrying,
}: {
  view: NotesStatusView;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const tone = TONE[view.tone];
  const Icon = tone.Icon;
  return (
    <div role="status" className="flex min-w-0 items-center gap-1.5 font-inter text-[12.5px] leading-5" style={{ color: tone.color }}>
      {Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <span className="gio-spinner gio-spinner-current h-3 w-3 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0 truncate">{view.text}</span>
      {view.retry && onRetry && (
        <>
          <span aria-hidden="true" className="text-[#B5B9C4]">·</span>
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="gio-pressable inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded font-medium text-[#5B21B6] underline-offset-2 hover:underline disabled:opacity-60"
          >
            {retrying && <span className="gio-spinner gio-spinner-current h-3 w-3" aria-hidden="true" />}
            {view.retry}
          </button>
        </>
      )}
    </div>
  );
}

const SPEAKER_TONES = ['#5B21B6', '#0E7A53', '#B45309', '#1C7ED6', '#D6336C'];

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German', it: 'Italian' };
function languageName(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? LANGUAGE_NAMES[code.split('-')[0]] ?? code;
  } catch {
    return LANGUAGE_NAMES[code.split('-')[0]] ?? code;
  }
}

function TranscriptSkeleton() {
  return (
    <div className="space-y-5 p-6">
      <Skeleton className="h-4 w-48" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[48px_1fr] gap-3">
          <Skeleton className="h-3.5 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The conversation as Fireflies wrote it down: each turn with its time and speaker,
 * and "Open in Fireflies". `focus` (a moment in seconds, with a key so the same moment
 * can be asked for twice) scrolls to that turn and flashes it.
 */
export function TranscriptPanel({
  bookingId,
  active,
  focus,
  emptyReason,
}: {
  bookingId: string | null;
  active: boolean;
  focus: { seconds: number; key: number } | null;
  /** Why there's no conversation to show, when the status line knows. */
  emptyReason?: string | null;
}) {
  const query = useInterviewTranscript(bookingId, active);
  const loading = query.isLoading && query.fetchStatus !== 'idle';
  const timedOut = useLoadTimeout(loading, query.errorUpdatedAt);
  const listRef = useRef<HTMLOListElement>(null);
  const data = query.data;
  const turns = useMemo(() => data?.turns ?? [], [data]);

  useEffect(() => {
    if (!active || !focus || !turns.length || !listRef.current) return;
    const index = turnAt(turns, focus.seconds);
    const el = listRef.current.querySelector<HTMLElement>(`[data-turn="${index}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    el.classList.remove('gio-saved-flash');
    void el.offsetWidth;
    el.classList.add('gio-saved-flash');
    const t = window.setTimeout(() => el.classList.remove('gio-saved-flash'), 1400);
    return () => window.clearTimeout(t);
  }, [active, focus, turns]);

  if (query.isError || timedOut) {
    return (
      <div className="p-8">
        <LoadError what="the transcript" timedOut={timedOut && !query.isError} onRetry={() => void query.refetch()} compact />
      </div>
    );
  }

  const link = firefliesUrl(data?.externalId);
  const meta = [languageName(data?.language), callLength(data?.durationSeconds), data?.speakers.length ? `${data.speakers.length} ${data.speakers.length === 1 ? 'speaker' : 'speakers'}` : null]
    .filter(Boolean)
    .join(' · ');
  const tones = new Map((data?.speakers ?? []).map((s, i) => [s, SPEAKER_TONES[i % SPEAKER_TONES.length]]));

  return (
    <Loadable loading={loading} skeleton={<TranscriptSkeleton />}>
      {!bookingId || !turns.length ? (
        <div className="p-6">
          <AnimatedEmpty
            scene="search"
            size="compact"
            onceKey="scorecard-transcript-empty"
            title="No transcript for this interview"
            body={
              emptyReason ||
              (data && data.source !== 'fireflies_api'
                ? "Only the note-taker's summary reached Gio, so there's no conversation to show."
                : "When the note-taker's email for this interview reaches Gio, the conversation shows here.")
            }
          />
        </div>
      ) : (
        <div className="px-6 pb-6">
          <div className="sticky top-0 z-[1] -mx-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[#E7E8EE] bg-[#FAFAF7] px-6 pb-3 pt-1">
            <div className="min-w-0">
              <div className="font-poppins text-[14px] font-semibold tracking-[-0.01em] text-[#1F2230]">Transcript</div>
              {meta && <div className="font-inter text-[12px] tabular-nums text-[#6B7080]">{meta}</div>}
            </div>
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="gio-pressable inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E7E8EE] bg-white px-3 font-poppins text-[12.5px] font-medium text-[#1F2230] hover:bg-[#F7F6F2]"
              >
                Open in Fireflies
                <ExternalLink className="h-3.5 w-3.5 text-[#6B7080]" aria-hidden="true" />
              </a>
            )}
          </div>
          <ol ref={listRef} className="mt-1">
            {turns.map((t, i) => (
              <li
                key={i}
                data-turn={i}
                className={cn('relative grid grid-cols-[48px_1fr] gap-3 rounded-lg px-2 py-2.5', turns.length > 100 && 'gio-cv-row')}
              >
                <span className="pt-px font-inter text-[11.5px] tabular-nums text-[#6B7080]">{clock(t.start)}</span>
                <div className="min-w-0">
                  <div className="truncate font-inter text-[12.5px] font-semibold" style={{ color: tones.get(t.speaker) ?? '#1F2230' }}>
                    {t.speaker}
                  </div>
                  <p className="mt-0.5 font-inter text-[13px] leading-[1.6] text-[#1F2230] [overflow-wrap:anywhere]">{t.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Loadable>
  );
}
