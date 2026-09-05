import * as React from 'react'
import { toast } from '@/hooks/use-toast'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { usePipelineActions } from '@/hooks/usePipelineActions'
import { useJobSuggestedCandidates } from '@/hooks/useJobSuggestedCandidates'
import { useSuggestedCandidateStatus } from '@/hooks/useSuggestedCandidateStatus'
import { SuggestedToolbar, type SuggestedState } from './SuggestedToolbar'
import { SuggestedTable } from './SuggestedTable'
import { SuggestedSkeleton } from './SuggestedSkeleton'
import { SelectionBar } from '@/components/shared/SelectionBar'
import { Plus, ThumbsDown } from 'lucide-react'
import { SuggestedCleared, SuggestedEmpty, SuggestedNoResults } from './SuggestedStates'
import {
  DEFAULT_SUGGESTED_FILTERS,
  addSuggestedFilter,
  applySuggestedFilters,
  lastActivityAt,
  suggestedCandidateId,
  suggestedScore,
  type SuggestedFilter,
} from './suggestedFilters'
import type { SuggestedSortKey } from './suggestedGrid'

const dismissKey = (jobId: string) => `gio.suggested.dismissed.${jobId}`

function readDismissed(jobId: string): string[] {
  try {
    const raw = localStorage.getItem(dismissKey(jobId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

export interface JobSuggestedTabProps {
  jobId: string
  jobSkills?: string[] | null
  jobLocation?: string | null
  /** Opens the candidate profile — the tab never decides how a profile renders. */
  onOpenCandidate: (candidate: any) => void
  onEditRequirements?: () => void
}

/**
 * Read-only view over Gio's suggestions. Nothing here writes to the pipeline
 * except an explicit Add — a suggestion stays a suggestion until a recruiter
 * acts on it.
 */
export function JobSuggestedTab({
  jobId,
  jobSkills,
  jobLocation,
  onOpenCandidate,
  onEditRequirements,
}: JobSuggestedTabProps) {
  const { candidates, isLoading, searchedCount, lastUpdatedAt, refetch } = useJobSuggestedCandidates({
    jobId,
    jobSkills,
    limit: 50,
  })

  const [filters, setFilters] = React.useState<SuggestedFilter[]>(DEFAULT_SUGGESTED_FILTERS)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [sort, setSort] = React.useState<{ key: SuggestedSortKey; dir: 'asc' | 'desc' }>({
    key: 'match',
    dir: 'desc',
  })
  const [dismissed, setDismissed] = React.useState<string[]>(() => readDismissed(jobId))
  const [addingId, setAddingId] = React.useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = React.useState(false)

  React.useEffect(() => {
    setDismissed(readDismissed(jobId))
    setSelected(new Set())
  }, [jobId])

  const persistDismissed = (next: string[]) => {
    setDismissed(next)
    try {
      localStorage.setItem(dismissKey(jobId), JSON.stringify(next))
    } catch {
      /* a full storage quota must not break the tab */
    }
  }

  const visible = React.useMemo(
    () => candidates.filter((c) => !dismissed.includes(suggestedCandidateId(c))),
    [candidates, dismissed],
  )

  const ids = React.useMemo(() => visible.map((c) => suggestedCandidateId(c)).filter(Boolean), [visible])
  const statuses = useSuggestedCandidateStatus(jobId, ids)

  const filterContext = React.useMemo(() => {
    const inPipelineIds = new Set<string>()
    const rejectedIds = new Set<string>()
    Object.entries(statuses).forEach(([id, s]) => {
      if (s.kind === 'pipeline') inPipelineIds.add(id)
      if (s.kind === 'rejected') rejectedIds.add(id)
    })
    return { inPipelineIds, rejectedIds }
  }, [statuses])

  const filtered = React.useMemo(() => {
    const rows = applySuggestedFilters(visible, filters, filterContext)
    const dir = sort.dir === 'asc' ? 1 : -1
    return rows.slice().sort((a, b) => {
      if (sort.key === 'match') return ((suggestedScore(a) ?? 0) - (suggestedScore(b) ?? 0)) * dir
      return ((lastActivityAt(a) ?? 0) - (lastActivityAt(b) ?? 0)) * dir
    })
  }, [visible, filters, filterContext, sort])

  const skillOptions = React.useMemo(() => {
    const counts = new Map<string, number>()
    visible.forEach((c: any) => {
      ;[...(c.skills || []), ...(c.standardized_skills || [])].forEach((s: string) => {
        const key = String(s).trim()
        if (key) counts.set(key, (counts.get(key) || 0) + 1)
      })
    })
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([s]) => s)
  }, [visible])

  /** Every city, state/province and country present in the suggestion pool. */
  const locationOptions = React.useMemo(() => {
    const counts = new Map<string, { label: string; kind: string; count: number }>()
    const add = (raw: any, kind: string) => {
      const label = String(raw || '').trim()
      if (!label) return
      const key = `${kind}:${label.toLowerCase()}`
      const existing = counts.get(key)
      if (existing) existing.count += 1
      else counts.set(key, { label, kind, count: 1 })
    }
    visible.forEach((c: any) => {
      add(c.location_city, 'City')
      add(c.location_state, 'State / Province')
      add(c.location_country, 'Country')
      if (!c.location_city && !c.location_state && !c.location_country) add(c.location, 'Location')
    })
    return [...counts.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label),
    )
  }, [visible])

  const state: SuggestedState = isLoading
    ? 'loading'
    : visible.length === 0
      ? 'empty'
      : filtered.length === 0
        ? 'noresults'
        : 'results'

  const { loadHiringPlanInstances } = useJobHiringPlan()
  const { createAssociationAndMove } = usePipelineActions()

  const firstStageId = async (): Promise<string | null> => {
    const options = await loadHiringPlanInstances(jobId)
    return options?.[0]?.jhsId ?? null
  }

  const addToPipeline = async (candidateIds: string[]) => {
    const stageId = await firstStageId()
    if (!stageId) {
      toast({
        title: 'No hiring plan',
        description: 'Add stages to this job before adding candidates.',
        variant: 'destructive',
      })
      return
    }
    for (const id of candidateIds) {
      await createAssociationAndMove(jobId, id, stageId)
    }
  }

  const handleAdd = async (candidate: any) => {
    const id = suggestedCandidateId(candidate)
    setAddingId(id)
    try {
      await addToPipeline([id])
      persistDismissed([...dismissed, id])
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      toast({ title: 'Added to pipeline', description: `${candidate.candidate_name || 'Candidate'} is now in the first stage.` })
    } catch {
      toast({ title: 'Could not add', description: 'The candidate was not added.', variant: 'destructive' })
    } finally {
      setAddingId(null)
    }
  }

  const handleDismiss = (candidate: any) => {
    const id = suggestedCandidateId(candidate)
    persistDismissed([...dismissed, id])
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleBulkAdd = async () => {
    const chosen = [...selected]
    setBulkBusy(true)
    try {
      await addToPipeline(chosen)
      persistDismissed([...dismissed, ...chosen])
      setSelected(new Set())
      toast({ title: 'Added to pipeline', description: `${chosen.length} candidates added to the first stage.` })
    } catch {
      toast({ title: 'Could not add', description: 'Some candidates were not added.', variant: 'destructive' })
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkDismiss = () => {
    persistDismissed([...dismissed, ...selected])
    setSelected(new Set())
  }

  const handleRefresh = () => {
    setSelected(new Set())
    refetch()
  }

  const everythingReviewed = !isLoading && candidates.length > 0 && visible.length === 0

  return (
    <div style={{ position: 'relative' }}>
      <SuggestedToolbar
        state={state}
        total={visible.length}
        shown={filtered.length}
        searched={searchedCount}
        updatedAt={lastUpdatedAt}
        filters={filters}
        skillOptions={skillOptions}
        locationOptions={locationOptions}
        onRemoveFilter={(id) => setFilters((prev) => prev.filter((f) => f.id !== id))}
        onAddFilter={(f) => setFilters((prev) => addSuggestedFilter(prev, f))}
        onRefresh={handleRefresh}
      />

      {state === 'loading' && (
        <SuggestedSkeleton criteria={jobSkills?.length ? jobSkills.slice(0, 5).join(' · ') : null} />
      )}

      {state === 'results' && (
        <SuggestedTable
          candidates={filtered}
          statuses={statuses}
          jobSkills={jobSkills}
          jobLocation={jobLocation}
          selected={selected}
          onToggle={(id, next) =>
            setSelected((prev) => {
              const s = new Set(prev)
              if (next) s.add(id)
              else s.delete(id)
              return s
            })
          }
          onToggleAll={(next) =>
            setSelected(next ? new Set(filtered.map((c) => suggestedCandidateId(c))) : new Set())
          }
          sort={sort}
          onSort={(key) =>
            setSort((prev) =>
              prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' },
            )
          }
          onOpen={onOpenCandidate}
          onAdd={handleAdd}
          onDismiss={handleDismiss}
          addingId={addingId}
        />
      )}

      {state === 'noresults' && (
        <SuggestedNoResults
          total={visible.length}
          filters={filters}
          onRemoveFilter={(id) => setFilters((prev) => prev.filter((f) => f.id !== id))}
          onClearFilters={() => setFilters([])}
        />
      )}

      <SelectionBar
        count={selected.size}
        busy={bulkBusy}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            id: 'add',
            label: 'Add to pipeline',
            icon: Plus,
            slot: 'primary',
            onClick: handleBulkAdd,
          },
          {
            id: 'not-a-fit',
            label: 'Not a fit',
            icon: ThumbsDown,
            slot: 'overflow',
            onClick: handleBulkDismiss,
          },
        ]}
      />

      {state === 'empty' &&
        (everythingReviewed ? (
          <SuggestedCleared onRefresh={handleRefresh} />
        ) : (
          <SuggestedEmpty onRefresh={handleRefresh} onEditRequirements={onEditRequirements} />
        ))}
    </div>
  )
}

export default JobSuggestedTab
