import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Heart, Loader2, MapPin, Plus, RotateCcw, Sparkles, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented'
import { AnimatedEmpty, EmptyCard } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import UniversalCandidateProfileSheet from '@/components/candidates/UniversalCandidateProfileSheet'
import { CandidateTableSkeleton } from './CandidateTableSkeleton'
import { useProjectPeople, useProjectPeopleActions, projectPeopleKey, type ProjectPerson } from '@/hooks/useProjectPeople'
import { useSourcingCreditWarnings } from '@/hooks/useSourcingCreditWarnings'
import { addCandidateToJob } from '@/lib/addCandidateToJob'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'

/**
 * The project's shortlist (Find Phase 2, 2026-10-12). Shortlisting is free
 * and shared with everyone who can open the project; AI fit is scored here
 * and only here. People not yet in Gio are collected from this list (1
 * credit each, no phone); people in Gio go straight to the job.
 */

interface ShortlistTabProps {
  projectId: string
  jobId?: string | null
  onCollected?: () => void
}

type View = 'shortlisted' | 'not_a_fit'

const band = (score: number) =>
  score >= 85 ? { fg: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' } :
  score >= 70 ? { fg: 'text-blue-700', bg: 'bg-blue-50', ring: 'ring-blue-200' } :
  score >= 55 ? { fg: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' } :
  { fg: 'text-text-secondary', bg: 'bg-[#F1F0EC]', ring: 'ring-border' }

const nameOf = (p: ProjectPerson) => p.person?.name || p.snapshot.name || 'Unnamed candidate'
const inGio = (p: ProjectPerson) => !!p.candidate_id

export function ShortlistTab({ projectId, jobId, onCollected }: ShortlistTabProps) {
  const queryClient = useQueryClient()
  const { data: people = [], isLoading, error, refetch } = useProjectPeople(projectId)
  const actions = useProjectPeopleActions(projectId)
  const { isCollectDisabled, renewsOn } = useSourcingCreditWarnings()
  const [view, setView] = useState<View>('shortlisted')
  const segRef = useSegmentLayer<HTMLDivElement>()
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<ProjectPerson | null>(null)

  const shortlisted = useMemo(() => people
    .filter((p) => p.status === 'shortlisted')
    .sort((a, b) => (b.ai_fit_score ?? -1) - (a.ai_fit_score ?? -1)
      || String(b.status_changed_at).localeCompare(String(a.status_changed_at))), [people])
  const notAFit = useMemo(() => people.filter((p) => p.status === 'not_a_fit'), [people])
  const list = view === 'shortlisted' ? shortlisted : notAFit
  const toCollect = shortlisted.filter((p) => !inGio(p) && p.apollo_id)
  const unscored = shortlisted.filter((p) => p.ai_fit_score === null).length

  const mark = (ids: string[], on: boolean) => setBusy((prev) => {
    const next = new Set(prev)
    for (const id of ids) { if (on) next.add(id); else next.delete(id) }
    return next
  })

  const collect = async (rows: ProjectPerson[]) => {
    const ids = rows.map((r) => r.apollo_id!).filter(Boolean)
    if (ids.length === 0) return
    if (isCollectDisabled) {
      toast.error('Apollo credits used up', { description: `They renew on ${renewsOn}.` })
      return
    }
    mark(rows.map((r) => r.id), true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('enrich-apollo-profile', {
        body: { apollo_ids: ids, job_id: jobId ?? null, sourcing_project_id: projectId },
      })
      if (fnError) throw fnError
      const added = data?.enriched_count ?? 0
      const known = (data?.merged_count ?? 0) + (data?.results ?? []).filter((r: { already_collected?: boolean }) => r.already_collected).length
      toast.success(added + known === 1 ? 'Collected' : `Collected ${added + known} people`, {
        description: [
          added ? `${added} new to Gio` : '',
          known ? `${known} already in Gio, filled in` : '',
          jobId ? 'Added to the job' : '',
        ].filter(Boolean).join(' · ') || undefined,
      })
      queryClient.invalidateQueries({ queryKey: projectPeopleKey(projectId) })
      queryClient.invalidateQueries({ queryKey: ['saved-candidates', projectId] })
      onCollected?.()
      // Collected people now have a full profile: score them on it.
      actions.score(false)
    } catch {
      toast.error("Couldn't collect", {
        description: 'No credits were spent on anyone who failed. Try again in a moment.',
        action: { label: 'Retry', onClick: () => void collect(rows) },
      })
    } finally {
      mark(rows.map((r) => r.id), false)
    }
  }

  const addToJob = async (p: ProjectPerson) => {
    if (!jobId || !p.candidate_id) return
    mark([p.id], true)
    try {
      const added = await addCandidateToJob(jobId, p.candidate_id)
      toast.success(added ? `${nameOf(p)} added to the job` : `${nameOf(p)} is already in the job`)
    } catch {
      toast.error("Couldn't add them to the job", { description: 'Try again in a moment.' })
    } finally {
      mark([p.id], false)
    }
  }

  const change = (p: ProjectPerson) => ({
    key: { apolloId: p.apollo_id, candidateId: p.candidate_id },
    previous: p.status,
  })

  if (error && people.length === 0) {
    return <EmptyCard><LoadError what="this shortlist" onRetry={() => void refetch()} /></EmptyCard>
  }
  if (isLoading) return <CandidateTableSkeleton rows={4} />

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div ref={segRef} className="gio-seg inline-flex items-center gap-0.5 rounded-lg bg-[#F1F0EC] p-0.5">
          {([
            { id: 'shortlisted', label: 'Shortlisted', count: shortlisted.length },
            { id: 'not_a_fit', label: 'Not a fit', count: notAFit.length },
          ] as const).map((seg) => (
            <button
              key={seg.id}
              type="button"
              data-seg-option
              data-active={view === seg.id || undefined}
              onClick={() => setView(seg.id)}
              className={cn(
                'h-7 px-2.5 rounded-md font-poppins text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors',
                view === seg.id ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <span>{seg.label}</span>
              <span className="text-[11px] tabular-nums text-text-tertiary">{seg.count}</span>
            </button>
          ))}
          <SegmentLayer fill="#fff" shadow="0 1px 2px rgba(0,0,0,0.06)" />
        </div>

        {view === 'shortlisted' && shortlisted.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              icon={Sparkles}
              loading={actions.isScoring}
              onClick={() => actions.score(unscored === 0)}
            >
              {unscored > 0 ? `Score ${unscored} with AI` : 'Rescore with AI'}
            </Button>
            {toCollect.length > 0 && (
              <Button
                size="sm"
                variant="purple"
                icon={Download}
                disabled={isCollectDisabled || toCollect.some((p) => busy.has(p.id))}
                loading={toCollect.some((p) => busy.has(p.id))}
                onClick={() => void collect(toCollect)}
              >
                {isCollectDisabled
                  ? 'Credits used up'
                  : `Collect ${toCollect.length} · ${toCollect.length} credit${toCollect.length === 1 ? '' : 's'}`}
              </Button>
            )}
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyCard>
          {view === 'shortlisted' ? (
            <AnimatedEmpty
              scene="candidates"
              onceKey="find-shortlist"
              title="No one shortlisted yet"
              body="Shortlist people from the results. It's free, the team sees the same list, and AI scores everyone you add."
            />
          ) : (
            <AnimatedEmpty
              scene="search"
              onceKey="find-not-a-fit"
              title="No one marked not a fit"
              body="People you mark not a fit leave the results and wait here, in case you change your mind."
            />
          )}
        </EmptyCard>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-border/60 bg-white">
          <ul className="divide-y divide-border/60">
            {list.map((p) => {
              const name = nameOf(p)
              const title = p.person?.title || p.snapshot.title
              const company = p.person?.company || p.snapshot.company
              const location = p.person?.location || p.snapshot.location
              const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?'
              const isBusy = busy.has(p.id)
              const b = p.ai_fit_score !== null ? band(p.ai_fit_score) : null
              return (
                <li key={p.id} className="px-5 py-4 hover:bg-[#FAFAF7]">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border bg-virgilio-purple/10 text-virgilio-purple">
                      <AvatarFallback className="bg-virgilio-purple/10 text-virgilio-purple font-poppins text-[12px] font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          className="font-poppins text-[14px] font-semibold tracking-[-0.01em] text-text-primary hover:underline truncate max-w-[320px] text-left"
                          onClick={() => setOpen(p)}
                        >
                          {name}
                        </button>
                        {inGio(p) ? <Badge tone="green" size="xs">In Gio</Badge> : <Badge tone="neutral" size="xs">Preview</Badge>}
                        {p.added_by_pool && <Badge tone="purple" size="xs">Talent pool</Badge>}
                      </div>
                      {(title || company) && (
                        <p className="text-[12.5px] text-text-secondary truncate">
                          {title}{title && company ? ' at ' : ''}
                          {company && <span className="text-text-primary font-medium">{company}</span>}
                        </p>
                      )}
                      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11.5px] text-text-tertiary">
                        {location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{location}</span>}
                        {p.status_changed_at && (
                          <span>
                            {view === 'shortlisted' ? 'Shortlisted' : 'Marked'}
                            {p.changed_by_name ? ` by ${p.changed_by_name}` : ''}
                            {' · '}
                            {new Date(p.status_changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>

                      {view === 'shortlisted' && (
                        p.ai_fit_summary ? (
                          <div className="pt-1 space-y-1.5">
                            <p className="text-[12.5px] text-text-primary">{p.ai_fit_summary}</p>
                            {(p.ai_fit_strengths.length > 0 || p.ai_fit_gaps.length > 0) && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {p.ai_fit_strengths.map((s) => (
                                  <span key={`s-${s}`} className="inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 px-1.5 h-[18px] text-[10.5px] font-medium ring-1 ring-emerald-200/60">{s}</span>
                                ))}
                                {p.ai_fit_gaps.map((g) => (
                                  <span key={`g-${g}`} className="inline-flex items-center rounded-md bg-amber-50 text-amber-800 px-1.5 h-[18px] text-[10.5px] font-medium ring-1 ring-amber-200/60">{g}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : actions.isScoring ? (
                          <div className="pt-1.5 space-y-1.5" aria-label="Scoring with AI">
                            <Skeleton className="h-3 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        ) : (
                          <p className="pt-1 text-[11.5px] text-text-tertiary">Not scored by AI yet.</p>
                        )
                      )}

                      <div className="flex items-center gap-1.5 pt-2 flex-wrap">
                        {view === 'shortlisted' ? (
                          <>
                            {!inGio(p) && p.apollo_id ? (
                              <Button
                                size="sm"
                                variant="primary"
                                icon={Download}
                                loading={isBusy}
                                disabled={isBusy || isCollectDisabled}
                                onClick={() => void collect([p])}
                              >
                                {isCollectDisabled ? 'Credits used up' : 'Collect · 1 credit'}
                              </Button>
                            ) : jobId && p.candidate_id ? (
                              <Button size="sm" variant="primary" icon={Plus} loading={isBusy} disabled={isBusy} onClick={() => void addToJob(p)}>
                                Add to job
                              </Button>
                            ) : null}
                            <Button size="sm" variant="ghost" icon={Heart} onClick={() => void actions.restore([change(p)])}>
                              Remove from shortlist
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void actions.notAFit([change(p)])}>
                              Not a fit
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => void actions.restore([change(p)])}>
                              Back to results
                            </Button>
                            <Button size="sm" variant="ghost" icon={Undo2} onClick={() => void actions.shortlist([change(p)])}>
                              Shortlist instead
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {view === 'shortlisted' && (
                      <div
                        className={cn(
                          'shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-lg ring-1 px-3 py-2 min-w-[64px]',
                          b ? [b.bg, b.ring] : 'bg-[#F1F0EC] ring-border',
                        )}
                      >
                        <span className="font-poppins text-[10.5px] uppercase tracking-[0.08em] text-text-tertiary">AI fit</span>
                        {p.ai_fit_score !== null ? (
                          <span className={cn('font-poppins text-[22px] font-semibold leading-none tabular-nums', b?.fg)}>{p.ai_fit_score}</span>
                        ) : actions.isScoring ? (
                          <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" aria-label="Scoring" />
                        ) : (
                          <span className="font-poppins text-[15px] font-semibold leading-none text-text-tertiary">—</span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <UniversalCandidateProfileSheet
        open={!!open}
        onOpenChange={(v) => { if (!v) setOpen(null) }}
        candidateId={open?.candidate_id ?? null}
        apolloId={open?.apollo_id ?? null}
        apolloData={open ? {
          candidate_name: nameOf(open),
          current_role: (open.person?.title || open.snapshot.title) ?? undefined,
          current_company: (open.person?.company || open.snapshot.company) ?? undefined,
          location: (open.person?.location || open.snapshot.location) ?? undefined,
          linkedin_url: (open.person?.linkedin_url || open.snapshot.linkedin_url) ?? undefined,
          headline: open.snapshot.headline ?? undefined,
        } : undefined}
        jobId={jobId}
        context="sourcing"
        onCandidateCollected={() => {
          queryClient.invalidateQueries({ queryKey: projectPeopleKey(projectId) })
          onCollected?.()
        }}
      />
    </div>
  )
}
