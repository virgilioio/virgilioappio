import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, ArrowDown, CheckCircle2 } from 'lucide-react';
import { copyToClipboard } from '@/utils/clipboard';
import { ProfileSummaryMarkdown } from '@/components/candidates/ProfileSummaryMarkdown';

interface Props {
  /** Verdict label from Gio (e.g. "Strong Yes", "Yes", "No", "Definitely No"). */
  verdictLabel: string;
  /** Raw analysis content (JSON string or markdown). */
  analysis: string;
  /** Whether the currently-selected rating already matches Gio's suggestion. */
  applied: boolean;
  /** Apply Gio's verdict to the overall rating control. */
  onApply: () => void;
  /** For markdown fallback rendering. */
  normalizedMarkdown: string;
  disabled?: boolean;
}

const VERDICT_COLORS: Record<string, { bg: string; fg: string }> = {
  'Strong Yes': { bg: '#6F3FF5', fg: '#FFFFFF' },
  Yes: { bg: '#C8B9F0', fg: '#3B2A6B' },
  No: { bg: '#E7ABA4', fg: '#7A2E27' },
  'Definitely No': { bg: '#C9554C', fg: '#FFFFFF' },
};

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

export function AiSuggestedRatingCard({
  verdictLabel,
  analysis,
  applied,
  onApply,
  normalizedMarkdown,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const verdict = VERDICT_COLORS[verdictLabel] ?? VERDICT_COLORS.Yes;
  const { summary, strengths } = parseStructured(analysis);
  const hasStructured = !!(summary || (strengths && strengths.length > 0));

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(analysis, 'Analysis copied to clipboard');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className="relative rounded-[14px]"
      style={{ background: '#F5F1FE', border: '1px solid #DCC9FA' }}
    >
      {/* Header row — entire row toggles expand/collapse */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-[14px] px-4 py-[15px] text-left"
      >
        {/* White tile with dot+pill ATS brand mark */}
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

        {/* Copy */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="font-poppins"
              style={{ fontSize: 14, fontWeight: 600, color: '#1F2230', letterSpacing: '-0.01em' }}
            >
              AI suggested rating
            </span>
            <span
              className="font-poppins inline-flex items-center"
              style={{
                background: verdict.bg,
                color: verdict.fg,
                borderRadius: 999,
                padding: '2px 9px',
                fontSize: 11.5,
                fontWeight: 600,
                lineHeight: 1.2,
                letterSpacing: '-0.005em',
              }}
            >
              {verdictLabel}
            </span>
            <span
              className="font-inter"
              style={{
                fontWeight: 700,
                fontSize: 9.5,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: '#6F3FF5',
                background: '#fff',
                border: '1px solid #DCC9FA',
                borderRadius: 999,
                padding: '2px 7px',
                lineHeight: 1,
              }}
            >
              Gio
            </span>
          </div>
          <p
            className="font-inter"
            style={{ marginTop: 3, fontSize: 11.5, color: '#5B21B6', opacity: 0.9 }}
          >
            Based on interview transcript analysis.
          </p>
        </div>

        {/* Chevron toggle (visual only — entire row is the button) */}
        <span
          aria-hidden="true"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-white"
          style={{
            border: '1px solid #DCC9FA',
            color: '#6F3FF5',
            transition: 'transform 200ms ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <ChevronDown size={15} />
        </span>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-[14px] pb-[14px]">
          <div
            className="bg-white"
            style={{ border: '1px solid #ECE3FB', borderRadius: 12, padding: '14px 16px' }}
          >
            <div className="flex items-center justify-between gap-3">
              <div
                className="font-inter"
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: '#8B8F9E',
                }}
              >
                Transcript analysis
              </div>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy analysis"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-[#F5F1FE] transition-colors"
                style={{ color: copied ? '#0E7A53' : '#5B21B6', fontSize: 11.5 }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span className="font-inter" style={{ fontWeight: 500 }}>
                  {copied ? 'Copied' : 'Copy'}
                </span>
              </button>
            </div>

            {hasStructured ? (
              <div className="mt-3 space-y-4">
                {summary && (
                  <p
                    className="font-inter"
                    style={{ fontSize: 12.5, lineHeight: 1.6, color: '#1F2230' }}
                  >
                    {summary}
                  </p>
                )}
                {strengths && strengths.length > 0 && (
                  <div>
                    <div
                      className="font-inter"
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                        color: '#5B21B6',
                        marginBottom: 8,
                      }}
                    >
                      Key strengths
                    </div>
                    <ul className="space-y-2">
                      {strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check
                            size={13}
                            strokeWidth={2.5}
                            className="mt-[3px] shrink-0"
                            style={{ color: '#6F3FF5' }}
                          />
                          <span
                            className="font-inter"
                            style={{ fontSize: 12.5, lineHeight: 1.5, color: '#3D4257' }}
                          >
                            {s}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 max-h-80 overflow-y-auto">
                <ProfileSummaryMarkdown
                  content={normalizedMarkdown}
                  className="[&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs [&_p]:text-[#3D4257] [&_li]:text-[#3D4257] [&_strong]:text-[#1F2230] [&_hr]:border-[#ECE3FB]"
                />
              </div>
            )}
          </div>

          {/* Footer row */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <span
              className="font-inter"
              style={{ fontSize: 11.5, color: '#8B8F9E' }}
            >
              Gio's suggestion — your rating is always the final say.
            </span>
            {applied ? (
              <span
                className="font-inter inline-flex items-center gap-1.5 rounded-md px-2.5 py-1"
                style={{
                  background: '#F4FBF6',
                  border: '1px solid #BBE3C9',
                  color: '#0E7A53',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <CheckCircle2 size={13} />
                Applied to your rating
              </span>
            ) : (
              <button
                type="button"
                onClick={onApply}
                disabled={disabled}
                className="font-poppins inline-flex items-center gap-1.5 rounded-lg bg-white transition-colors hover:bg-[#FAFAF7] disabled:opacity-60"
                style={{
                  border: '1px solid #DCC9FA',
                  color: '#5B21B6',
                  height: 30,
                  padding: '0 12px',
                  fontWeight: 500,
                  fontSize: 12,
                }}
              >
                <ArrowDown size={13} />
                Apply to my rating
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
