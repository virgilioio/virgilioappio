import { useEffect, useState } from 'react'
import { Search, ThumbsDown } from 'lucide-react'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { SkillPill } from '@/components/jobs/SkillPill'
import {
  PreAssociationDossier, SuggestedProfileView, type SuggestedProfileTab,
} from '@/components/candidates/suggested/SuggestedProfileView'
import { FindAddButton } from './FindAddButton'
import { useJobsForCandidateAssignment } from '@/hooks/useJobsForCandidateAssignment'
import type { FindAddTarget } from '@/lib/findAdd'

const ordinal = (n: number) => {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

/** What Find knows about this person from the search (sourcing-search's internal lane). */
export interface FindGioRow {
  name: string
  matchScore: number | null
  reasons: string[]
  matchedSkills: { skill: string; tier: 'must' | 'nice' | 'extra' }[]
  missingMust: string[]
  mustTotal: number
  /** Their jobs, with Gio Fit where it has run. */
  pipeline: { job_id: string; job_title: string; gio_fit?: number | null }[]
}

/**
 * Find's profile of somebody already in Gio: the job's Suggested profile
 * (`SuggestedProfileView`, Allan 2026-10-22: "exactly the same") in a side sheet
 * over the results. Gio Fit is about the search's job; with no job the tab shows
 * the search match and a job to run Gio Fit against.
 */
export function FindGioProfileSheet({
  open, onOpenChange, candidateId, row, linkedJob, searchName, rank, total,
  hasPrev, hasNext, onNavigatePrev, onNavigateNext,
  addedLabel, adding, onAdd, onChooseJob, onNotAFit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId: string | null
  row: FindGioRow | null
  linkedJob: { id: string; title: string } | null
  searchName: string | null
  /** Position in the results, for the badge. */
  rank?: number | null
  total?: number | null
  hasPrev: boolean
  hasNext: boolean
  onNavigatePrev: () => void
  onNavigateNext: () => void
  /** Set once Find has added this person (the destination's name). */
  addedLabel?: string | null
  adding?: boolean
  onAdd: (target: FindAddTarget) => void
  onChooseJob: () => void
  onNotAFit?: () => void
}) {
  const [tab, setTab] = useState<SuggestedProfileTab>('fit')
  // The job Gio Fit is about: the search's job, or one picked on the tab.
  const [pickedJobId, setPickedJobId] = useState<string | null>(null)
  useEffect(() => { if (!open) { setPickedJobId(null); setTab('fit') } }, [open])
  const fitJobId = linkedJob?.id ?? pickedJobId

  const { jobs: allJobs } = useJobsForCandidateAssignment()
  const jobOptions = allJobs.filter((j) => !j.is_draft).map((j) => ({ value: j.id, label: `${j.title} - ${j.organization_name}` }))

  const name = row?.name || 'Candidate'
  const fitHere = fitJobId ? row?.pipeline.find((p) => p.job_id === fitJobId)?.gio_fit ?? null : null
  const jobsCount = row?.pipeline.length ?? 0

  const dismiss = onNotAFit ? () => { onNotAFit(); onOpenChange(false) } : undefined

  const decision = (size: 'sm' | 'lg') => (
    <span className="inline-flex flex-wrap items-center gap-2">
      {addedLabel ? (
        <Badge tone="green" size="sm" dot className="max-w-[260px] truncate">Added · {addedLabel}</Badge>
      ) : (
        <FindAddButton
          size={size === 'lg' ? 'sm' : 'xs'}
          who={name}
          linkedJob={linkedJob}
          credits={0}
          onlyInGio
          onAdd={onAdd}
          onChooseJob={onChooseJob}
          loading={adding}
        />
      )}
      {dismiss && !addedLabel && (
        <Button size={size === 'lg' ? 'sm' : 'xs'} variant="ghost" icon={ThumbsDown} onClick={dismiss}>
          Not a fit
        </Button>
      )}
    </span>
  )

  const tiers: { tier: 'must' | 'nice' | 'extra'; label: string; priority: 'must' | 'nice' | 'bonus' }[] = [
    { tier: 'must', label: 'Must-haves', priority: 'must' },
    { tier: 'nice', label: 'Nice-to-haves', priority: 'nice' },
    { tier: 'extra', label: 'Extra points', priority: 'bonus' },
  ]

  const searchMatchCard = row && (
    <PreAssociationDossier
      title="Search match"
      subtitle={`Against ${searchName || 'this search'}`}
      jobTitle={null}
      score={row.matchScore}
      scoreLabel="Search match"
      whyLabel="Why this search found them"
      statusText={jobsCount ? `In ${jobsCount} ${jobsCount === 1 ? 'job' : 'jobs'}` : 'Not in a job yet'}
      rationale={null}
      reasons={row.reasons}
      location={null}
      actions={decision('sm')}
      note="Gio Fit scores someone against a job's requirements. Pick a job to see their Gio Fit and write the full dossier."
    >
      {(row.matchedSkills.length > 0 || row.missingMust.length > 0) && (
        <div className="mt-4 space-y-2.5">
          {tiers.map(({ tier, label, priority }) => {
            const found = row.matchedSkills.filter((s) => s.tier === tier)
            if (!found.length) return null
            return (
              <div key={tier}>
                <p className="font-inter text-[11.5px] font-medium text-[#5A6072]">{label} on their profile</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {found.map((s) => <SkillPill key={s.skill} skill={s.skill} priority={priority} size="sm" />)}
                </div>
              </div>
            )
          })}
          {row.missingMust.length > 0 && (
            <div>
              <p className="font-inter text-[11.5px] font-medium text-[#5A6072]">
                Not on their profile · {row.missingMust.length} of {row.mustTotal} must-haves
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {row.missingMust.map((s) => (
                  <span key={s} className="inline-flex h-[22px] items-center rounded-full border border-dashed border-[#D4D6DE] px-2 font-inter text-[11px] text-[#5A6072]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 max-w-[360px]">
        <p className="mb-1.5 font-inter text-[11.5px] font-medium text-[#5A6072]">Run Gio Fit for a job</p>
        <SearchableSelect
          options={jobOptions}
          value={pickedJobId ?? ''}
          onValueChange={(v) => setPickedJobId(v || null)}
          placeholder="Choose a job…"
          searchPlaceholder="Search jobs…"
          emptyMessage="No open jobs"
        />
      </div>
    </PreAssociationDossier>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="h-full w-[96vw] overflow-y-auto p-0 sm:max-w-5xl" showOverlay={false}>
        <SheetTitle className="sr-only">{name}</SheetTitle>
        {candidateId && (
          <SuggestedProfileView
            candidateId={candidateId}
            jobId={fitJobId}
            activeTab={tab}
            onTabChange={setTab}
            match={{ score: row?.matchScore ?? null, reasons: row?.reasons ?? [], rationale: null }}
            heroFitScore={fitHere}
            scoreLabel="Search match"
            whyLabel="Why this search found them"
            identityBadges={({ addedStage }) => (
              <>
                <Badge tone="lilac" size="sm" icon={Search}>Found in Find</Badge>
                {addedStage ? (
                  <Badge tone="green" size="sm" dot>{addedStage}</Badge>
                ) : addedLabel ? (
                  <Badge tone="green" size="sm" dot>Added · {addedLabel}</Badge>
                ) : rank && total ? (
                  <Badge tone="neutral" size="sm">Ranks {ordinal(rank)} of {total}</Badge>
                ) : null}
              </>
            )}
            breadcrumb={
              <>
                <span>Find</span>
                <span className="text-[#D1D5DB]">›</span>
                <span className="truncate max-w-[260px]">{searchName || 'Search'}</span>
                <span className="text-[#D1D5DB]">›</span>
                <span className="font-medium text-[#1F2230]">Already in Gio</span>
              </>
            }
            backLabel="Back to results"
            breadcrumbLast="Already in Gio"
            matchedAgainst={fitJobId ? undefined : (
              <span>Found in <span className="font-medium text-[#1F2230]">{searchName || 'this search'}</span></span>
            )}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onNavigatePrev={onNavigatePrev}
            onNavigateNext={onNavigateNext}
            prevLabel="Previous result"
            nextLabel="Next result"
            onClose={() => onOpenChange(false)}
            onDismiss={() => (dismiss ? dismiss() : onOpenChange(false))}
            dismissLabel="Not a fit"
            notInPipelineText={fitJobId ? 'Found in Find · not in this pipeline yet' : `Found in ${searchName || 'this search'}`}
            renderDecision={(size) => decision(size)}
            onAddToOtherJob={onChooseJob}
            fitWithoutJob={searchMatchCard}
            className="min-h-full px-5"
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
