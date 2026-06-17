import React from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CandidateSheetSection } from './CandidateSheetSection'
import { GeneratingCard } from './GeneratingCard'

type EnrichStep = 'idle' | 'working' | 'done'

interface ProfileSummarySectionProps {
  enrich: EnrichStep
  /** Plain-text summary used for the done state. */
  summary: string
  onRegenerate?: () => void
}

/**
 * Profile summary section. Three states mirror Skills:
 *  idle    → quiet white shell with hint
 *  working → lilac GeneratingCard with 4 shimmer lines
 *  done    → white card with the generated paragraph + Regenerate
 */
export function ProfileSummarySection({
  enrich,
  summary,
  onRegenerate,
}: ProfileSummarySectionProps) {
  const rightMeta =
    enrich === 'done' && summary ? (
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 h-[18px] font-poppins text-[10.5px] font-semibold"
          style={{ background: '#EDE4FF', color: '#5B21B6' }}
        >
          <Sparkles className="h-3 w-3" strokeWidth={1.75} />
          Gio generated
        </span>
        {onRegenerate && (
          <Button type="button" variant="ghost" size="sm" icon={RefreshCw} onClick={onRegenerate}>
            Regenerate
          </Button>
        )}
      </div>
    ) : null

  return (
    <CandidateSheetSection label="Profile summary" rightMeta={rightMeta}>
      {enrich === 'idle' && (
        <div
          className="rounded-md bg-white px-3 py-3 flex items-center gap-2"
          style={{ border: '1px solid #E0DDD3' }}
        >
          <Sparkles className="h-3.5 w-3.5" style={{ color: '#8B8F9E' }} strokeWidth={1.75} />
          <span className="font-inter text-[12.5px]" style={{ color: '#8B8F9E' }}>
            Drop a résumé and Gio will write a short profile summary here.
          </span>
        </div>
      )}

      {enrich === 'working' && (
        <GeneratingCard label="Writing profile summary…" variant="lines" />
      )}

      {enrich === 'done' && (
        <div
          className="rounded-md bg-white px-4 py-3"
          style={{ border: '1px solid #E7E8EE' }}
        >
          {summary ? (
            <p
              className="font-inter text-[12.5px]"
              style={{ color: '#1F2230', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
            >
              {summary}
            </p>
          ) : (
            <p className="font-inter text-[12.5px]" style={{ color: '#8B8F9E' }}>
              No summary yet. Click Regenerate to ask Gio to write one.
            </p>
          )}
        </div>
      )}
    </CandidateSheetSection>
  )
}

export default ProfileSummarySection
