import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowUpDown, Briefcase, ChevronDown, Linkedin, MoreHorizontal, RotateCcw, Search, ThumbsDown, Undo2, Users } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AnimatedEmpty, EmptyCard } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { useSourcingCreditWarnings } from '@/hooks/useSourcingCreditWarnings'
import UniversalCandidateProfileSheet from '@/components/candidates/UniversalCandidateProfileSheet'
import { CandidateTableSkeleton } from './CandidateTableSkeleton'
import { JobSelectionDialog } from './JobSelectionDialog'
import { FindMatch, type FindMatchRow } from './FindMatch'
import { FindAddButton } from './FindAddButton'
import { FindGioProfileSheet } from './FindGioProfileSheet'
import { SelectionBar, type SelectionAction } from '@/components/shared/SelectionBar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { IconTip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useProjectPeople, useProjectPeopleActions, statusLookup, type PersonChange } from '@/hooks/useProjectPeople'
import { snapshotOf } from '@/lib/projectCandidateState'
import { createSimilarSearch } from '@/lib/findSimilar'
import { addFromFind, addSummary, creditsFor, type FindAddTarget, type FindPerson } from '@/lib/findAdd'

/**
 * Find's results (Allan, 2026-10-22): one 52px row per person (name, title and
 * company, location, match, Add), in lanes: people already in Gio, then new
 * people from LinkedIn data (PDL) and from Apollo. Everything else about a
 * person lives in the profile sheet a click opens. One Add control, on the row
 * and in the bulk bar, puts people in the talent pool or a job.
 */

const getDisplayName = (c: { full_name?: string; candidate_name?: string }) =>
  c.full_name || c.candidate_name || 'Unnamed candidate'

const getLocation = (c: { location?: string; location_city?: string; location_state?: string; location_country?: string }) =>
  c.location || [c.location_city, c.location_country].filter(Boolean).join(', ') || undefined

interface MatchedCandidate extends FindMatchRow {
  id: string
  candidate_name?: string
  current_role?: string
  current_company?: string
  location?: string
  location_city?: string
  location_state?: string
  location_country?: string
  linkedin_url?: string
  match_tier?: 'excellent' | 'good' | 'fair' | 'minimal' | null
  skills?: string[]
  years_experience?: number
  experience_years?: number
  source: 'local' | 'apollo' | 'pdl'
  display_source?: 'internal' | 'gio' | 'apollo' | 'pdl'
  is_preview?: boolean
  pdl_id?: string
  summary?: string
  profile_summary?: string | null
  full_name?: string
  apollo_id?: string
  headline?: string
  email?: string
  phone?: string
  candidate_id?: string | null
  has_email?: boolean
  has_phone?: boolean
  has_location?: boolean
  created_at?: string
  /** Jobs this person is or was in (internal lane only). */
  pipeline?: Array<{ job_id: string; job_title: string; stage_name: string | null; status: string; updated_at: string }>
  /** What this project decided about them (server, at search time). */
  project_status?: 'active' | 'shortlisted' | 'not_a_fit' | 'archived'
}

type Lane = 'internal' | 'pdl' | 'preview'
type SortMode = 'best' | 'recent' | 'experience'

const SORT_LABEL: Record<SortMode, string> = { best: 'Best match', recent: 'Recent activity', experience: 'Experience' }
const PAGE_STEP = 50

interface SourcingCandidateTableProps {
  candidates: MatchedCandidate[]
  isLoading: boolean
  jobId?: string | null
  /** The linked job's title, for the Add button. */
  jobTitle?: string | null
  projectId?: string | null
  searchCriteria?: import('@/types/sourcing').SearchCriteria
  onCandidatesChanged?: () => void | Promise<void>
  /** How many matches the search found before the result filters. */
  totalMatches?: number
  onClearFilters?: () => void
  onEditSearch?: () => void
  /** §16: the search failed; shown instead of "no matches". */
  loadFailed?: boolean
  onRetry?: () => void
  /** The project's organization, for "Find people like this" searches. */
  organizationId?: string | null
  /** The search's name, for the profile's breadcrumb. */
  searchName?: string | null
}

export function SourcingCandidateTable({
  candidates: allCandidates,
  isLoading,
  jobId,
  jobTitle,
  projectId,
  searchCriteria,
  onCandidatesChanged,
  totalMatches = 0,
  onClearFilters,
  onEditSearch,
  loadFailed = false,
  onRetry,
  organizationId,
  searchName,
}: SourcingCandidateTableProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isCollectDisabled, renewsOn } = useSourcingCreditWarnings()
  const linkedJob = jobId ? { id: jobId, title: jobTitle?.trim() || 'the linked job' } : null

  // "Not a fit" leaves the results (with Undo); "Show" brings them back to restore.
  const { data: projectPeople } = useProjectPeople(projectId)
  const peopleActions = useProjectPeopleActions(projectId)
  const statusOf = useMemo(() => statusLookup(projectPeople), [projectPeople])
  const [showHidden, setShowHidden] = useState(false)

  // Collected this session: the row becomes one of ours at once.
  const [collectedId, setCollectedId] = useState<Map<string, string>>(new Map())
  const [collectedName, setCollectedName] = useState<Map<string, string>>(new Map())
  const [addedTo, setAddedTo] = useState<Map<string, string>>(new Map())
  const [adding, setAdding] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [chooseFor, setChooseFor] = useState<string[] | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('best')
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP)
  const [startingSimilar, setStartingSimilar] = useState<string | null>(null)

  const rowKey = (c: MatchedCandidate) => c.apollo_id || c.id
  const laneOf = (c: MatchedCandidate): Lane =>
    c.display_source === 'internal' || (!!c.apollo_id && collectedId.has(c.apollo_id))
      ? 'internal'
      : c.display_source === 'pdl' || c.source === 'pdl' ? 'pdl' : 'preview'
  const candidateIdOf = (c: MatchedCandidate) =>
    c.candidate_id || (c.apollo_id ? collectedId.get(c.apollo_id) : undefined) || (c.display_source === 'internal' ? c.id : null)
  const rowStatus = (c: MatchedCandidate) =>
    statusOf({ apolloId: c.apollo_id, candidateId: laneOf(c) === 'internal' ? candidateIdOf(c) : null }) ?? c.project_status ?? 'active'
  const isHidden = (c: MatchedCandidate) => { const st = rowStatus(c); return st === 'not_a_fit' || st === 'archived' }

  const visibleRows = useMemo(
    () => allCandidates.filter((c) => showHidden || !isHidden(c)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allCandidates, statusOf, showHidden],
  )
  const hiddenCount = useMemo(
    () => allCandidates.filter(isHidden).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allCandidates, statusOf],
  )

  // Lanes in order; the sort applies within each lane. "Best match" keeps the
  // server's order (search match for profiles, checks for previews).
  const sortedData = useMemo(() => {
    const by = (list: MatchedCandidate[]) => {
      if (sortMode === 'best') return list
      const val = (c: MatchedCandidate) =>
        sortMode === 'experience' ? (c.years_experience ?? c.experience_years ?? -1) : Date.parse(c.created_at ?? '') || 0
      return [...list].sort((a, b) => val(b) - val(a))
    }
    const lanes: Record<Lane, MatchedCandidate[]> = { internal: [], pdl: [], preview: [] }
    for (const c of visibleRows) lanes[laneOf(c)].push(c)
    return [...by(lanes.internal), ...by(lanes.pdl), ...by(lanes.preview)]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRows, sortMode, collectedId])
  const laneCounts = useMemo(() => {
    const n: Record<Lane, number> = { internal: 0, pdl: 0, preview: 0 }
    for (const c of sortedData) n[laneOf(c)]++
    return n
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedData])

  const pageRows = sortedData.slice(0, visibleCount)
  const hasMore = visibleCount < sortedData.length

  // ── The profile sheet ──
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetKey, setSheetKey] = useState<string | null>(null)
  const sheetRow = sheetKey ? sortedData.find((c) => rowKey(c) === sheetKey) ?? null : null
  const sheetIndex = sheetRow ? sortedData.indexOf(sheetRow) : -1
  const openSheet = (c: MatchedCandidate) => {
    setSheetKey(rowKey(c))
    setSheetOpen(true)
    const i = sortedData.indexOf(c)
    if (i >= visibleCount) setVisibleCount(Math.ceil((i + 1) / PAGE_STEP) * PAGE_STEP)
  }
  const sheetLane = sheetRow ? laneOf(sheetRow) : null
  const sheetProps = (() => {
    if (!sheetRow) return { candidateId: null, apolloId: null, apolloData: null, pdlData: null }
    const realName = sheetRow.apollo_id ? collectedName.get(sheetRow.apollo_id) : undefined
    if (sheetLane === 'internal') {
      return {
        candidateId: candidateIdOf(sheetRow),
        apolloId: sheetRow.apollo_id || null,
        apolloData: sheetRow.apollo_id ? { ...sheetRow, candidate_name: realName || sheetRow.candidate_name, full_name: realName || sheetRow.full_name } : null,
        pdlData: null,
      }
    }
    if (sheetLane === 'pdl') return { candidateId: null, apolloId: null, apolloData: null, pdlData: sheetRow }
    return { candidateId: null, apolloId: sheetRow.apollo_id || null, apolloData: sheetRow, pdlData: null }
  })()

  // ── Adding ──
  const personOf = (c: MatchedCandidate): FindPerson => {
    const lane = laneOf(c)
    return {
      key: rowKey(c),
      kind: lane,
      candidateId: lane === 'internal' ? candidateIdOf(c) : null,
      apolloId: lane === 'preview' ? c.apollo_id ?? null : null,
      name: getDisplayName(c),
      pdl: lane === 'pdl' ? (c as unknown as Record<string, unknown>) : undefined,
    }
  }

  const runAdd = async (rows: MatchedCandidate[], target: FindAddTarget) => {
    const people = rows.filter((c) => !addedTo.has(rowKey(c))).map(personOf)
    if (!people.length) return
    if (creditsFor(people) > 0 && isCollectDisabled) {
      toast.error(`This cycle's Apollo credits are used. They renew on ${renewsOn}.`)
      return
    }
    const keys = people.map((p) => p.key)
    setAdding((prev) => new Set([...prev, ...keys]))
    try {
      const res = await addFromFind(people, target, projectId ?? null)
      if (res.collected.size) setCollectedId((prev) => new Map([...prev, ...res.collected]))
      if (res.names.size) setCollectedName((prev) => new Map([...prev, ...res.names]))
      const label = target.kind === 'job' ? target.jobTitle : 'Talent pool'
      setAddedTo((prev) => { const next = new Map(prev); for (const k of res.ok) next.set(k, label); return next })
      setSelected((prev) => { const next = new Set(prev); for (const k of res.ok) next.delete(k); return next })
      if (res.error === 'credits') toast.error(`This cycle's Apollo credits are used. They renew on ${renewsOn}.`)
      else if (res.ok.size === 0) toast.error(people.length === 1 ? `Couldn't add ${people[0].name}. Try again.` : "Couldn't add them. Try again.", {
        action: { label: 'Retry', onClick: () => void runAdd(rows, target) },
      })
      else toast.success(addSummary(res, target))
      if (res.collected.size) void onCandidatesChanged?.()
      queryClient.invalidateQueries({ queryKey: ['saved-candidates', projectId] })
    } finally {
      setAdding((prev) => { const next = new Set(prev); for (const k of keys) next.delete(k); return next })
    }
  }

  const chooseJobFor = (rows: MatchedCandidate[]) => setChooseFor(rows.map(rowKey))

  // ── Not a fit, Find people like this ──
  const changeFor = (c: MatchedCandidate): PersonChange => ({
    key: { apolloId: c.apollo_id ?? null, candidateId: laneOf(c) === 'internal' ? candidateIdOf(c) : null },
    snapshot: snapshotOf(c),
    previous: rowStatus(c),
  })
  const canKeep = (c: MatchedCandidate) => !!(c.apollo_id || candidateIdOf(c))
  const startSimilar = async (c: MatchedCandidate) => {
    const candidateId = candidateIdOf(c)
    if (!candidateId || !organizationId) return
    setStartingSimilar(candidateId)
    try {
      navigate(`/find/${await createSimilarSearch(candidateId, organizationId)}`)
    } catch (error) {
      toast.error("Couldn't start that search", { description: error instanceof Error ? error.message : 'Try again in a moment.' })
    } finally {
      setStartingSimilar(null)
    }
  }

  // ── Selection ──
  const selectable = (c: MatchedCandidate) => !addedTo.has(rowKey(c)) && !isHidden(c)
  const pageSelectable = pageRows.filter(selectable)
  const allOnPage = pageSelectable.length > 0 && pageSelectable.every((c) => selected.has(rowKey(c)))
  const someOnPage = pageSelectable.some((c) => selected.has(rowKey(c)))
  const toggle = (c: MatchedCandidate) =>
    setSelected((prev) => { const next = new Set(prev); const k = rowKey(c); if (next.has(k)) next.delete(k); else next.add(k); return next })
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const c of pageSelectable) { if (allOnPage) next.delete(rowKey(c)); else next.add(rowKey(c)) }
      return next
    })
  const selectedRows = sortedData.filter((c) => selected.has(rowKey(c)))
  const selectedPeople = selectedRows.map(personOf)
  const selCredits = creditsFor(selectedPeople)
  const selOnlyInGio = selectedPeople.length > 0 && selectedPeople.every((p) => p.kind === 'internal')
  const costHint = selCredits ? `${selCredits} credit${selCredits === 1 ? '' : 's'}` : undefined
  const bulkBusy = selectedRows.some((c) => adding.has(rowKey(c)))

  const bulkActions: SelectionAction[] = [
    {
      id: 'add',
      slot: 'primary',
      label: linkedJob ? `Add to ${linkedJob.title}` : selOnlyInGio ? 'Add to a job' : 'Add to talent pool',
      onClick: () => (linkedJob
        ? void runAdd(selectedRows, { kind: 'job', jobId: linkedJob.id, jobTitle: linkedJob.title })
        : selOnlyInGio ? chooseJobFor(selectedRows) : void runAdd(selectedRows, { kind: 'pool' })),
      disabled: bulkBusy,
    },
    { id: 'pool', slot: 'overflow', icon: Users, label: 'Talent pool', hint: costHint, disabled: selOnlyInGio, onClick: () => void runAdd(selectedRows, { kind: 'pool' }) },
    ...(linkedJob ? [{ id: 'job', slot: 'overflow' as const, icon: Briefcase, label: linkedJob.title, hint: costHint, onClick: () => void runAdd(selectedRows, { kind: 'job', jobId: linkedJob.id, jobTitle: linkedJob.title }) }] : []),
    { id: 'choose', slot: 'overflow', icon: Search, label: linkedJob ? 'Another job or stage…' : 'Choose a job and stage…', onClick: () => chooseJobFor(selectedRows) },
    ...(projectId ? [{
      id: 'notfit', slot: 'overflow' as const, icon: ThumbsDown, label: 'Not a fit',
      onClick: () => { void peopleActions.notAFit(selectedRows.filter(canKeep).map(changeFor)); setSelected(new Set()) },
    }] : []),
  ]

  // ── States ──
  if (loadFailed && allCandidates.length === 0) {
    return <EmptyCard><LoadError what="matches for this search" onRetry={onRetry} /></EmptyCard>
  }
  if (isLoading) return <CandidateTableSkeleton rows={10} />
  if (visibleRows.length === 0) {
    return (
      <EmptyCard>
        {hiddenCount > 0 && totalMatches <= hiddenCount ? (
          <AnimatedEmpty
            scene="search"
            onceKey="find-results"
            title="Everyone here is marked not a fit"
            body={`${hiddenCount.toLocaleString()} ${hiddenCount === 1 ? 'person is' : 'people are'} hidden from the results.`}
            primary={{ label: 'Show them', icon: <RotateCcw size={16} strokeWidth={2} />, onClick: () => setShowHidden(true) }}
          />
        ) : totalMatches > 0 ? (
          <AnimatedEmpty
            scene="search"
            onceKey="find-results"
            title="No matches for these filters"
            body={`The ${totalMatches.toLocaleString()} ${totalMatches === 1 ? 'match is' : 'matches are'} still there, just hidden by your filters.`}
            primary={onClearFilters ? { label: 'Clear filters', icon: <RotateCcw size={16} strokeWidth={2} />, onClick: onClearFilters } : undefined}
          />
        ) : (
          <AnimatedEmpty
            scene="search"
            onceKey="find-results"
            title="No matches for this search"
            body="Try widening it: more titles or places, or fewer must-have skills."
            primary={onEditSearch ? { label: 'Edit search', icon: <Search size={16} strokeWidth={2} />, onClick: onEditSearch } : undefined}
          />
        )}
      </EmptyCard>
    )
  }

  const laneLabel: Record<Lane, string> = {
    internal: `Already in Gio · ${laneCounts.internal.toLocaleString()}`,
    pdl: `New from LinkedIn data · ${laneCounts.pdl.toLocaleString()}`,
    preview: `New from Apollo · ${laneCounts.preview.toLocaleString()}`,
  }
  const laneNote: Partial<Record<Lane, string>> = {
    preview: 'Apollo shows the title and company until you add someone · 1 credit each',
  }

  const initials = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '') || '?'

  // Row parts are plain functions, not components: defined in here they would
  // be new component types on every render, so an open menu would close.
  const rowMenu = (c: MatchedCandidate) => {
    const lane = laneOf(c)
    const hidden = isHidden(c)
    if (!projectId || !canKeep(c)) return null
    return (
      <DropdownMenu>
        <IconTip label="More actions">
          <DropdownMenuTrigger asChild>
            <Button size="xs" variant="ghost" iconOnly icon={MoreHorizontal} aria-label="More actions" onClick={(e) => e.stopPropagation()} />
          </DropdownMenuTrigger>
        </IconTip>
        <DropdownMenuContent align="end" sideOffset={6} onClick={(e) => e.stopPropagation()}>
          {hidden ? (
            <DropdownMenuItem onSelect={() => void peopleActions.restore([changeFor(c)])}>
              <Undo2 /><span className="truncate">Back to the results</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => void peopleActions.notAFit([changeFor(c)])}>
              <ThumbsDown /><span className="truncate">Not a fit</span>
            </DropdownMenuItem>
          )}
          {lane === 'internal' && organizationId && (
            <DropdownMenuItem disabled={!!startingSimilar} onSelect={() => void startSimilar(c)}>
              <Users /><span className="truncate">{startingSimilar === candidateIdOf(c) ? 'Starting search…' : 'Find people like this'}</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const addCell = (c: MatchedCandidate, compact?: boolean) => {
    const k = rowKey(c)
    const done = addedTo.get(k)
    const lane = laneOf(c)
    const jobs = c.pipeline?.length ?? 0
    if (isHidden(c)) return <Badge tone="neutral" size="xs">Not a fit</Badge>
    if (done) return <Badge tone="green" size="xs" className="max-w-[200px] truncate">Added · {done}</Badge>
    return (
      <>
        {lane === 'internal' && jobs > 0 && (
          <span className="text-[12px] text-text-tertiary [@media(hover:hover)]:group-hover:hidden group-focus-within:hidden group-has-[[data-add-menu-open]]:hidden [@media(hover:none)]:hidden">
            In {jobs} {jobs === 1 ? 'job' : 'jobs'}
          </span>
        )}
        <span className="hidden group-hover:inline-flex group-focus-within:inline-flex group-has-[[data-add-menu-open]]:inline-flex [@media(hover:none)]:inline-flex">
          <FindAddButton
            size="xs"
            compact={compact}
            who={getDisplayName(c)}
            linkedJob={linkedJob}
            credits={lane === 'preview' ? 1 : 0}
            onlyInGio={lane === 'internal'}
            loading={adding.has(k)}
            disabled={lane === 'preview' && isCollectDisabled}
            onAdd={(t) => void runAdd([c], t)}
            onChooseJob={() => chooseJobFor([c])}
          />
        </span>
      </>
    )
  }

  const identity = (c: MatchedCandidate) => {
    const name = (c.apollo_id && collectedName.get(c.apollo_id)) || getDisplayName(c)
    const sub = [c.current_role || c.headline, c.current_company].filter(Boolean).join(' · ')
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar className="h-7 w-7 shrink-0 bg-virgilio-purple/10">
          <AvatarFallback className="bg-virgilio-purple/10 text-[11px] font-semibold text-virgilio-purple">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13.5px] font-medium text-text-primary">{name}</span>
            {c.linkedin_url && (
              <IconTip label="Open LinkedIn">
                <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 text-[#0A66C2]" aria-label="Open LinkedIn">
                  <Linkedin className="h-3.5 w-3.5" />
                </a>
              </IconTip>
            )}
          </div>
          {sub && <div className="truncate text-[12.5px] text-text-secondary">{sub}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-text-secondary">
          <span className="tabular-nums"><span className="font-medium text-text-primary">{sortedData.length.toLocaleString()}</span> people</span>
          {laneCounts.internal > 0 && <span className="tabular-nums">· {laneCounts.internal.toLocaleString()} in Gio</span>}
          {laneCounts.pdl + laneCounts.preview > 0 && <span className="tabular-nums">· {(laneCounts.pdl + laneCounts.preview).toLocaleString()} new</span>}
          {hiddenCount > 0 && (
            <button type="button" onClick={() => setShowHidden((v) => !v)} className="tabular-nums text-text-tertiary underline-offset-2 hover:text-text-primary hover:underline">
              · {showHidden ? `Hide ${hiddenCount} not a fit` : `${hiddenCount} hidden as not a fit · Show`}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="md:hidden" onClick={togglePage} disabled={pageSelectable.length === 0}>
            {allOnPage ? 'Clear selection' : 'Select all'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" icon={ArrowUpDown} dropdown>{SORT_LABEL[sortMode]}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => (
                <DropdownMenuItem key={m} onSelect={() => setSortMode(m)}>
                  <span className="truncate">{SORT_LABEL[m]}</span>
                  {sortMode === m && <span className="gio-mrow-check" aria-hidden />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Desktop table */}
      <Card className="hidden min-h-0 flex-1 flex-col overflow-clip md:flex">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={allOnPage ? true : someOnPage ? 'indeterminate' : false}
                    onCheckedChange={togglePage}
                    disabled={pageSelectable.length === 0}
                    aria-label="Select everyone shown"
                  />
                </TableHead>
                <TableHead>Person</TableHead>
                <TableHead className="w-[14%]">Location</TableHead>
                <TableHead className="w-[29%]">Match</TableHead>
                <TableHead className="w-[250px] pr-3 text-right"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((c, i) => {
                const k = rowKey(c)
                const lane = laneOf(c)
                const laneStarts = i === 0 || laneOf(pageRows[i - 1]) !== lane
                const isSel = selected.has(k)
                const isActive = sheetOpen && sheetKey === k
                return (
                  <Fragment key={k}>
                    {laneStarts && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="h-[34px] bg-[#FAFAF7] px-4 py-0 text-[11.5px] font-medium text-text-tertiary">
                          {laneLabel[lane]}
                          {laneNote[lane] && <span className="font-normal"> · {laneNote[lane]}</span>}
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow
                      data-row-id={k}
                      className={cn(
                        'group h-[52px] cursor-pointer',
                        isSel && 'bg-[#FAF8FF]',
                        isActive && 'bg-[#FAF8FF] shadow-[inset_2px_0_0_hsl(var(--virgilio-purple))]',
                        isHidden(c) && 'opacity-60',
                      )}
                      onClick={() => openSheet(c)}
                    >
                      <TableCell className="py-0 pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={() => toggle(c)}
                          disabled={!selectable(c)}
                          aria-label={`Select ${getDisplayName(c)}`}
                        />
                      </TableCell>
                      <TableCell className="max-w-0 py-0">{identity(c)}</TableCell>
                      <TableCell className="max-w-0 truncate py-0 text-[12.5px] text-text-secondary">
                        {lane === 'preview' ? <span className="text-text-tertiary">—</span> : getLocation(c) || <span className="text-text-tertiary">—</span>}
                      </TableCell>
                      <TableCell className="max-w-0 overflow-hidden py-0"><FindMatch row={c} /></TableCell>
                      <TableCell className="py-0 pr-3">
                        <div className="flex items-center justify-end gap-1">
                          {addCell(c)}
                          {rowMenu(c)}
                        </div>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
          {hasMore && (
            <div className="flex justify-center border-t border-border px-6 py-3">
              <Button variant="secondary" size="sm" iconRight={ChevronDown} onClick={() => setVisibleCount((n) => n + PAGE_STEP)}>
                Load {Math.min(PAGE_STEP, sortedData.length - visibleCount)} more
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Phone list: the same row, stacked */}
      <Card className="min-h-0 flex-1 overflow-y-auto md:hidden">
        {pageRows.map((c, i) => {
          const k = rowKey(c)
          const lane = laneOf(c)
          const laneStarts = i === 0 || laneOf(pageRows[i - 1]) !== lane
          return (
            <Fragment key={k}>
              {laneStarts && (
                <div className="bg-[#FAFAF7] px-3 py-2 text-[11.5px] font-medium text-text-tertiary">{laneLabel[lane]}</div>
              )}
              <div
                role="button"
                tabIndex={0}
                onClick={() => openSheet(c)}
                onKeyDown={(e) => { if (e.key === 'Enter') openSheet(c) }}
                className={cn('group flex items-start gap-3 border-t border-border/60 px-3 py-2.5', selected.has(k) && 'bg-[#FAF8FF]')}
              >
                <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.has(k)} onCheckedChange={() => toggle(c)} disabled={!selectable(c)} aria-label={`Select ${getDisplayName(c)}`} />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {identity(c)}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <FindMatch row={c} />
                    <div className="flex items-center gap-1">{addCell(c, true)}{rowMenu(c)}</div>
                  </div>
                </div>
              </div>
            </Fragment>
          )
        })}
        {hasMore && (
          <div className="flex justify-center border-t border-border p-3">
            <Button variant="secondary" size="sm" iconRight={ChevronDown} onClick={() => setVisibleCount((n) => n + PAGE_STEP)}>
              Load {Math.min(PAGE_STEP, sortedData.length - visibleCount)} more
            </Button>
          </div>
        )}
      </Card>

      {selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          actions={bulkActions}
          onClear={() => setSelected(new Set())}
          totalCount={sortedData.filter(selectable).length}
          onSelectAll={() => setSelected(new Set(sortedData.filter(selectable).map(rowKey)))}
          busy={bulkBusy}
        />
      )}

      <FindGioProfileSheet
        open={sheetOpen && sheetLane === 'internal'}
        onOpenChange={(open) => { setSheetOpen(open); if (!open) setSheetKey(null) }}
        candidateId={sheetRow && sheetLane === 'internal' ? candidateIdOf(sheetRow) : null}
        row={sheetRow && sheetLane === 'internal' ? {
          name: getDisplayName(sheetRow),
          matchScore: typeof sheetRow.match_score === 'number' ? sheetRow.match_score : null,
          reasons: sheetRow.fit_reasons ?? [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- search rows carry the match fields
          matchedSkills: (sheetRow as any).matched_skills ?? [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          missingMust: (sheetRow as any).missing_must ?? [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mustTotal: (sheetRow as any).must_total ?? 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pipeline: (sheetRow.pipeline ?? []) as any,
        } : null}
        linkedJob={linkedJob}
        searchName={searchName ?? null}
        rank={sheetIndex >= 0 ? sheetIndex + 1 : null}
        total={sortedData.length}
        hasPrev={sheetIndex > 0}
        hasNext={sheetIndex >= 0 && sheetIndex < sortedData.length - 1}
        onNavigatePrev={() => { if (sheetIndex > 0) openSheet(sortedData[sheetIndex - 1]) }}
        onNavigateNext={() => { if (sheetIndex >= 0 && sheetIndex < sortedData.length - 1) openSheet(sortedData[sheetIndex + 1]) }}
        addedLabel={sheetRow ? addedTo.get(rowKey(sheetRow)) ?? null : null}
        adding={sheetRow ? adding.has(rowKey(sheetRow)) : false}
        onAdd={(target) => { if (sheetRow) void runAdd([sheetRow], target) }}
        onChooseJob={() => { if (sheetRow) chooseJobFor([sheetRow]) }}
        onNotAFit={sheetRow && projectId && canKeep(sheetRow) ? () => void peopleActions.notAFit([changeFor(sheetRow)]) : undefined}
      />

      <UniversalCandidateProfileSheet
        open={sheetOpen && sheetLane !== 'internal'}
        onOpenChange={(open) => { setSheetOpen(open); if (!open) setSheetKey(null) }}
        candidateId={sheetProps.candidateId}
        apolloId={sheetProps.apolloId}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the sheet takes the raw search row
        apolloData={sheetProps.apolloData as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdlData={sheetProps.pdlData as any}
        onPdlAddToPipeline={sheetRow && sheetLane === 'pdl'
          ? () => void runAdd([sheetRow], linkedJob ? { kind: 'job', jobId: linkedJob.id, jobTitle: linkedJob.title } : { kind: 'pool' })
          : undefined}
        isPdlAdding={sheetRow ? adding.has(rowKey(sheetRow)) : false}
        isPdlAdded={sheetRow ? addedTo.has(rowKey(sheetRow)) : false}
        jobId={jobId}
        context="sourcing"
        hasPrev={sheetIndex > 0}
        hasNext={sheetIndex >= 0 && sheetIndex < sortedData.length - 1}
        onNavigatePrev={() => { if (sheetIndex > 0) openSheet(sortedData[sheetIndex - 1]) }}
        onNavigateNext={() => { if (sheetIndex >= 0 && sheetIndex < sortedData.length - 1) openSheet(sortedData[sheetIndex + 1]) }}
        searchCriteria={searchCriteria}
        onCandidateCollected={(candidateId: string, apolloId: string) => {
          if (apolloId && candidateId) setCollectedId((prev) => new Map(prev).set(apolloId, candidateId))
          void onCandidatesChanged?.()
        }}
      />

      <JobSelectionDialog
        open={!!chooseFor}
        onOpenChange={(open) => { if (!open) setChooseFor(null) }}
        onJobSelected={(id, name, stageId, stageName) => {
          const rows = sortedData.filter((c) => chooseFor?.includes(rowKey(c)))
          setChooseFor(null)
          void runAdd(rows, { kind: 'job', jobId: id, jobTitle: name, stageId: stageId ?? null, stageName: stageName ?? null })
        }}
        onSkip={() => {
          const rows = sortedData.filter((c) => chooseFor?.includes(rowKey(c)))
          setChooseFor(null)
          if (rows.some((c) => laneOf(c) !== 'internal')) void runAdd(rows, { kind: 'pool' })
        }}
        initialJobId={jobId ?? null}
      />
    </div>
  )
}
