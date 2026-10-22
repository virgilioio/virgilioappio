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

      <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden bg-virgilio-cream">
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
            <div className="flex flex-col gap-6 md:min-h-[calc(100dvh-16rem)] md:flex-row">
              {mode === 'project' && (
                <div ref={filterPanelRef} className={showCriteria ? 'max-h-[70dvh] md:contents' : 'hidden md:contents'}>
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

                <div className="flex-1 min-h-0 overflow-hidden">
                  {mode === 'new' && (
                    <FindEmptyState
                      isGenerating={isGenerating}
                      onGeneratingChange={setIsGenerating}
                      onProjectCreated={(newProjectId) => navigate(`/find/${newProjectId}`)}
                      recentProjects={sourcingProjects?.slice(0, 4) ?? []}
                      onSelectProject={(id) => navigate(`/find/${id}`)}
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
                    />
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
