import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { CandidateFilterProvider, useCandidateFilters, type CandidateFilters } from '@/contexts/CandidateFilterContext'

import { useIndependentCandidates, CreateIndependentCandidateData } from '@/hooks/useIndependentCandidates'
import { useUserJobRoles } from '@/hooks/useUserJobRoles'
import { useCandidateKpis } from '@/hooks/useCandidateKpis'
import { useCandidateJobAssociationsMap } from '@/hooks/useCandidateJobAssociations'
import { useCandidateFilterOptions } from '@/hooks/useCandidateFilterOptions'
import { useCandidateFilteredData, useCandidateSearchTexts } from '@/hooks/useCandidateFilteredData'
import { useCandidateInterviewDates } from '@/hooks/useCandidateInterviewDates'
import { useQuery } from '@tanstack/react-query'
import { SortMenu } from '@/components/candidates/list/SortMenu'
import { SORTS, datesFor, furthestReached, isSortKey, latest, type DateRangeFilter, type SortKey } from '@/lib/candidateDates'
import { fold, matchesEverything, queryWords } from '@/lib/candidateSearch'
import { useCandidateBooleanFilter } from '@/hooks/useCandidateBooleanFilter'
import { useMinimumDuration } from '@/hooks/useMinimumDuration'
import { useSavedViews, type SavedView } from '@/hooks/useSavedViews'

import { CandidatesHeader, type SmartListKey } from '@/components/candidates/list/CandidatesHeader'
import { CandidatesSearchesRail } from '@/components/candidates/list/CandidatesSearchesRail'
import { SearchModeTabs, type SearchMode } from '@/components/candidates/list/SearchModeTabs'
import { CandidateSearchBar } from '@/components/candidates/list/CandidateSearchBar'
import { FilterChipsRow } from '@/components/candidates/list/FilterChipsRow'
import { SavedSearchToolbar } from '@/components/candidates/list/SavedSearchToolbar'
import { SelectionBar } from '@/components/shared/SelectionBar'
import { CandidatesTable } from '@/components/candidates/list/CandidatesTable'
import { TableFooterSummary } from '@/components/ui/table-pagination'
import { SaveSearchButton } from '@/components/candidates/list/SaveSearchButton'
import { SaveSearchPopover, type SaveSearchPayload } from '@/components/candidates/list/SaveSearchPopover'
import { deriveAutoName } from '@/lib/savedSearchAutoName'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'


import { CandidateFormSheet } from '@/components/candidates/CandidateFormSheet'
import { DuplicateFlowDialog } from '@/components/candidates/duplicate/DuplicateFlowDialog'
import { MinimizableBulkUploadDialog } from '@/components/candidates/MinimizableBulkUploadDialog'
import { CSVImportDialog } from '@/components/candidates/CSVImportDialog'

import { DeleteCandidateDialog } from '@/components/candidates/DeleteCandidateDialog'
import { AddToJobPopover } from '@/components/candidates/bulk/AddToJobPopover'

import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { undoToast } from '@/lib/undoToast'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { AddTagPopover } from '@/components/candidates/tags/AddTagPopover'
import { Button } from '@/components/ui/button'
import { Tag as TagIcon, Users as UsersIcon, Share2 as Share2Icon, Briefcase, Mail as MailIcon, BookmarkPlus as BookmarkPlusIcon, Archive as ArchiveIcon } from 'lucide-react'
import { ShareListModal } from '@/components/candidates/bulk/ShareListModal'
import { useTags, useAllCandidateTagsMap, useTagMutations, type Tag } from '@/hooks/useTags'
import { recallValue, rememberValue, useScrollMemory } from '@/lib/scrollMemory'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useTenant } from '@/hooks/useTenant'
import { PossibleDuplicatesCard } from '@/components/candidates/duplicate/PossibleDuplicatesCard'

const SMART_LIST_FILTERS: Record<SmartListKey, Partial<CandidateFilters>> = {
  all: {},
  // Same people the header counts: still in a pipeline, offers included.
  active: { pipelineStatuses: ['active', 'offer'] },
  awaiting: {},
  favorites: {},
  new: {},
}
const SMART_LIST_LABEL: Record<SmartListKey, string> = {
  all: 'All candidates',
  active: 'In active pipeline',
  awaiting: 'Awaiting outreach',
  favorites: 'Favorites',
  new: 'New this week',
}

const AI_EXAMPLES = [
  'Who made it the furthest in an Account Executive role?',
  'Account Executives in Mexico with 5+ years',
  'Who did we interview in the last 2 weeks?',
  'Newest applicants this week',
]

function stableHash(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as any).sort())
}

function CandidatesInner() {
  const { tenant } = useTenant()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { hasRecruiterRole, isPrivileged, isLoading: rolesLoading } = useUserJobRoles()

  useEffect(() => {
    if (!rolesLoading && !isPrivileged && !hasRecruiterRole) {
      navigate('/dashboard', { replace: true })
    }
  }, [rolesLoading, isPrivileged, hasRecruiterRole, navigate])

  // Data
  const { candidates, isLoading, error, addCandidate, updateCandidate, deleteCandidate, getCandidates } = useIndependentCandidates()
  const { data: kpis, isLoading: kpisLoading } = useCandidateKpis()
  const candidateIds = useMemo(() => candidates.map(c => c.id), [candidates])
  const { associationsMap, associations } = useCandidateJobAssociationsMap(candidateIds)
  const filterOptions = useCandidateFilterOptions(candidates, associations)
  const { filters, setArrayFilter, setNumericFilter, setDateFilter, setDateRanges, clearAll, activeFilterCount } = useCandidateFilters()
  const { tags } = useTags()
  const tagNames = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags])
  const { data: allCandidateTagsMap } = useAllCandidateTagsMap()
  const { deleteTag } = useTagMutations()
  const activeTagId = filters.tagIds?.[0] ?? null
  const handleSelectTag = useCallback((tag: Tag) => {
    setActiveSmartList(null)
    setActiveViewId(null)
    clearAll()
    setArrayFilter('tagIds', [tag.id])
    setBaselineFilters({ tagIds: [tag.id] })
  }, [clearAll, setArrayFilter])
  // C4: deleting a tag takes it off every candidate (candidate_tags cascade).
  const handleDeleteTag = useCallback(async (tag: Tag) => {
    const n = tag.usage_count ?? 0
    const ok = await confirmDestructive({
      title: `Delete the tag \u201c${tag.name}\u201d?`,
      description: n
        ? `It comes off ${n} candidate${n === 1 ? '' : 's'} and out of your Tags list. The candidates themselves stay. This can\u2019t be undone.`
        : 'It goes from your Tags list. No candidates have it. This can\u2019t be undone.',
      confirmLabel: 'Delete tag',
    })
    if (!ok) return
    try {
      await deleteTag.mutateAsync(tag.id)
      if (activeTagId === tag.id) {
        setArrayFilter('tagIds', [])
        setActiveSmartList('all')
      }
      toast({ title: `Tag \u201c${tag.name}\u201d deleted` })
    } catch {
      toast({ title: `Couldn\u2019t delete \u201c${tag.name}\u201d`, description: 'Nothing was removed; try again.', variant: 'destructive' })
    }
  }, [deleteTag, activeTagId, setArrayFilter])

  // Search state
  const [mode, setMode] = useState<SearchMode>('everything')
  const [query, setQuery] = useState('')
  // Committed query used to run boolean / ai filtering on Enter (not on keystroke).
  const [committedQuery, setCommittedQuery] = useState('')
  const [searchRunTick, setSearchRunTick] = useState(0)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('added_desc')

  // Smart list / saved view
  const [activeSmartList, setActiveSmartList] = useState<SmartListKey | null>('all')
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [baselineFilters, setBaselineFilters] = useState<Record<string, unknown>>({})
  const baselineFiltersHash = useMemo(() => stableHash(baselineFilters), [baselineFilters])
  const { views, createView, updateView, deleteView } = useSavedViews('candidates')

  // Save-as popover state
  const [saveOpen, setSaveOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [justSavedId, setJustSavedId] = useState<string | null>(null)
  const [hasPulsed, setHasPulsed] = useState(false)


  const setFiltersFromRecord = useCallback((rec: Partial<CandidateFilters>) => {
    const arrayKeys = ['statuses','sources','countries','states','cities','companies','seniorityLevels','functionalAreas','specializations','skills','enrichmentStatuses','pipelineStatuses','jobs','stages','rejectedAtStages','tagIds'] as const
    for (const k of arrayKeys) setArrayFilter(k, (rec[k] as string[]) ?? [])
    const numKeys = ['experienceMin','experienceMax','salaryMin','salaryMax'] as const
    for (const k of numKeys) setNumericFilter(k, (rec[k] as number | null) ?? null)
    setDateFilter('dateFrom', rec.dateFrom ? new Date(rec.dateFrom as any) : null)
    setDateFilter('dateTo', rec.dateTo ? new Date(rec.dateTo as any) : null)
    setDateRanges(Array.isArray(rec.dateRanges) ? (rec.dateRanges as DateRangeFilter[]) : [])
  }, [setArrayFilter, setNumericFilter, setDateFilter, setDateRanges])

  const handleSelectSmartList = useCallback((key: SmartListKey) => {
    setActiveSmartList(key)
    setActiveViewId(null)
    clearAll()
    setFiltersFromRecord(SMART_LIST_FILTERS[key] as any)
    setBaselineFilters((SMART_LIST_FILTERS[key] ?? {}) as Record<string, unknown>)
  }, [clearAll, setFiltersFromRecord])

  const handleSelectView = useCallback((v: SavedView) => {
    setActiveSmartList(null)
    setActiveViewId(v.id)
    setFiltersFromRecord(v.filters as Partial<CandidateFilters>)
    setBaselineFilters(v.filters as Record<string, unknown>)
    const extra = (v.extra_state ?? {}) as any
    if (typeof extra.query === 'string') setQuery(extra.query)
    if (extra.mode) setMode(extra.mode as SearchMode)
    const savedSort = (v.sort_state as { key?: unknown } | null)?.key
    setSortKey(isSortKey(savedSort) ? savedSort : 'added_desc')
  }, [setFiltersFromRecord])


  // Apply text/boolean/ai narrowing
  // - everything mode → live, debounced via input
  // - boolean mode    → only runs on commit (Enter)
  // - ai mode         → runs via edge function on Enter (separate flow)
  const everythingTerm = mode === 'everything' ? query : ''
  const searchTexts = useCandidateSearchTexts(candidates, allCandidateTagsMap, tagNames)
  const needsInterviews = sortKey === 'interview' || (filters.dateRanges ?? []).some((r) => r.field === 'interview')
  const { interviewsMap, isLoading: interviewsLoading } = useCandidateInterviewDates(needsInterviews)
  const baseFiltered = useCandidateFilteredData(candidates, filters, everythingTerm, associationsMap, allCandidateTagsMap, searchTexts, interviewsMap)
  const booleanExpr = mode === 'boolean' ? committedQuery : ''
  const { matches: booleanMatches, error: booleanError } = useCandidateBooleanFilter(baseFiltered, booleanExpr, mode === 'boolean', searchTexts)
  const finalCandidates = mode === 'boolean' ? booleanMatches : baseFiltered

  // Skeleton floor for boolean/ai commits so fast filters don't flash.
  // Triggers whenever searchRunTick changes; held for ~280ms minimum.
  const [searchRunning, setSearchRunning] = useState(false)
  useEffect(() => {
    if (searchRunTick === 0) return
    setSearchRunning(true)
    const t = setTimeout(() => setSearchRunning(false), 10)
    return () => clearTimeout(t)
  }, [searchRunTick])
  const isBooleanRunning = useMinimumDuration(searchRunning, 700)
  const isAiRunning = useMinimumDuration(aiLoading, 320)
  const isSearching = isBooleanRunning || isAiRunning || interviewsLoading

  // "Awaiting outreach": the same people the header counts (database side).
  const { data: awaitingIds } = useQuery({
    queryKey: ['candidates-awaiting-outreach', tenant?.id],
    enabled: activeSmartList === 'awaiting' && !!tenant?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_candidates_awaiting_outreach', { _tenant_id: tenant!.id })
      if (error) throw error
      return new Set((data ?? []) as string[])
    },
  })

  // Smart list post-filter for the ones the filter context can't express
  const filteredAfterSmart = useMemo(() => {
    if (!activeSmartList) return finalCandidates
    if (activeSmartList === 'favorites') {
      return finalCandidates.filter(c => associationsMap.get(c.id)?.some(a => a.isFavorite))
    }
    if (activeSmartList === 'awaiting') {
      return awaitingIds ? finalCandidates.filter(c => awaitingIds.has(c.id)) : []
    }
    if (activeSmartList === 'new') {
      const cutoff = Date.now() - 7 * 86400000
      return finalCandidates.filter(c => new Date(c.created_at).getTime() >= cutoff)
    }
    return finalCandidates
  }, [activeSmartList, finalCandidates, associationsMap, awaitingIds])

  // Sorting (2026-10-14). Date sorts put people without that date last.
  const sortDef = SORTS.find((x) => x.key === sortKey) ?? SORTS[0]
  const dateColumn = useMemo(() => {
    if (sortKey === 'furthest') {
      // With a Job filter on, "furthest" means furthest in those jobs.
      const onlyJobs = filters.jobs.length ? filters.jobs : undefined
      return {
        label: 'Furthest stage',
        value: (c: { id: string }) => furthestReached(associationsMap.get(c.id), onlyJobs)?.score ?? null,
        display: (c: { id: string }) => {
          const r = furthestReached(associationsMap.get(c.id), onlyJobs)
          return r ? { text: r.label, title: `${r.label} · ${r.jobTitle}` } : null
        },
      }
    }
    const col = sortDef.column ?? SORTS[0].column!
    return {
      label: col.label,
      value: (c: { id: string; created_at: string; updated_at?: string | null }) =>
        latest(datesFor(col.field, c, associationsMap.get(c.id), interviewsMap?.get(c.id))),
    }
  }, [sortKey, sortDef, associationsMap, interviewsMap, filters.jobs])
  const finalAfterSmart = useMemo(() => {
    if (sortKey === 'added_desc') return filteredAfterSmart
    const list = [...filteredAfterSmart]
    if (sortKey === 'added_asc') return list.reverse()
    if (sortKey === 'name') {
      return list.sort((a, b) => (a.candidate_name?.trim() || '\uffff').localeCompare(b.candidate_name?.trim() || '\uffff', undefined, { sensitivity: 'base' }))
    }
    if (sortKey === 'experience') {
      return list.sort((a, b) => (b.years_experience ?? -1) - (a.years_experience ?? -1))
    }
    const keyed = list.map((c) => ({ c, t: dateColumn.value(c) }))
    keyed.sort((a, b) => (b.t ?? Number.NEGATIVE_INFINITY) - (a.t ?? Number.NEGATIVE_INFINITY))
    return keyed.map((k) => k.c)
  }, [filteredAfterSmart, sortKey, dateColumn])

  // Pagination
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [query, committedQuery, mode, filters, activeSmartList, activeViewId, sortKey])
  useEffect(() => { setAiError(null) }, [mode, query])
  // Reset committed query when switching modes so the new mode starts clean.
  useEffect(() => { setCommittedQuery('') }, [mode])

  const handleSearchSubmit = useCallback(() => {
    setCommittedQuery(query)
    setSearchRunTick(t => t + 1)
  }, [query])
  const handleSearchClear = useCallback(() => {
    setQuery('')
    setCommittedQuery('')
    setSearchRunTick(t => t + 1)
  }, [])
  const handleClearResultsFilters = useCallback(() => {
    clearAll()
    setQuery('')
    setCommittedQuery('')
    setActiveSmartList('all')
    setActiveViewId(null)
    setBaselineFilters({})
    setSearchRunTick(t => t + 1)
  }, [clearAll])
  const shown = Math.min(page * pageSize, finalAfterSmart.length)
  const visible = finalAfterSmart.slice(0, shown)

  // §9: coming back to this view (same list, search and filters) restores how many
  // pages were open and where the list was scrolled to.
  const listRef = useRef<HTMLElement>(null)
  const viewKey = `candidates:${activeSmartList}:${activeViewId ?? ''}:${mode}:${committedQuery}:${sortKey}:${JSON.stringify(filters)}`
  const [pendingPages, setPendingPages] = useState<number | null>(() => {
    const pages = recallValue(viewKey)
    return pages && pages > 1 ? pages : null
  })
  useEffect(() => {
    const pages = recallValue(viewKey)
    if (pages && pages > 1) {
      setPage(pages)
      setPendingPages(pages)
    } else setPendingPages(null)
  }, [viewKey])
  useEffect(() => {
    rememberValue(viewKey, page)
    // Only when the page count changes: a new view starts from its own memory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])
  // Restore the scroll only once the remembered pages are rendered.
  useScrollMemory(listRef, viewKey, !isLoading && visible.length > 0 && (pendingPages == null || page >= pendingPages))

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const toggleSelect = (id: string) => setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const toggleSelectAll = () => {
    const ids = visible.map(c => c.id)
    setSelectedIds(s => ids.every(i => s.includes(i)) ? s.filter(i => !ids.includes(i)) : Array.from(new Set([...s, ...ids])))
  }
  const clearSelection = () => setSelectedIds([])
  const selectAllFiltered = () => setSelectedIds(finalAfterSmart.map(c => c.id))

  // Sheets & dialogs
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  // Kept after close so the dialog can play its exit with the name still in it.
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null)
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<{ existing: any; incoming: any; merged: any } | null>(null)

  // Legacy ?openCandidate=… deep-link → redirect to new full page
  useEffect(() => {
    const id = searchParams.get('openCandidate')
    if (id) {
      const next = new URLSearchParams(searchParams); next.delete('openCandidate'); setSearchParams(next, { replace: true })
      navigate(`/candidates/${id}`)
    }
  }, [searchParams, setSearchParams, navigate])

  // ?view=… (a saved search picked in the top bar) opens that search here.
  const viewParam = searchParams.get('view')
  useEffect(() => {
    if (!viewParam) return
    const v = views.find((x) => x.id === viewParam)
    if (!v) return
    const next = new URLSearchParams(searchParams); next.delete('view'); setSearchParams(next, { replace: true })
    handleSelectView(v)
  }, [viewParam, views, searchParams, setSearchParams, handleSelectView])

  // ?import=csv (from the Talent Intelligence empty state) opens the CSV import.
  useEffect(() => {
    if (searchParams.get('import') !== 'csv') return
    const next = new URLSearchParams(searchParams); next.delete('import'); setSearchParams(next, { replace: true })
    setIsCSVImportOpen(true)
  }, [searchParams, setSearchParams])

  const handleOpenCandidate = (id: string) => navigate(`/candidates/${id}`)
  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteCandidate(deleteTarget.id, { quiet: true })
    toast({ title: `${deleteTarget.name.trim() || 'Candidate'} deleted` })
  }

  // "Ask in plain English" (2026-10-14): the AI turns the request into the
  // page's own filters, date filters and a few keywords, then the list shows
  // them as ordinary chips and an Everything search you can adjust.
  const runAiSearch = async (prompt: string) => {
    if (!prompt.trim()) return
    setAiLoading(true); setAiError(null)
    try {
      const { data, error } = await supabase.functions.invoke('candidates-nl-search', {
        body: { prompt, options: {
          skills: filterOptions.skillOptions,
          countries: filterOptions.countryOptions,
          cities: filterOptions.cityOptions,
          companies: filterOptions.companyOptions,
          seniorityLevels: filterOptions.seniorityOptions,
          functionalAreas: filterOptions.functionalAreaOptions,
          jobs: filterOptions.jobOptions,
          stages: filterOptions.stageOptions,
          statuses: filterOptions.statusOptions,
          sources: filterOptions.sourceOptions,
          pipelineStatuses: filterOptions.pipelineStatusOptions,
        }},
      })
      if (error) {
        const status = (error as { context?: Response }).context?.status
        throw new Error(
          status === 429 ? 'The AI is busy right now. Try again in a minute.'
          : status === 402 ? 'The AI service is out of credits. Tell a platform admin.'
          : status === 401 ? 'Your session ended. Sign in again to use this.'
          : 'Couldn’t reach the AI search. Try again.',
        )
      }
      const dates = (Array.isArray(data?.dates) ? data.dates : []) as DateRangeFilter[]
      // "in an Account Executive role": every job whose title has those words.
      const jobTitle = typeof data?.jobTitle === 'string' ? data.jobTitle.trim() : ''
      const jobWords = jobTitle ? queryWords(jobTitle) : []
      const titleJobs = jobWords.length
        ? filterOptions.jobOptions.filter((j) => matchesEverything({ text: fold(j.label), digits: '' }, jobWords)).map((j) => j.value)
        : []
      const sort: SortKey | null = isSortKey(data?.sort) ? data.sort : null
      const partial: Partial<CandidateFilters> = {
        skills: data.skills, countries: data.countries, cities: data.cities,
        companies: data.companies, seniorityLevels: data.seniorityLevels,
        functionalAreas: data.functionalAreas, stages: data.stages,
        statuses: data.statuses, sources: data.sources, pipelineStatuses: data.pipelineStatuses,
        jobs: [...new Set([...(data.jobs ?? []), ...titleJobs])],
        experienceMin: data.experienceMin, experienceMax: data.experienceMax,
        dateRanges: dates,
      }
      let keywords = typeof data?.query === 'string' ? data.query.trim() : ''
      // No job by that name: look for people with that title instead.
      const noSuchJob = jobTitle && titleJobs.length === 0
      if (noSuchJob) keywords = [keywords, jobTitle].filter(Boolean).join(' ')
      const understood = keywords.length > 0 || dates.length > 0 || titleJobs.length > 0 || !!sort
        || data.experienceMin != null || data.experienceMax != null
        || (['skills','countries','cities','companies','seniorityLevels','functionalAreas','jobs','stages','statuses','sources','pipelineStatuses'] as const)
          .some((k) => Array.isArray(data?.[k]) && data[k].length > 0)
      if (!understood) {
        setAiError('That didn’t turn into a search. Name a skill, title, place, company, job or a time like “last 30 days”.')
        return
      }
      clearAll()
      setFiltersFromRecord(partial)
      setActiveSmartList('all')
      setActiveViewId(null)
      setBaselineFilters({})
      setMode('everything')
      setQuery(keywords)
      setCommittedQuery('')
      if (sort) setSortKey(sort)
      const notes: string[] = []
      if (titleJobs.length) notes.push(`Looking at ${titleJobs.length === 1 ? 'the job' : `${titleJobs.length} jobs`} matching “${jobTitle}”.`)
      if (noSuchJob) notes.push(`No job is called “${jobTitle}”, so it’s searched as a title instead.`)
      if (sort) notes.push(`Sorted by ${(SORTS.find((x) => x.key === sort)?.label ?? sort).toLowerCase()}.`)
      const kw = Array.isArray(data?.keywordsFromFilters) ? (data.keywordsFromFilters as string[]) : []
      if (kw.length) notes.push(`${kw.map((k) => `“${k}”`).join(', ')} ${kw.length === 1 ? 'isn’t a filter value, so it’s' : 'aren’t filter values, so they’re'} searched as ${kw.length === 1 ? 'a keyword' : 'keywords'}.`)
      toast({ title: 'Search set from your request', description: notes.join(' ') || 'Adjust the filters below, or edit the keywords in the search bar.' })
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Couldn’t reach the AI search. Try again.')
    } finally {
      setAiLoading(false)
    }
  }
  const handleAiSubmit = () => runAiSearch(query)

  // ?ask=… from the top-bar "Ask Gio": run that request here once the
  // candidates (and so the filter options) have loaded.
  const askParam = searchParams.get('ask')
  useEffect(() => {
    if (!askParam || isLoading || candidates.length === 0) return
    const next = new URLSearchParams(searchParams); next.delete('ask'); setSearchParams(next, { replace: true })
    setMode('ai')
    setQuery(askParam)
    void runAiSearch(askParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askParam, isLoading, candidates.length])

  const filtersDirty = stableHash(filters) !== baselineFiltersHash

  // Count of array-filter keys + scalar slots that differ between current and baseline.
  const changesCount = useMemo(() => {
    const base = (baselineFilters ?? {}) as Record<string, unknown>
    let n = 0
    for (const k of Object.keys(filters)) {
      const a = (filters as any)[k]
      const b = (base as any)[k]
      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length || a.some((x, i) => x !== b[i])) n++
      } else if (a instanceof Date || b instanceof Date) {
        const av = a instanceof Date ? a.toISOString() : a ?? null
        const bv = b instanceof Date ? new Date(b as any).toISOString() : b ?? null
        if (av !== bv) n++
      } else if ((a ?? null) !== (b ?? null)) {
        n++
      }
    }
    return n
  }, [filters, baselineFilters])

  const autoName = useMemo(
    () => deriveAutoName(filters, { booleanQuery: mode === 'boolean' ? committedQuery : undefined, aiQuery: mode === 'ai' ? query : undefined }),
    [filters, mode, committedQuery, query]
  )
  const existingNames = useMemo(() => views.map(v => v.name), [views])

  const handleSavePopoverOpen = () => {
    if (activeFilterCount === 0) return
    setSaveOpen(true)
    setHasPulsed(true)
  }

  const handleSavePayload = async (payload: SaveSearchPayload) => {
    setSaving(true)
    try {
      const created = await createView.mutateAsync({
        name: payload.name,
        filters: filters as any,
        sort_state: { key: sortKey },
        extra_state: {
          query,
          mode,
          alert_on_new_matches: payload.alertOnNew,
          pinned: payload.pinned,
        },
      })
      setActiveViewId(created.id)
      setActiveSmartList(null)
      setBaselineFilters({ ...filters } as Record<string, unknown>)
      setJustSavedId(created.id)
      setSaveOpen(false)
      setTimeout(() => setJustSavedId(prev => (prev === created.id ? null : prev)), 1400)

      // Undo toast
      const t = toast({
        title: 'Search saved',
        description: `"${payload.name}" — ${finalAfterSmart.length} ${finalAfterSmart.length === 1 ? 'candidate' : 'candidates'}`,
        action: (
          <button
            type="button"
            className="ml-2 inline-flex items-center h-7 px-2 rounded-md text-[11.5px] font-poppins font-medium border border-white/20 text-white hover:bg-white/10"
            onClick={async () => {
              await deleteView.mutateAsync(created.id)
              setActiveViewId(null)
              setActiveSmartList('all')
              setBaselineFilters({})
              t.dismiss?.()
            }}
          >
            Undo
          </button>
        ) as any,
      })
    } catch (e) {
      toast({ title: "Couldn't save search", variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveChanges = async () => {
    if (!activeViewId) return
    await updateView.mutateAsync({ id: activeViewId, filters: filters as any, sort_state: { key: sortKey }, extra_state: { query, mode } })
    setBaselineFilters({ ...filters } as Record<string, unknown>)
  }
  const handleResetChanges = () => {
    const v = views.find(x => x.id === activeViewId)
    if (v) { setFiltersFromRecord(v.filters as any); setBaselineFilters(v.filters as Record<string, unknown>) }
    else if (activeSmartList) { clearAll(); setFiltersFromRecord(SMART_LIST_FILTERS[activeSmartList] as any); setBaselineFilters((SMART_LIST_FILTERS[activeSmartList] ?? {}) as Record<string, unknown>) }
  }
  const handleExport = () => toast({ title: 'Export queued', description: 'CSV export coming soon.' })

  const handleDuplicateSavedView = async (v: SavedView) => {
    try {
      const created = await createView.mutateAsync({
        name: `${v.name} (copy)`,
        filters: v.filters,
        sort_state: v.sort_state ?? undefined,
        extra_state: v.extra_state ?? undefined,
      })
      setActiveViewId(created.id)
      setActiveSmartList(null)
      setFiltersFromRecord(created.filters as Partial<CandidateFilters>)
      setBaselineFilters(created.filters as Record<string, unknown>)
      const extra = (created.extra_state ?? {}) as any
      if (typeof extra.query === 'string') setQuery(extra.query)
      if (extra.mode) setMode(extra.mode as SearchMode)
      setJustSavedId(created.id)
      setTimeout(() => setJustSavedId(prev => (prev === created.id ? null : prev)), 1400)
      toast({ title: 'Search duplicated', description: `"${created.name}"` })
    } catch {
      toast({ title: "Couldn't duplicate search", variant: 'destructive' })
    }
  }

  // C3: a saved search is only the filters; deleting it never touches candidates.
  // useSavedViews' deleteView toasts the result (and the failure) itself.
  const handleDeleteSavedView = async (view: SavedView) => {
    const ok = await confirmDestructive({
      title: `Delete the saved search \u201c${view.name}\u201d?`,
      description: 'It goes from your Searches list. The candidates it finds aren\u2019t touched. This can\u2019t be undone.',
      confirmLabel: 'Delete search',
    })
    if (!ok) return
    try {
      const wasActive = view.id === activeViewId
      await deleteView.mutateAsync(view.id)
      if (wasActive) {
        setActiveViewId(null)
        setActiveSmartList('all')
        clearAll()
        setFiltersFromRecord(SMART_LIST_FILTERS.all as any)
        setBaselineFilters((SMART_LIST_FILTERS.all ?? {}) as Record<string, unknown>)
      }
    } catch {
      // Already reported by deleteView's onError.
    }
  }





  // C2 (Block B §16, Pattern 3 + Undo): archiving marks candidates Inactive. It
  // asks first (count in the title, names as chips) and Undo puts back each
  // candidate's own previous status. Ids go in chunks so "Select all" works.
  const setStatuses = async (byStatus: Map<string, string[]>) => {
    for (const [status, ids] of byStatus) {
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await supabase.from('candidates').update({ status }).in('id', ids.slice(i, i + 200))
        if (error) throw error
      }
    }
  }
  const archiveSelected = async () => {
    const ids = selectedIds
    if (ids.length === 0) return
    const byId = new Map(candidates.map((c) => [c.id, c]))
    const previous = new Map<string, string[]>()
    for (const id of ids) {
      const st = byId.get(id)?.status || 'active'
      if (st === 'inactive') continue
      previous.set(st, [...(previous.get(st) ?? []), id])
    }
    const label = ids.length === 1 ? (byId.get(ids[0])?.candidate_name?.trim() || '1 candidate') : `${ids.length} candidates`
    try {
      await setStatuses(new Map([['inactive', ids]]))
    } catch {
      toast({ title: `Couldn’t archive ${label}. Nothing changed; try again.`, variant: 'destructive' })
      getCandidates()
      return
    }
    clearSelection(); getCandidates()
    undoToast(`${label} archived`, async () => {
      try {
        await setStatuses(previous)
        getCandidates()
      } catch {
        toast({ title: `Couldn’t restore ${label}. Try again from Status.`, variant: 'destructive' })
      }
    })
  }
  const archiveConfirm = (() => {
    const n = selectedIds.length
    const names = candidates.filter((c) => selectedIds.includes(c.id)).slice(0, 4).map((c) => c.candidate_name?.trim() || 'Unnamed candidate')
    return {
      variant: 'archive' as const,
      title: n === 1 ? `Archive ${names[0] ?? '1 candidate'}?` : `Archive ${n} candidates?`,
      description: `${n === 1 ? 'They’re' : 'They’re all'} marked Inactive. Their applications, notes and files stay, and you can change the status back at any time.`,
      confirmLabel: n === 1 ? 'Archive candidate' : `Archive ${n} candidates`,
      items: n > 1 ? names : undefined,
      itemsTotal: n,
    }
  })()

  // §16: a failed first load is an inline error with Retry, never the whole page
  // and never an empty list. With rows already on screen, they stay.
  const [loadRetry, setLoadRetry] = useState(0)
  const loadTimedOut = useLoadTimeout(isLoading, loadRetry)
  const loadError: 'failed' | 'timeout' | null =
    error && candidates.length === 0 ? 'failed' : loadTimedOut ? 'timeout' : null
  const retryLoad = () => { setLoadRetry(n => n + 1); getCandidates() }

  const editSearch = () => {
    listRef.current?.scrollTo({ top: 0 })
    listRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-candidate-search] input, [data-candidate-search] textarea')?.focus()
  }

  const activeView = views.find(v => v.id === activeViewId) ?? null
  const smartListLabel = activeSmartList ? SMART_LIST_LABEL[activeSmartList] : null
  // What hides the rows, for the filtered empty state: “query”, the smart list or
  // saved view, and how many filters.
  const filterSummary = (() => {
    const parts: string[] = []
    const q = (committedQuery || query).trim()
    if (q) parts.push(`\u201C${q}\u201D`)
    else if (activeView) parts.push(`\u201C${activeView.name}\u201D`)
    else if (activeSmartList && activeSmartList !== 'all' && smartListLabel) parts.push(`\u201C${smartListLabel}\u201D`)
    if (activeFilterCount > 0) parts.push(`${parts.length ? '' : 'these '}${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}`)
    return parts.length ? parts.join(' and ') : null
  })()

  return (
    <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden bg-virgilio-cream">
      {/* Header */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-12 pb-6">
        <CandidatesHeader
          kpis={kpis}
          isLoading={kpisLoading}
          activeSmartList={activeSmartList}
          onSelectSmartList={handleSelectSmartList}
          onAddCandidate={() => { setSelectedCandidate(null); setIsFormOpen(true) }}
          onImportCSV={() => setIsCSVImportOpen(true)}
          onBulkUpload={() => setIsBulkUploadOpen(true)}
        />
      </div>

      {/* Body: rail + main */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden px-4 sm:px-6 lg:px-8 pb-6">
        <div className="hidden md:block h-full">
          <CandidatesSearchesRail
            views={views}
            activeViewId={activeViewId}
            activeSmartList={activeSmartList}
            kpis={kpis}
            isLoading={kpisLoading}
            onSelectView={handleSelectView}
            onSelectSmartList={handleSelectSmartList}
            onCreateView={handleSavePopoverOpen}
            justSavedId={justSavedId}
            onEditView={handleSelectView}
            onDuplicateView={handleDuplicateSavedView}
            onDeleteView={(v) => void handleDeleteSavedView(v)}
            tags={tags}
            activeTagId={activeTagId}
            onSelectTag={handleSelectTag}
            onDeleteTag={(t) => void handleDeleteTag(t)}
          />
        </div>


        <main ref={listRef} className="flex-1 min-w-0 overflow-y-auto space-y-4">
          <PossibleDuplicatesCard tenantId={tenant?.id} />
          <section className="bg-surface-primary border border-virgilio-border rounded-2xl shadow-sm p-4 space-y-3">
            <SavedSearchToolbar
              activeView={activeView}
              smartListLabel={smartListLabel}
              resultsCount={finalAfterSmart.length}
              totalCount={candidates.length}
              isDirty={filtersDirty}
              changesCount={changesCount}
              onSaveChanges={handleSaveChanges}
              onResetChanges={handleResetChanges}
              onSaveAsNew={handleSavePopoverOpen}
              onExport={handleExport}
            />

            <SearchModeTabs value={mode} onChange={setMode} />
            <div data-candidate-search>
            <CandidateSearchBar
              value={query}
              onChange={setQuery}
              mode={mode}
              onSubmit={mode === 'ai' ? handleAiSubmit : (mode === 'boolean' ? handleSearchSubmit : undefined)}
              onClear={handleSearchClear}
              loading={aiLoading}
              isDirty={mode !== 'everything' && query !== committedQuery && query.trim().length > 0}
              error={mode === 'ai' ? aiError : (mode === 'boolean' && committedQuery ? booleanError : null)}
              trailing={
                <SaveSearchPopover
                  open={saveOpen}
                  onOpenChange={(o) => { setSaveOpen(o); if (o) setHasPulsed(true) }}
                  autoName={autoName}
                  existingNames={existingNames}
                  resultsCount={finalAfterSmart.length}
                  saving={saving}
                  onSave={handleSavePayload}
                  trigger={
                    <SaveSearchButton
                      hasFilters={activeFilterCount > 0 && !activeViewId}
                      pulse={!hasPulsed && filtersDirty && activeFilterCount > 0 && !activeViewId}
                      onClick={handleSavePopoverOpen}
                    />
                  }
                />
              }
            />
            </div>
            {mode === 'ai' && !query.trim() && !aiLoading && (
              <div className="flex flex-wrap items-center gap-1.5 -mt-1">
                <span className="text-[11.5px] text-text-tertiary font-inter mr-0.5">Try</span>
                {AI_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    data-ai-example
                    onClick={() => { setQuery(ex); void runAiSearch(ex) }}
                    className="gio-pressable h-7 px-2.5 rounded-md border border-virgilio-border bg-white text-[12px] font-inter text-text-secondary hover:text-text-primary hover:bg-[#FAFAF7] transition-colors whitespace-nowrap"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
            <FilterChipsRow filterOptions={filterOptions} trailing={<SortMenu value={sortKey} onChange={setSortKey} />} />
          </section>



          <section className="relative bg-surface-primary border border-virgilio-border rounded-2xl shadow-sm overflow-clip">
            <SelectionBar
              count={selectedIds.length}
              totalCount={finalAfterSmart.length}
              onSelectAll={selectAllFiltered}
              onClear={clearSelection}
              actions={[
                {
                  id: 'add-to-job',
                  label: 'Add to job',
                  icon: Briefcase,
                  slot: 'primary',
                  render: (pill) => (
                    <AddToJobPopover
                      candidateIds={selectedIds}
                      candidateNames={candidates.filter(c => selectedIds.includes(c.id)).map(c => c.candidate_name)}
                      onCompleted={() => { clearSelection(); getCandidates() }}
                      trigger={pill}
                    />
                  ),
                },
                {
                  id: 'email',
                  label: 'Email',
                  icon: MailIcon,
                  slot: 'secondary',
                  onClick: () => toast({ title: 'Bulk email coming soon' }),
                },
                {
                  id: 'tag',
                  label: 'Add tag',
                  icon: TagIcon,
                  slot: 'secondary',
                  render: (pill) => (
                    <AddTagPopover
                      candidateIds={selectedIds}
                      candidateNames={candidates.filter(c => selectedIds.includes(c.id)).map(c => c.candidate_name)}
                      align="end"
                      trigger={pill}
                    />
                  ),
                },
                {
                  id: 'add-to-search',
                  label: 'Add to talent pool',
                  icon: BookmarkPlusIcon,
                  slot: 'overflow',
                  onClick: handleSavePopoverOpen,
                },
                {
                  id: 'share',
                  label: 'Share list',
                  icon: Share2Icon,
                  slot: 'overflow',
                  render: (pill) => (
                    <ShareListModal
                      candidateIds={selectedIds}
                      candidates={candidates.filter(c => selectedIds.includes(c.id)).map((c: any) => ({
                        id: c.id,
                        name: c.candidate_name,
                        company: c.company_current ?? null,
                        stage: c.current_job_title ?? null,
                        score: typeof c.fit_score === 'number' ? c.fit_score : (typeof c.match_score === 'number' ? c.match_score : null),
                      }))}
                      trigger={pill}
                    />
                  ),
                },
                {
                  id: 'archive',
                  label: 'Archive',
                  icon: ArchiveIcon,
                  slot: 'overflow',
                  destructive: true,
                  confirm: archiveConfirm,
                  onClick: archiveSelected,
                },
              ]}
            />

            <PermissionGate permission="canViewCandidates">
              <CandidatesTable
                candidates={visible}
                totalCount={finalAfterSmart.length}
                associationsMap={associationsMap}
                dateColumn={dateColumn}
                isLoading={isLoading}
                isSearching={isSearching}
                hasActiveFilters={activeFilterCount > 0 || !!query || (!!activeSmartList && activeSmartList !== 'all') || !!activeViewId}
                baseCount={candidates.length}
                filterSummary={filterSummary}
                onEditSearch={editSearch}
                loadError={loadError}
                onRetry={retryLoad}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                onOpenCandidate={handleOpenCandidate}
                onDelete={(c) => { setDeleteTarget({ id: c.id, name: c.candidate_name ?? '' }); setDeleteOpen(true) }}
                onClearFilters={handleClearResultsFilters}
                onAddCandidate={() => setIsFormOpen(true)}
              />
            </PermissionGate>

            {visible.length > 0 && !isLoading && (
              <TableFooterSummary
                rangeStart={1}
                rangeEnd={visible.length}
                total={finalAfterSmart.length}
                entityLabel="candidates"
                onLoadMore={() => setPage(p => p + 1)}
                loadMoreLabel={`Load ${pageSize} more`}
              />
            )}
          </section>
        </main>
      </div>

      {/* Dialogs */}
      <CandidateFormSheet
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setSelectedCandidate(null) }}
        onSubmit={async (data: CreateIndependentCandidateData & { assignedJobId?: string; assignedStageId?: string }) => {
          const { assignedJobId, assignedStageId, ...payload } = data
          if (selectedCandidate) {
            await updateCandidate(selectedCandidate.id, payload)
          } else {
            const res = await addCandidate(payload)
            if (res && 'isDuplicate' in res) {
              setDuplicateInfo({ existing: res.existingCandidate, incoming: res.incomingData, merged: res.mergedData })
              setShowMergeDialog(true)
              return null
            }
            if (res && 'id' in res && res.id) setSearchParams({ openCandidate: res.id }, { replace: true })
          }
          setIsFormOpen(false); setSelectedCandidate(null)
          return null
        }}
        candidate={selectedCandidate}
        jobId=""
        isLoading={isLoading}
      />

      {duplicateInfo && (
        <DuplicateFlowDialog
          isOpen={showMergeDialog}
          existingCandidate={duplicateInfo.existing}
          incoming={duplicateInfo.incoming}
          onCancel={() => { setShowMergeDialog(false); setDuplicateInfo(null) }}
          onResolved={(candidateId) => {
            setShowMergeDialog(false); setDuplicateInfo(null); setIsFormOpen(false); setSelectedCandidate(null)
            getCandidates()
            setSearchParams({ openCandidate: candidateId }, { replace: true })
          }}
        />
      )}

      <MinimizableBulkUploadDialog
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        onComplete={() => { setIsBulkUploadOpen(false); getCandidates() }}
      />
      <CSVImportDialog
        isOpen={isCSVImportOpen}
        onClose={() => setIsCSVImportOpen(false)}
        onComplete={() => { setIsCSVImportOpen(false); getCandidates() }}
      />


      <DeleteCandidateDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        candidateId={deleteTarget?.id ?? null}
        candidateName={deleteTarget?.name ?? ''}
        onConfirm={handleDelete}
      />
    </div>

  )
}

export default function Candidates() {
  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <CandidateFilterProvider>
          <CandidatesInner />
        </CandidateFilterProvider>
      </PermissionGate>
    </AuthGate>
  )
}
