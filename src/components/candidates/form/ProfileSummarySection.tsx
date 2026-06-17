import React from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CandidateSheetSection } from './CandidateSheetSection'
import { GeneratingCard } from './GeneratingCard'

type EnrichStep = 'idle' | 'working' | 'done'

interface ProfileSummarySectionProps {
  enrich: EnrichStep
  /** Plain-text summary used for the done state. */
  summary: string
  onRegenerate?: () => void
  isEdit?: boolean
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
  isEdit = false,
}: ProfileSummarySectionProps) {
  let rightMeta: React.ReactNode = null

  if (isEdit) {
    if (enrich !== 'working') {
      rightMeta = (
        <div className="flex items-center gap-[6px]">
          <Badge tone="lilac" size="xs" icon={Sparkles}>
            Gio generated
          </Badge>
          <Badge tone="neutral" size="xs" icon={RefreshCw}>
            Re-runs on new CV
          </Badge>
          {onRegenerate && (
            <Button type="button" variant="ghost" size="sm" icon={RefreshCw} onClick={onRegenerate}>
              Regenerate
            </Button>
          )}
        </div>
      )
    }
  } else {
    if (enrich === 'idle') {
      rightMeta = (
        <Badge tone="lilac" size="xs" icon={Sparkles}>
          Gio fills automatically
        </Badge>
      )
    } else if (enrich === 'done' && summary) {
      rightMeta = (
        <div className="flex items-center gap-2">
          <Badge tone="lilac" size="xs" icon={Sparkles}>
            Gio generated
          </Badge>
          {onRegenerate && (
            <Button type="button" variant="ghost" size="sm" icon={RefreshCw} onClick={onRegenerate}>
              Regenerate
            </Button>
          )}
        </div>
      )
    }
  }

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
