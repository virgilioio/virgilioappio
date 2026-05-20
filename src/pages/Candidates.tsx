import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { CandidateFilterProvider, useCandidateFilters, type CandidateFilters } from '@/contexts/CandidateFilterContext'

import { useIndependentCandidates, CreateIndependentCandidateData } from '@/hooks/useIndependentCandidates'
import { useUserJobRoles } from '@/hooks/useUserJobRoles'
import { useCandidateKpis } from '@/hooks/useCandidateKpis'
import { useCandidateJobAssociationsMap } from '@/hooks/useCandidateJobAssociations'
import { useCandidateFilterOptions } from '@/hooks/useCandidateFilterOptions'
import { useCandidateFilteredData } from '@/hooks/useCandidateFilteredData'
import { useCandidateBooleanFilter } from '@/hooks/useCandidateBooleanFilter'
import { useMinimumDuration } from '@/hooks/useMinimumDuration'
import { useSavedViews, type SavedView } from '@/hooks/useSavedViews'

import { CandidatesHeader, type SmartListKey } from '@/components/candidates/list/CandidatesHeader'
import { CandidatesSearchesRail } from '@/components/candidates/list/CandidatesSearchesRail'
import { SearchModeTabs, type SearchMode } from '@/components/candidates/list/SearchModeTabs'
import { CandidateSearchBar } from '@/components/candidates/list/CandidateSearchBar'
import { FilterChipsRow } from '@/components/candidates/list/FilterChipsRow'
import { SavedSearchToolbar } from '@/components/candidates/list/SavedSearchToolbar'
import { BulkActionBar } from '@/components/candidates/list/BulkActionBar'
import { CandidatesTable } from '@/components/candidates/list/CandidatesTable'
import { CandidatesFooter } from '@/components/candidates/list/CandidatesFooter'
import { SaveSearchButton } from '@/components/candidates/list/SaveSearchButton'
import { SaveSearchPopover, type SaveSearchPayload } from '@/components/candidates/list/SaveSearchPopover'
import { deriveAutoName } from '@/lib/savedSearchAutoName'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'


import { CandidateFormSheet } from '@/components/candidates/CandidateFormSheet'
import { CandidateMergeDialog } from '@/components/candidates/CandidateMergeDialog'
import { MinimizableBulkUploadDialog } from '@/components/candidates/MinimizableBulkUploadDialog'
import { CSVImportDialog } from '@/components/candidates/CSVImportDialog'
import UniversalCandidateProfileSheet from '@/components/candidates/UniversalCandidateProfileSheet'
import { DeleteCandidateDialog } from '@/components/candidates/DeleteCandidateDialog'
import BulkAddToJobPipelineDialog from '@/components/candidates/BulkAddToJobPipelineDialog'

import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'

const SMART_LIST_FILTERS: Record<SmartListKey, Partial<CandidateFilters>> = {
  all: {},
  active: { pipelineStatuses: ['active', 'in_progress'] },
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

function stableHash(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as any).sort())
}

function CandidatesInner() {
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
  const { filters, setArrayFilter, setNumericFilter, setDateFilter, clearAll, activeFilterCount } = useCandidateFilters()

  // Search state
  const [mode, setMode] = useState<SearchMode>('everything')
  const [query, setQuery] = useState('')
  // Committed query used to run boolean / ai filtering on Enter (not on keystroke).
  const [committedQuery, setCommittedQuery] = useState('')
  const [searchRunTick, setSearchRunTick] = useState(0)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

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
    const arrayKeys = ['statuses','sources','countries','states','cities','companies','seniorityLevels','functionalAreas','specializations','skills','enrichmentStatuses','pipelineStatuses','jobs','stages','rejectedAtStages'] as const
    for (const k of arrayKeys) setArrayFilter(k, (rec[k] as string[]) ?? [])
    const numKeys = ['experienceMin','experienceMax','salaryMin','salaryMax'] as const
    for (const k of numKeys) setNumericFilter(k, (rec[k] as number | null) ?? null)
    setDateFilter('dateFrom', rec.dateFrom ? new Date(rec.dateFrom as any) : null)
    setDateFilter('dateTo', rec.dateTo ? new Date(rec.dateTo as any) : null)
  }, [setArrayFilter, setNumericFilter, setDateFilter])

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
  }, [setFiltersFromRecord])


  // Apply text/boolean/ai narrowing
  // - everything mode → live, debounced via input
  // - boolean mode    → only runs on commit (Enter)
  // - ai mode         → runs via edge function on Enter (separate flow)
  const everythingTerm = mode === 'everything' ? query : ''
  const baseFiltered = useCandidateFilteredData(candidates, filters, everythingTerm, associationsMap)
  const booleanExpr = mode === 'boolean' ? committedQuery : ''
  const { matches: booleanMatches, error: booleanError } = useCandidateBooleanFilter(baseFiltered, booleanExpr, mode === 'boolean')
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
  const isSearching = isBooleanRunning || isAiRunning

  // Smart list post-filter for the ones the filter context can't express
  const finalAfterSmart = useMemo(() => {
    if (!activeSmartList) return finalCandidates
    if (activeSmartList === 'favorites') {
      return finalCandidates.filter(c => associationsMap.get(c.id)?.some(a => (a as any).isFavorite))
    }
    if (activeSmartList === 'new') {
      const cutoff = Date.now() - 7 * 86400000
      return finalCandidates.filter(c => new Date(c.created_at).getTime() >= cutoff)
    }
    return finalCandidates
  }, [activeSmartList, finalCandidates, associationsMap])

  // Pagination
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [query, committedQuery, mode, filters, activeSmartList, activeViewId])
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
  const shown = Math.min(page * pageSize, finalAfterSmart.length)
  const visible = finalAfterSmart.slice(0, shown)

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
  const [profileId, setProfileId] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null)
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<{ existing: any; incoming: any; merged: any } | null>(null)
  const [bulkJobOpen, setBulkJobOpen] = useState(false)

  // Auto-open candidate sheet from query param
  useEffect(() => {
    const id = searchParams.get('openCandidate')
    if (id) {
      setProfileId(id); setProfileOpen(true)
      const next = new URLSearchParams(searchParams); next.delete('openCandidate'); setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const handleOpenCandidate = (id: string) => { setProfileId(id); setProfileOpen(true) }
  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteCandidate(deleteTarget.id)
    setDeleteTarget(null)
  }

  const handleAiSubmit = async () => {
    if (!query.trim()) return
    setAiLoading(true); setAiError(null)
    try {
      const { data, error } = await supabase.functions.invoke('candidates-nl-search', {
        body: { prompt: query, options: {
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
        }},
      })
      if (error) throw error
      const partial: Partial<CandidateFilters> = {
        skills: data.skills, countries: data.countries, cities: data.cities,
        companies: data.companies, seniorityLevels: data.seniorityLevels,
        functionalAreas: data.functionalAreas, jobs: data.jobs, stages: data.stages,
        statuses: data.statuses, sources: data.sources,
        experienceMin: data.experienceMin, experienceMax: data.experienceMax,
      }
      clearAll()
      setFiltersFromRecord(partial)
      setQuery('')
      setCommittedQuery('')
      setMode('everything')
      toast({ title: 'Filters applied from your prompt' })
    } catch (e: any) {
      setAiError(e?.message ?? 'Could not parse your query')
    } finally {
      setAiLoading(false)
    }
  }

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
    await updateView.mutateAsync({ id: activeViewId, filters: filters as any, extra_state: { query, mode } })
    setBaselineFilters({ ...filters } as Record<string, unknown>)
  }
  const handleResetChanges = () => {
    const v = views.find(x => x.id === activeViewId)
    if (v) { setFiltersFromRecord(v.filters as any); setBaselineFilters(v.filters as Record<string, unknown>) }
    else if (activeSmartList) { clearAll(); setFiltersFromRecord(SMART_LIST_FILTERS[activeSmartList] as any); setBaselineFilters((SMART_LIST_FILTERS[activeSmartList] ?? {}) as Record<string, unknown>) }
  }
  const handleExport = () => toast({ title: 'Export queued', description: 'CSV export coming soon.' })


  const archiveSelected = async () => {
    if (selectedIds.length === 0) return
    const { error } = await supabase.from('candidates').update({ status: 'inactive' }).in('id', selectedIds)
    if (error) { toast({ title: 'Archive failed', variant: 'destructive' }); return }
    toast({ title: `${selectedIds.length} archived` })
    clearSelection(); getCandidates()
  }

  if (error) {
    return <div className="p-8 text-destructive">Error loading candidates</div>
  }

  const activeView = views.find(v => v.id === activeViewId) ?? null
  const smartListLabel = activeSmartList ? SMART_LIST_LABEL[activeSmartList] : null

  return (
    <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden bg-background">
      {/* Header band */}
      <div className="shrink-0 border-b border-virgilio-border bg-surface-primary px-6 py-5">
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
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="hidden md:block">
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

          />
        </div>

        <main className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
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


          <div className="space-y-3">
            <SearchModeTabs value={mode} onChange={setMode} />
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
            <FilterChipsRow filterOptions={filterOptions} />
          </div>


          {selectedIds.length > 0 ? (
            <BulkActionBar
              selectedCount={selectedIds.length}
              totalCount={finalAfterSmart.length}
              allFilteredSelected={selectedIds.length >= finalAfterSmart.length}
              onSelectAllFiltered={selectAllFiltered}
              onClearSelection={clearSelection}
              onAddToJob={() => setBulkJobOpen(true)}
              onEmail={() => toast({ title: 'Bulk email coming soon' })}
              onTag={() => toast({ title: 'Tagging coming soon' })}
              onAddToSearch={handleSavePopoverOpen}
              onArchive={archiveSelected}
            />
          ) : null}

          <PermissionGate permission="canViewCandidates">
            <CandidatesTable
              candidates={visible}
              totalCount={finalAfterSmart.length}
              associationsMap={associationsMap}
              isLoading={isLoading}
              isSearching={isSearching}
              hasActiveFilters={activeFilterCount > 0 || !!query}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onOpenCandidate={handleOpenCandidate}
              onDelete={(c) => setDeleteTarget({ id: c.id, name: c.candidate_name })}
            />
          </PermissionGate>

          <CandidatesFooter
            shown={visible.length}
            total={finalAfterSmart.length}
            pageSize={pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
            onLoadMore={() => setPage(p => p + 1)}
            canLoadMore={shown < finalAfterSmart.length}
          />
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
        <CandidateMergeDialog
          isOpen={showMergeDialog}
          onConfirm={async () => {
            await updateCandidate(duplicateInfo.existing.id, duplicateInfo.merged)
            setShowMergeDialog(false); setDuplicateInfo(null); setIsFormOpen(false); setSelectedCandidate(null)
            toast({ title: 'Candidate merged' })
          }}
          onCancel={() => { setShowMergeDialog(false); setDuplicateInfo(null) }}
          existingCandidate={duplicateInfo.existing}
          newCandidate={duplicateInfo.incoming}
          mergedCandidate={duplicateInfo.merged}
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

      <UniversalCandidateProfileSheet
        candidateId={profileId}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />

      {deleteTarget && (
        <DeleteCandidateDialog
          open={!!deleteTarget}
          onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
          candidateId={deleteTarget.id}
          candidateName={deleteTarget.name}
          onConfirm={handleDelete}
        />
      )}

      {bulkJobOpen && (
        <BulkAddToJobPipelineDialog
          candidateIds={selectedIds}
          onCompleted={() => { setBulkJobOpen(false); clearSelection(); getCandidates() }}
        />
      )}
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
