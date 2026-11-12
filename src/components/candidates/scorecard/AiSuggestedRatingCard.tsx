import { useState } from 'react';
import { IconSwap } from '@/components/ui/icon-swap';
import { ChevronDown, Copy, Check, ArrowDown, CheckCircle2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { copyToClipboard } from '@/utils/clipboard';
import { ProfileSummaryMarkdown } from '@/components/candidates/ProfileSummaryMarkdown';
import { MUST_HAVE_STYLE } from '@/components/candidates/insights/fitParts';
import { RATING_META } from '@/lib/scorecardRatings';
import { clock, orderCriteria, verdictCounts, type Recommendation, type RecommendationCriterion, type Verdict } from '@/lib/interviewNotes';
import { cn } from '@/lib/utils';
import type { ScoreRating } from '@/hooks/useScorecards';

/**
 * Gio's recommendation on a scorecard draft (interview notes step 5, 2026-11-12): the
 * rating Gio suggests (or "Not enough to recommend"), how sure it is, why, and each of
 * the job's requirements with what was said about it, the quote and the moment in the
 * call. Apply copies the notes, and the rating when there is one, into the form; the
 * interviewer's rating is always the decision. Drafts written before step 4 carry no
 * recommendation and show their notes only.
 */

interface Props {
  /** Gio's suggested rating, on the scorecard's own five-point scale; null when the
   *  interview didn't cover enough of the job to recommend. */
  rating: ScoreRating | null;
  /** The structured recommendation (ai_recommendation), when the draft has one. */
  recommendation?: Recommendation | null;
  /** Gio's notes (Markdown, or an older draft's JSON). */
  analysis: string;
  /** Whether what Apply would do is already in the form. */
  applied: boolean;
  onApply: () => void;
  /** For markdown fallback rendering. */
  normalizedMarkdown: string;
  /** Show a moment of the call in the Transcript tab (seconds). */
  onJumpTo?: (seconds: number) => void;
  disabled?: boolean;
}

function parseStructured(text: string): { summary?: string; strengths?: string[] } {
  const trimmed = (text || '').trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const data =
        parsed.general_overview && typeof parsed.general_overview === 'object'
          ? parsed.general_overview
          : parsed;
      return {
        summary: typeof data.overall_impression === 'string' ? data.overall_impression : undefined,
        strengths: Array.isArray(data.key_strengths) ? data.key_strengths.filter((s: any) => typeof s === 'string') : undefined,
      };
    } catch {
      // not JSON
    }
  }
  return {};
}

const VERDICT_STYLE: Record<Verdict, (typeof MUST_HAVE_STYLE)[keyof typeof MUST_HAVE_STYLE]> = {
  met: MUST_HAVE_STYLE.met,
  partly: MUST_HAVE_STYLE.partial,
  not_met: MUST_HAVE_STYLE.not_met,
  not_discussed: { ...MUST_HAVE_STYLE.unknown, label: 'Not discussed' },
};

const KIND_TAG: Partial<Record<RecommendationCriterion['kind'], string>> = {
  must: 'Must-have',
  nice: 'Nice-to-have',
};

const CONFIDENCE_LABEL = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' } as const;

const eyebrow = 'font-inter text-[10.5px] font-semibold uppercase tracking-[0.07em]';

function CriterionRow({ c, onJumpTo }: { c: RecommendationCriterion; onJumpTo?: (s: number) => void }) {
  const style = VERDICT_STYLE[c.verdict];
  const Icon = style.Icon;
  const tag = KIND_TAG[c.kind];
  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-px inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 font-inter text-[11px] font-semibold',
            style.className,
          )}
        >
          {Icon && <Icon className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />}
          {style.label}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-inter text-[13px] font-medium leading-[1.4] text-[#1F2230] [overflow-wrap:anywhere]">{c.label}</span>
            {tag && <span className="font-inter text-[11px] text-[#6B7080]">{tag}</span>}
          </div>
          {c.evidence && (
            <p className="mt-0.5 font-inter text-[12.5px] leading-[1.5] text-[#3D4257] [overflow-wrap:anywhere]">{c.evidence}</p>
          )}
          {(c.quote || c.at != null) && (
            <p className="mt-1 font-inter text-[12.5px] leading-[1.5] text-[#5A6072] [overflow-wrap:anywhere]">
              {c.quote && <q className="italic">{c.quote}</q>}
              {c.at != null &&
                (onJumpTo ? (
                  <button
                    type="button"
                    onClick={() => onJumpTo(c.at as number)}
                    aria-label={`Show ${clock(c.at)} in the transcript`}
                    className={cn(c.quote && 'ml-1.5', 'gio-pressable inline-flex h-5 items-center rounded-full bg-[#F1F0EC] px-1.5 align-[1px] font-inter text-[11px] font-medium tabular-nums text-[#5B21B6] hover:bg-[#ECE3FB]')}
                  >
                    {clock(c.at)}
                  </button>
                ) : (
                  <span className={cn(c.quote && 'ml-1.5', 'font-inter text-[11px] tabular-nums text-[#6B7080]')}>{clock(c.at)}</span>
                ))}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

export function AiSuggestedRatingCard({
  rating,
  recommendation,
  analysis,
  applied,
  onApply,
  normalizedMarkdown,
  onJumpTo,
  disabled,
}: Props) {
  const [open, setOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(!recommendation);
  const [copied, setCopied] = useState(false);

  const meta = rating ? RATING_META[rating] : null;
  const verdict = meta ? { bg: meta.bg, fg: meta.text } : { bg: '#F1F0EC', fg: '#5A6072' };
  const { summary, strengths } = parseStructured(analysis);
  const hasStructured = !!(summary || (strengths && strengths.length > 0));
  const criteria = recommendation ? orderCriteria(recommendation.criteria) : [];
  const counts = verdictCounts(criteria);
  const tally = [
    counts.met && `${counts.met} met`,
    counts.partly && `${counts.partly} partly`,
    counts.not_met && `${counts.not_met} not met`,
    counts.not_discussed && `${counts.not_discussed} not discussed`,
  ].filter(Boolean).join(' · ');
  const subtitle = recommendation
    ? [recommendation.sourceKind === 'summary' ? "From the note-taker's summary" : 'From the interview transcript', tally].filter(Boolean).join(' · ')
    : 'Based on the interview.';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(analysis, 'Notes copied');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="relative rounded-[14px] border border-[#DCC9FA] bg-[#F5F1FE]">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center gap-[14px] px-4 py-[15px] text-left">
          {/* White tile with the Gio glyph */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-white"
            style={{ border: '1px solid #E7D9FB', boxShadow: '0 1px 2px rgba(91,33,182,0.10)' }}
            aria-hidden="true"
          >
            <svg viewBox="0 0 48 48" width={23} height={23} aria-hidden="true">
              <circle cx="24" cy="19.4" r="9.9" fill="#0d0d09" />
              <rect x="20.7" y="29.9" width="13.2" height="8.8" rx="4.4" fill="#D7C5FB" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-poppins text-[14px] font-semibold tracking-[-0.01em] text-[#1F2230]">
                Gio's recommendation
              </span>
              <span
                className="font-poppins inline-flex items-center whitespace-nowrap rounded-full px-[9px] py-[2px] text-[11.5px] font-semibold leading-[1.2]"
                style={{ background: verdict.bg, color: verdict.fg }}
              >
                {meta ? meta.label : 'Not enough to recommend'}
              </span>
              {recommendation && (
                <span className="inline-flex items-center whitespace-nowrap rounded-full border border-[#DCC9FA] bg-white px-2 py-[2px] font-inter text-[11px] font-medium leading-[1.2] text-[#5B21B6]">
                  {CONFIDENCE_LABEL[recommendation.confidence]}
                </span>
              )}
            </div>
            <p className="mt-[3px] truncate font-inter text-[11.5px] text-[#5B21B6]">{subtitle}</p>
          </div>

          <span
            aria-hidden="true"
            className={cn(
              'gio-disclosure-chevron flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-[#DCC9FA] bg-white text-[#6F3FF5]',
              open && 'rotate-180',
            )}
          >
            <ChevronDown size={15} />
          </span>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-[14px] pb-[14px]">
        {recommendation && (recommendation.reason || criteria.length > 0) && (
          <div className="rounded-[12px] border border-[#ECE3FB] bg-white px-4 py-3.5">
            {recommendation.reason && (
              <p className="font-inter text-[13px] leading-[1.6] text-[#1F2230] [overflow-wrap:anywhere]">{recommendation.reason}</p>
            )}
            {criteria.length > 0 && (
              <div className={recommendation.reason ? 'mt-4' : undefined}>
                <div className={cn(eyebrow, 'mb-2 text-[#5B21B6]')}>Against the job</div>
                <ul className="divide-y divide-[#F1F0EC]">
                  {criteria.map((c) => (
                    <CriterionRow key={c.id} c={c} onJumpTo={onJumpTo} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <Collapsible open={notesOpen} onOpenChange={setNotesOpen} className={cn('rounded-[12px] border border-[#ECE3FB] bg-white', recommendation && 'mt-2.5')}>
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex min-w-0 items-center gap-1.5 text-left">
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={cn('gio-disclosure-chevron shrink-0 text-[#8B8F9E]', !notesOpen && '-rotate-90')}
                />
                <span className={cn(eyebrow, 'text-[#6B7080]')}>Gio's notes</span>
              </button>
            </CollapsibleTrigger>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy Gio's notes"
              data-swapped={copied || undefined}
              className={cn(
                'gio-pressable inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] hover:bg-[#F5F1FE]',
                copied ? 'text-[#0E7A53]' : 'text-[#5B21B6]',
              )}
            >
              <IconSwap swapped={copied} from={<Copy size={13} />} to={<Check size={13} />} />
              <span className="font-inter font-medium">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <CollapsibleContent className="px-4 pb-3.5">
            {hasStructured ? (
              <div className="space-y-4">
                {summary && <p className="font-inter text-[12.5px] leading-[1.6] text-[#1F2230]">{summary}</p>}
                {strengths && strengths.length > 0 && (
                  <div>
                    <div className={cn(eyebrow, 'mb-2 text-[#5B21B6]')}>Key strengths</div>
                    <ul className="space-y-2">
                      {strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check size={13} strokeWidth={2.5} className="mt-[3px] shrink-0 text-[#6F3FF5]" />
                          <span className="font-inter text-[12.5px] leading-[1.5] text-[#3D4257]">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <ProfileSummaryMarkdown
                  content={normalizedMarkdown}
                  className="[&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs [&_p]:text-[#3D4257] [&_li]:text-[#3D4257] [&_strong]:text-[#1F2230] [&_hr]:border-[#ECE3FB]"
                />
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="font-inter text-[11.5px] text-[#6B7080]">Gio's suggestion. Your rating is always the decision.</span>
          {applied ? (
            <span className="gio-tick-in inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-md border border-[#BBE3C9] bg-[#F4FBF6] px-2.5 font-inter text-[12px] font-medium text-[#0E7A53]">
              <CheckCircle2 size={13} />
              {rating ? 'Applied to your scorecard' : 'Notes added'}
            </span>
          ) : (
            <button
              type="button"
              onClick={onApply}
              disabled={disabled}
              className="gio-pressable font-poppins inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#DCC9FA] bg-white px-3 text-[12px] font-medium text-[#5B21B6] hover:bg-[#FAFAF7] disabled:opacity-60"
            >
              <ArrowDown size={13} />
              {rating ? 'Apply rating and notes' : 'Use these notes'}
            </button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
