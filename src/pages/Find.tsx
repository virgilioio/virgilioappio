import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Bookmark, Plus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AIJobAssistant } from '@/components/dashboard/AIJobAssistant'
import { FindFilterPanel } from '@/components/sourcing/FindFilterPanel'
import { SourcingProjectView, SourcingProjectActions as SourcingProjectActionsType } from '@/components/sourcing/SourcingProjectView'
import { useSourcingCreditWarnings } from '@/hooks/useSourcingCreditWarnings'
import { useSourcingCredits } from '@/hooks/useSourcingCredits'
import { RoleGate } from '@/components/auth/RoleGate'
import { useUserJobRoles } from '@/hooks/useUserJobRoles'
import { GioThinkingHeader } from '@/components/sourcing/GioThinkingHeader'
import { FirstRunOrientationDialog } from '@/components/onboarding/FirstRunOrientationDialog'
import { useSourcingProjects } from '@/hooks/useSourcingProjects'
import { SourcingProjectFilters, SearchCriteria, SourcingProject } from '@/types/sourcing'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import gioAvatar from '@/assets/gio-avatar.png'
import { SavedSearchSelector } from '@/components/sourcing/SavedSearchSelector'
import { SourcingProjectActions } from '@/components/sourcing/SourcingProjectActions'

export default function Find() {
  const { projectId } = useParams<{ projectId?: string }>()
  const navigate = useNavigate()
  const { user, organizationId } = useAuth()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAutoCreating, setIsAutoCreating] = useState(false)
  const [showFirstRunDialog, setShowFirstRunDialog] = useState(false)
  
  const [filters, setFilters] = useState<SourcingProjectFilters>({
    matchTiers: [],
    minExperience: 0,
    maxExperience: 30,
    source: 'all'
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
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

  // Auto-create sourcing project when user adds title_keywords in new mode
  const autoCreateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const autoCreateTriggeredRef = useRef(false)
  const lastAttemptedFingerprintRef = useRef<string>('')
  
  useEffect(() => {
    if (!projectId) {
      autoCreateTriggeredRef.current = false
      lastAttemptedFingerprintRef.current = ''
    }
  }, [projectId])
  
  useEffect(() => {
    if (mode !== 'new') return
    if (autoCreateTriggeredRef.current) return
    if (!editableCriteria?.title_keywords?.length) return
    if (!user || !organizationId) return
    if (isAutoCreating) return
    
    // Build fingerprint to avoid retrying same failed payload
    const fingerprint = JSON.stringify({
      t: editableCriteria.title_keywords,
      k: editableCriteria.keywords,
      l: editableCriteria.locations,
    })
    if (fingerprint === lastAttemptedFingerprintRef.current) return
    
    if (autoCreateTimerRef.current) clearTimeout(autoCreateTimerRef.current)
    autoCreateTimerRef.current = setTimeout(async () => {
      autoCreateTriggeredRef.current = true
      lastAttemptedFingerprintRef.current = fingerprint
      setIsAutoCreating(true)
      setIsGenerating(true)
      
      try {
        const name = editableCriteria.title_keywords![0]
        const { data: project, error } = await supabase.functions.invoke('create-sourcing-project', {
          body: {
            name,
            description: `Search for ${name}`,
            job_id: null,
            organization_id: organizationId,
            search_criteria: editableCriteria,
          }
        })
        
        if (error) throw error
        if (project?.id) {
          navigate(`/find/${project.id}`, { replace: true })
          toast({ title: 'Search started', description: 'Finding candidates...' })
        }
      } catch (err) {
        console.error('Auto-create sourcing project failed:', err)
        toast({ title: 'Search failed', description: 'Could not start search. Please try again.', variant: 'destructive' })
        // Do NOT reset autoCreateTriggeredRef — fingerprint check prevents same-payload retry
        // User must change criteria to trigger a new attempt
      } finally {
        setIsAutoCreating(false)
        setIsGenerating(false)
      }
    }, 1200)
    
    return () => { if (autoCreateTimerRef.current) clearTimeout(autoCreateTimerRef.current) }
  }, [mode, editableCriteria, user, organizationId, isAutoCreating, navigate])

  const handleSelectProject = (id: string) => navigate(`/find/${id}`)
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
      
      <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden">
        <Section variant="default" banded className="animate-fade-in shrink-0">
          <AppContainer>
            <PageHeader title="Find" compact />
          </AppContainer>
        </Section>
        
        <Section className="flex-1 min-h-0 overflow-hidden !py-0">
          <AppContainer className="h-full min-h-0">
            <div className="flex gap-6 py-6 h-full min-h-0 overflow-hidden">
              <FindFilterPanel
                criteria={editableCriteria}
                onCriteriaChange={handleCriteriaChange}
                resultFilters={filters}
                onResultFiltersChange={setFilters}
              />
              
              <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
                  <SavedSearchSelector
                    selectedProjectId={projectId ?? null}
                    currentProject={currentProject}
                    onSelectProject={(id) => navigate(`/find/${id}`)}
                    onNewSearch={() => navigate('/find')}
                  />
                  {mode === 'project' && currentProject && (
                    <>
                      <div className="flex-1" />
                      <SourcingProjectActions
                        project={currentProject}
                        isRefreshing={isRefreshing}
                        onRefresh={() => projectActionsRef.current?.onRefresh()}
                        onArchive={() => projectActionsRef.current?.onArchive()}
                        onDelete={() => projectActionsRef.current?.onDelete()}
                        onVisibilityToggle={(v) => projectActionsRef.current?.onVisibilityToggle(v) ?? Promise.resolve()}
                        onLinkToJob={(id) => projectActionsRef.current?.onLinkToJob(id) ?? Promise.resolve()}
                      />
                    </>
                  )}
                </div>
                
                <div className="flex-1 min-h-0 overflow-hidden">
                  {mode === 'new' && (
                    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 h-full">
                      <div className={`w-full max-w-3xl mx-auto transition-all duration-500 ease-out ${isGenerating ? 'space-y-0' : 'space-y-8'}`}>
                        <div className={`text-center transition-all duration-500 ease-out ${isGenerating ? 'py-8' : 'space-y-3'}`}>
                          {isGenerating ? (
                            <GioThinkingHeader />
                          ) : (
                            <div className="animate-fade-in">
                              <div className="inline-flex items-center justify-center mb-4">
                                <img 
                                  src={gioAvatar} 
                                  alt="Gio AI Assistant"
                                  className="h-16 w-16 rounded-full transition-all duration-500"
                                />
                              </div>
                              <h1 className="text-xl md:text-2xl font-poppins font-bold text-foreground" style={{ letterSpacing: '-0.06em' }}>
                                What role are you hiring right now<span className="text-primary">?</span>
                              </h1>
                            </div>
                          )}
                        </div>

                        <div className={`transition-all duration-500 ease-out ${
                          isGenerating 
                            ? 'opacity-0 scale-95 max-h-0 overflow-hidden pointer-events-none' 
                            : 'opacity-100 scale-100 max-h-[1000px]'
                        }`}>
                          <AIJobAssistant 
                            onProjectCreated={(newProjectId) => navigate(`/find/${newProjectId}`)}
                            onGeneratingChange={setIsGenerating}
                          />
                        </div>
                      </div>
                    </div>
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
                    />
                  )}
                </div>
              </Card>
            </div>
          </AppContainer>
        </Section>
      </div>
    </RoleGate>
  )
}
