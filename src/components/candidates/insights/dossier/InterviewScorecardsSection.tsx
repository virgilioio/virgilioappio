import { useState } from 'react'
import { ChevronDown, MessageSquareText } from 'lucide-react'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { SafeHtml } from '@/components/ui/safe-html'
import { cn } from '@/lib/utils'
import { ratingLabel, ratingTone } from '@/lib/scorecardRatings'
import type { DossierPendingScorecard, DossierScorecard } from './dossierScorecards'
import { shortDossierDate } from './dossierScorecards'

const toneMap: Record<ReturnType<typeof ratingTone>, BadgeTone> = {
  green: 'green',
  yellow: 'yellow',
  orange: 'orange',
  red: 'red',
  neutral: 'neutral',
}

export function InterviewScorecardsSection({
  scorecards,
  pending = [],
  clientReady,
}: {
  scorecards: DossierScorecard[]
  pending?: DossierPendingScorecard[]
  clientReady: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (!scorecards.length) return null

  return (
    <div className="border-t border-fit-hairline p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-inter text-[10px] font-semibold uppercase tracking-[0.1em] text-fit-subtle">
          <MessageSquareText className="h-3 w-3" /> Interview scorecards
        </h3>
        <span className="text-[11.5px] text-fit-subtle">{scorecards.length} submitted</span>
      </div>

      <div className="mt-4 divide-y divide-fit-chip border-y border-fit-chip">
        {scorecards.map((scorecard) => {
          const open = scorecard.id === openId
          const takeaway = scorecard.takeawayParagraphs.join(' ')
          return (
            <div key={scorecard.id}>
              <button
                type="button"
                className="w-full py-3.5 text-left"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : scorecard.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="font-poppins text-[13px] font-semibold text-fit-ink">{scorecard.interviewerName}</p>
                      {scorecard.interviewerRole && <span className="text-[11.5px] text-fit-subtle">{scorecard.interviewerRole}</span>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-fit-subtle">{scorecard.stage} · {shortDossierDate(scorecard.submittedAt)}</p>
                    {takeaway && <p className={cn('mt-2 text-[12.5px] leading-[1.55] text-fit-muted', !open && 'line-clamp-2')}>{takeaway}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={toneMap[ratingTone(scorecard.rating)]} size="xs" shape="square">{ratingLabel(scorecard.rating)}</Badge>
                    <ChevronDown className={cn('h-3.5 w-3.5 text-fit-subtle transition-transform', open && 'rotate-180')} />
                  </div>
                </div>
              </button>
              {open && (
                <div className="pb-4">
                  <div className="space-y-2 rounded-lg border border-fit-row-border bg-fit-paper p-3">
                    <SafeHtml
                      content={scorecard.takeawayHtml || scorecard.takeawayParagraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}
                      className="dossier-scorecard-rich-text text-[12.5px] leading-[1.65] text-fit-ink [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_h1]:my-3 [&_h1]:font-poppins [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:my-3 [&_h2]:font-poppins [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:font-poppins [&_h3]:text-[13px] [&_h3]:font-semibold [&_h4]:my-2 [&_h4]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_li]:pl-0.5 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-fit-chip [&_blockquote]:pl-3 [&_blockquote]:text-fit-muted [&_strong]:font-semibold [&_a]:underline"
                    />
                    {!clientReady && scorecard.areas && scorecard.areas.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 border-t border-fit-chip pt-3">
                        {scorecard.areas.map((area) => (
                          <Badge key={`${scorecard.id}-${area.label}`} tone={toneMap[ratingTone(area.rating)]} size="xs" shape="square">
                            {area.label} · {ratingLabel(area.rating)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!clientReady && pending.length > 0 && (
        <p className="mt-3 text-[11.5px] leading-[1.5] text-fit-subtle">
          Awaiting scorecards from {pending.map((person) => person.name).join(', ')}.
        </p>
      )}
    </div>
  )
}