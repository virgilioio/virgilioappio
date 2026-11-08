import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Bookmark, SlidersHorizontal } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FindFilterPanel } from '@/components/sourcing/FindFilterPanel'
import { SourcingProjectView, SourcingProjectActions as SourcingProjectActionsType } from '@/components/sourcing/SourcingProjectView'
import { FindEmptyState } from '@/components/sourcing/FindEmptyState'
import { FindSearching } from '@/components/sourcing/FindSearching'
import { useSourcingCreditWarnings } from '@/hooks/useSourcingCreditWarnings'
import { useSourcingCredits } from '@/hooks/useSourcingCredits'
import { RoleGate } from '@/components/auth/RoleGate'
import { useUserJobRoles } from '@/hooks/useUserJobRoles'
import { FirstRunOrientationDialog } from '@/components/onboarding/FirstRunOrientationDialog'
import { useSourcingProjects } from '@/hooks/useSourcingProjects'
import { SourcingProjectFilters, SearchCriteria, SourcingProject } from '@/types/sourcing'
import { SavedSearchSelector } from '@/components/sourcing/SavedSearchSelector'
import { SourcingResultsHeader } from '@/components/sourcing/SourcingResultsHeader'

export default function Find() {
  const { projectId } = useParams<{ projectId?: string }>()
  const navigate = useNavigate()
  const [isGenerating, setIsGenerating] = useState(false)
  const [showFirstRunDialog, setShowFirstRunDialog] = useState(false)
  
  const [filters, setFilters] = useState<SourcingProjectFilters>({
    matchTiers: [],
    minExperience: 0,
    maxExperience: 30,
    source: 'all'
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showCriteria, setShowCriteria] = useState(false)
  const [currentProject, setCurrentProject] = useState<SourcingProject | null>(null)
  
  const [editableCriteria, setEditableCriteria] = useState<SearchCriteria | null>(null)
  const updateSearchCriteriaRef = useRef<((criteria: SearchCriteria) => Promise<void>) | null>(null)
  const projectActionsRef = useRef<SourcingProjectActionsType | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialSyncRef = useRef(true)
  
  useEffect(() => {
    setFilters({
      matchTiers: [],
      minExperience: 0,
      maxExperience: 30,
      source: 'all'
    })
    setEditableCriteria(null)
    isInitialSyncRef.current = true
  }, [projectId])
  
  useEffect(() => {
    if (currentProject?.search_criteria) {
      setEditableCriteria(currentProject.search_criteria)
      isInitialSyncRef.current = true
    }
  }, [currentProject?.id, currentProject?.search_criteria])
  
  useEffect(() => {
    if (!editableCriteria || !updateSearchCriteriaRef.current) return
    if (isInitialSyncRef.current) {
      isInitialSyncRef.current = false
      return
    }
    if (!editableCriteria.title_keywords || editableCriteria.title_keywords.length === 0) return
    
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      updateSearchCriteriaRef.current?.(editableCriteria)
    }, 800)
    
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current) }
  }, [editableCriteria])

  const mode = projectId ? 'project' : 'new'

  // ── Gio searching (FindSearching, 2026-11-08) ──
  // One session per search: it starts when a prompt is sent (Gio writes the search)
  // or when a search's results start loading, carries on into the new search's first
  // load, and shows only past 600ms, so a quick answer goes straight to the results.
  type SearchSession = { key: number; query: string; state: 'searching' | 'done' | 'error'; shown: boolean; count: number; strong: number }
  const [session, setSession] = useState<SearchSession | null>(null)
  const sessionRef = useRef<SearchSession | null>(null)
  sessionRef.current = session
  const [stoppedPrompt, setStoppedPrompt] = useState(false)
  const stoppedRef = useRef(false)
  const createdRef = useRef(false)
  const writingRef = useRef(false)
  const [promptBack, setPromptBack] = useState<string | undefined>(undefined)

  const startSession = useCallback((query: string) => {
    const s = sessionRef.current
    if (s && s.state === 'searching') {
      if (query && !s.query) setSession({ ...s, query })
      return
    }
    const key = Date.now()
    setSession({ key, query, state: 'searching', shown: false, count: 0, strong: 0 })
    window.setTimeout(() => {
      setSession((x) => (x && x.key === key && x.state === 'searching' ? { ...x, shown: true } : x))
    }, 600)
  }, [])

  const finishSession = useCallback((r: { error: boolean; count: number; strong: number }) => {
    setSession((s) => {
      if (!s || s.state !== 'searching') return s
      // Answered before it showed: straight to the results.
      if (!s.shown) return null
      // No results reads like a failed search: no badge, then the page's own state.
      return { ...s, state: r.error || r.count === 0 ? 'error' : 'done', count: r.count, strong: r.strong }
    })
  }, [])

  const handleGeneratingChange = useCallback((v: boolean, prompt?: string) => {
    setIsGenerating(v)
    if (v) {
      // The chat's "create from conversation" opens its own sheet; only a sent prompt searches.
      if (prompt === undefined) return
      writingRef.current = true
      stoppedRef.current = false
      createdRef.current = false
      setStoppedPrompt(false)
      startSession(prompt)
    } else if (writingRef.current) {
      writingRef.current = false
      if (!createdRef.current && !stoppedRef.current) finishSession({ error: true, count: 0, strong: 0 })
    }
  }, [startSession, finishSession])

  const handleProjectCreated = useCallback((newProjectId: string) => {
    // Stopped while Gio wrote the search: stay on the prompt; the search is in Recent.
    if (stoppedRef.current) return false
    createdRef.current = true
    navigate(`/find/${newProjectId}`)
    return true
  }, [navigate])

  const handleSearchState = useCallback((st: { status: 'searching' | 'done' | 'error'; count: number; strong: number; query: string }) => {
    if (st.status === 'searching') startSession(st.query)
    else finishSession({ error: st.status === 'error', count: st.count, strong: st.strong })
  }, [startSession, finishSession])

  // Opening another search (Recent, the sidebar) starts its own session; a new
  // search's own id arriving (none → id) carries the session on.
  const lastProjectId = useRef(projectId)
  useEffect(() => {
    const before = lastProjectId.current
    lastProjectId.current = projectId
    if (before && before !== projectId) setSession(null)
  }, [projectId])

  const stopSearching = () => {
    const query = sessionRef.current?.query
    setSession(null)
    if (mode === 'new') {
      stoppedRef.current = true
      setStoppedPrompt(true)
    } else {
      setPromptBack(query || undefined)
      navigate('/find')
    }
  }
  
  const { data: sourcingProjects, isLoading: isLoadingProjects } = useSourcingProjects()
  
  useSourcingCreditWarnings()
  
  const { hasRecruiterRole, isPrivileged, isLoading: rolesLoading } = useUserJobRoles()
  
  useEffect(() => {
    if (!rolesLoading && !isPrivileged && !hasRecruiterRole) {
      navigate('/dashboard', { replace: true })
    }
  }, [rolesLoading, isPrivileged, hasRecruiterRole, navigate])

  const handleNewSearch = () => navigate('/find')

  useEffect(() => {
    if (isLoadingProjects) return
    const firstRunFlag = sessionStorage.getItem('virgilio_first_run')
    if (sourcingProjects && sourcingProjects.length > 0) {
      if (firstRunFlag) sessionStorage.removeItem('virgilio_first_run')
      return
    }
    if (firstRunFlag === 'true') setShowFirstRunDialog(true)
  }, [isLoadingProjects, sourcingProjects])

  const handleProjectLoaded = useCallback((project: SourcingProject) => {
    setCurrentProject(project)
  }, [])

  const handleExposeUpdateSearchCriteria = useCallback((fn: ((criteria: SearchCriteria) => Promise<void>) | null) => {
    updateSearchCriteriaRef.current = fn
  }, [])

  // "Edit search" in an empty result: bring the criteria panel into view and focus its first field.
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const handleEditSearch = useCallback(() => {
    setShowCriteria(true)
    const panel = filterPanelRef.current
    const field = panel?.querySelector<HTMLElement>('input:not([type=hidden]), textarea') ?? panel?.querySelector<HTMLElement>('button')
    field?.scrollIntoView({ block: 'nearest' })
    field?.focus()
  }, [])

  const handleExposeActions = useCallback((actions: SourcingProjectActionsType | null) => {
    projectActionsRef.current = actions
  }, [])

  const handleCriteriaChange = useCallback((updates: Partial<SearchCriteria>) => {
    setEditableCriteria(prev => {
      const base = prev || {
        skills: [], title_keywords: [], keywords: [], locations: [],
        seniorities: [], company_sizes: [], industries: [],
        company_names: [], experience_years: {},
      }
      return { ...base, ...updates }
    })
  }, [])

  const { data: creditsUsage } = useSourcingCredits()
  const collectRemaining = creditsUsage
    ? Math.max(0, (creditsUsage.collect_credits_limit || 0) - (creditsUsage.collect_credits_used || 0)) + (creditsUsage.bonus_credits_available || 0)
    : null

  return (
    <RoleGate
      allowedRoles={['isPlatformAdmin', 'isWorkspaceOwner', 'isAdmin', 'isMember']}
      redirectTo="/dashboard"
      accessDeniedMessage="The Find feature is only available to recruiters and administrators."
    >
      <FirstRunOrientationDialog
        open={showFirstRunDialog}
        onComplete={() => setShowFirstRunDialog(false)}
      />

      <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem-var(--gio-strip))] flex flex-col overflow-hidden bg-virgilio-cream">
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Page header — matches Jobs / Candidates pattern */}
            <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="font-poppins font-semibold tracking-[-0.04em] text-text-primary text-[28px] leading-tight sm:text-[32px]">
                    Find<span className="text-virgilio-purple">.</span>
                  </h1>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-text-tertiary">
                  <Badge tone="lilac" size="sm" dot>
                    {sourcingProjects?.length ?? 0} saved {(sourcingProjects?.length ?? 0) === 1 ? 'search' : 'searches'}
                  </Badge>
                  {collectRemaining != null && (
                    <>
                      <span className="text-text-tertiary/60">·</span>
                      <span>{collectRemaining} sourcing credits</span>
                    </>
                  )}
                  {creditsUsage?.next_reset && (
                    <>
                      <span className="text-text-tertiary/60">·</span>
                      <span>Renews {format(new Date(creditsUsage.next_reset), 'MMM d')}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <SavedSearchSelector
                  selectedProjectId={projectId ?? null}
                  currentProject={currentProject}
                  onSelectProject={(id) => navigate(`/find/${id}`)}
                  onNewSearch={handleNewSearch}
                  trigger={
                    <Button variant="secondary" size="md" icon={Bookmark}>
                      My searches
                    </Button>
                  }
                />
                <Button
                  variant="secondary"
                  size="md"
                  icon={SlidersHorizontal}
                  onClick={() => navigate('/settings?tab=sourcing')}
                >
                  Sourcing settings
                </Button>
              </div>
            </header>

            {/* Two-column workspace */}
            {/* Phones: the criteria sit behind "Edit search", above the results. */}
            {mode === 'project' && (
              <Button
                variant="secondary"
                size="md"
                icon={SlidersHorizontal}
                className="md:hidden"
                aria-expanded={showCriteria}
                onClick={() => setShowCriteria((v) => !v)}
              >
                {showCriteria ? 'Hide search criteria' : 'Edit search'}
              </Button>
            )}
            <div className="flex flex-col gap-6 md:min-h-[calc(100dvh-16rem-var(--gio-strip))] md:flex-row">
              {mode === 'project' && (
                <div ref={filterPanelRef} className={showCriteria ? 'h-[70dvh] md:contents' : 'hidden md:contents'}>
                <FindFilterPanel
                  linkedJob={currentProject?.job_id ? { id: currentProject.job_id, title: currentProject.jobs?.title || 'the linked job' } : null}
                  criteria={editableCriteria}
                  onCriteriaChange={handleCriteriaChange}
                  resultFilters={filters}
                  onResultFiltersChange={setFilters}
                />
                </div>
              )}

              <Card className="flex-1 flex flex-col min-h-[75dvh] md:min-h-0 overflow-hidden">
                {mode === 'project' && currentProject && (
                  <SourcingResultsHeader
                    project={currentProject}
                    isRefreshing={isRefreshing}
                    onRefresh={() => projectActionsRef.current?.onRefresh()}
                    onArchive={() => projectActionsRef.current?.onArchive()}
                    onDelete={() => projectActionsRef.current?.onDelete()}
                    onVisibilityToggle={(v) => projectActionsRef.current?.onVisibilityToggle(v) ?? Promise.resolve()}
                    onLinkToJob={(payload) => projectActionsRef.current?.onLinkToJob(payload) ?? Promise.resolve()}
                  />
                )}

                <div className="relative flex-1 min-h-0 overflow-hidden">
                  {mode === 'new' && (
                    <FindEmptyState
                      isGenerating={isGenerating && !stoppedPrompt}
                      onGeneratingChange={handleGeneratingChange}
                      onProjectCreated={handleProjectCreated}
                      recentProjects={sourcingProjects?.slice(0, 4) ?? []}
                      onSelectProject={(id) => navigate(`/find/${id}`)}
                      initialPrompt={promptBack}
                    />
                  )}

                  {mode === 'project' && projectId && (
                    <SourcingProjectView
                      projectId={projectId}
                      filters={filters}
                      onFiltersChange={setFilters}
                      isRefreshing={isRefreshing}
                      setIsRefreshing={setIsRefreshing}
                      onProjectLoaded={handleProjectLoaded}
                      onUpdateSearchCriteria={handleExposeUpdateSearchCriteria}
                      onExposeActions={handleExposeActions}
                      onEditSearch={handleEditSearch}
                      onSearchState={handleSearchState}
                    />
                  )}

                  {/* Gio searching: over the results area, one instance for the whole search. */}
                  {session?.shown && (
                    <div className="gio-find-in absolute inset-0 z-10 flex justify-center overflow-y-auto bg-card px-5 py-10 sm:items-center">
                      <FindSearching
                        key={session.key}
                        state={session.state}
                        query={session.query}
                        count={session.strong > 0 ? session.strong : session.count}
                        foundText={session.strong > 0 ? undefined : `Found ${session.count} ${session.count === 1 ? 'match' : 'matches'}`}
                        onStop={stopSearching}
                        onViewResults={() => setSession(null)}
                        onSearchAgain={() => {
                          setPromptBack(session.query || undefined)
                          setSession(null)
                          navigate('/find')
                        }}
                        onResolved={() => {
                          // A failed or empty search hands over to the page's own state.
                          if (sessionRef.current?.state === 'error') setSession(null)
                        }}
                      />
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </RoleGate>
  )
}
