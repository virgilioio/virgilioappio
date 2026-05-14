import { useMemo } from 'react'
import { BarChart3, Plus, Star, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAllStageScorecards } from '@/hooks/useAllStageScorecards'
import { cn } from '@/lib/utils'

interface PanelistRow {
  userId: string
  name: string
  roleLabel?: string  // e.g. "Hiring manager", "Panel", "Recruiter"
}

interface StageScorecardsCardProps {
  stageInstanceId: string
  associationId: string
  currentUserId?: string
  /** Optional list of expected panelists (e.g. from useStageBookings). Used to render pending rows. */
  expectedPanelists?: PanelistRow[]
  onOpenFullSheet: (scorecardId: string) => void
  onSubmitScorecard?: () => void
  onCompare?: () => void
  /** Optional dismiss handler for AI drafts */
  onDismissAiDraft?: (scorecardId: string) => Promise<void>
}

const RATING_LABEL: Record<string, string> = {
  strong_yes: 'Strong yes',
  yes: 'Yes',
  no: 'No',
  definitely_no: 'Definitely no',
}

function ratingTone(r?: string | null): 'green' | 'yellow' | 'red' | 'neutral' {
  switch (r) {
    case 'strong_yes':
    case 'yes':
      return 'green'
    case 'no':
    case 'definitely_no':
      return 'red'
    default:
      return 'neutral'
  }
}

function timeAgoConcise(iso?: string | null): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const days = Math.floor((Date.now() - t) / 86_400_000)
  if (days <= 0) return 'today'
  return `${days}d ago`
}

function initials(name?: string | null) {
  if (!name) return '—'
  return name
    .split(/\s+/)
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function StageScorecardsCard({
  stageInstanceId, associationId, currentUserId,
  expectedPanelists,
  onOpenFullSheet, onSubmitScorecard, onCompare, onDismissAiDraft,
}: StageScorecardsCardProps) {
  const { scorecards, loading } = useAllStageScorecards(stageInstanceId, associationId)

  const submitted = useMemo(
    () => scorecards.filter(s => !s.is_ai_draft && !!s.rating),
    [scorecards],
  )

  const pendingPanelists = useMemo(() => {
    if (!expectedPanelists) return []
    const submittedIds = new Set(submitted.map(s => s.created_by))
    return expectedPanelists.filter(p => !submittedIds.has(p.userId))
  }, [expectedPanelists, submitted])

  const totalExpected = expectedPanelists?.length ?? submitted.length
  const pendingCount = pendingPanelists.length || Math.max(0, totalExpected - submitted.length)

  return (
    <section className="bg-white border border-virgilio-border rounded-2xl shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5">
        <div className="min-w-0">
          <h3 className="font-poppins font-semibold text-[15px] tracking-[-0.01em] text-text-primary">
            Scorecards
          </h3>
          <p className="mt-1 text-[12.5px] text-text-tertiary font-poppins">
            {submitted.length} submitted{pendingCount > 0 && <> · {pendingCount} pending</>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onCompare && submitted.length >= 2 && (
            <Button variant="ghost" size="sm" icon={BarChart3} onClick={onCompare}>
              Compare
            </Button>
          )}
          {onSubmitScorecard && (
            <Button variant="secondary" size="sm" icon={Plus} onClick={onSubmitScorecard}>
              Add
            </Button>
          )}
        </div>
      </div>

      {/* Rows */}
      <div className="mt-4 divide-y divide-virgilio-border/60">
        {loading && submitted.length === 0 && pendingPanelists.length === 0 ? (
          <div className="px-5 sm:px-6 py-6 text-[13px] text-text-tertiary">Loading scorecards…</div>
        ) : submitted.length === 0 && pendingPanelists.length === 0 ? (
          <div className="px-5 sm:px-6 py-8 text-center">
            <Star className="h-5 w-5 mx-auto text-text-tertiary mb-2" />
            <p className="text-[13.5px] text-text-secondary font-poppins">No scorecards yet</p>
            {onSubmitScorecard && (
              <Button variant="secondary" size="sm" icon={Plus} onClick={onSubmitScorecard} className="mt-3">
                Submit scorecard
              </Button>
            )}
          </div>
        ) : (
          <>
            {submitted.map((s) => {
              const isMine = s.created_by === currentUserId
              const name = s.author_name || s.author_email || 'Reviewer'
              const tone = ratingTone(s.rating)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenFullSheet(s.id)}
                  className="w-full text-left px-5 sm:px-6 py-4 hover:bg-[hsl(var(--menu-hover))] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10.5px] font-medium">{initials(name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-poppins font-medium text-[13px] text-text-primary truncate">
                          {name}
                        </span>
                        {isMine && <Badge tone="lilac" size="xs">You</Badge>}
                        <span className="text-[12px] text-text-tertiary font-poppins ml-auto pl-2">
                          {timeAgoConcise(s.created_at)}
                        </span>
                      </div>
                      {s.general_overview && (
                        <p className="mt-1.5 italic text-[12.5px] text-text-secondary font-poppins line-clamp-2">
                          “{s.general_overview.replace(/<[^>]+>/g, '').trim()}”
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 ml-2">
                      <Badge tone={tone} size="sm" dot>
                        {RATING_LABEL[s.rating || ''] || s.rating || '—'}
                      </Badge>
                    </div>
                  </div>
                </button>
              )
            })}

            {/* AI drafts (visible to author) */}
            {scorecards.filter(s => s.is_ai_draft).map((s) => (
              <div key={s.id} className="px-5 sm:px-6 py-3 flex items-center gap-3 bg-[hsl(var(--menu-selected))]/40">
                <Sparkles className="h-4 w-4 text-virgilio-purple shrink-0" />
                <div className="text-[12.5px] font-poppins text-text-primary flex-1 min-w-0">
                  AI notes analysis available — review your draft
                </div>
                <Button variant="purple" size="xs" onClick={() => onOpenFullSheet(s.id)}>
                  Review
                </Button>
                {onDismissAiDraft && (
                  <Button variant="ghost" size="xs" onClick={() => onDismissAiDraft(s.id)}>
                    Dismiss
                  </Button>
                )}
              </div>
            ))}

            {/* Pending rows */}
            {pendingPanelists.map((p) => (
              <div key={p.userId} className="px-5 sm:px-6 py-4 flex items-start gap-3">
                <Avatar className="h-7 w-7 shrink-0 opacity-70">
                  <AvatarFallback className="text-[10.5px] font-medium">{initials(p.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-poppins font-medium text-[13px] text-text-primary">{p.name}</span>
                    {p.roleLabel && <Badge tone="neutral" size="xs">{p.roleLabel}</Badge>}
                  </div>
                  <div className="mt-0.5 text-[12px] text-text-tertiary font-poppins">
                    Pending submission
                  </div>
                </div>
                <Badge tone="yellow" size="sm" dot className="shrink-0">Pending</Badge>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="h-2" />
    </section>
  )
}

export default StageScorecardsCard
