import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { Card } from '@/components/ui/card'
import { AIJobAssistant } from '@/components/dashboard/AIJobAssistant'
import { FindFilterPanel } from '@/components/sourcing/FindFilterPanel'
import { SavedSearchSelector } from '@/components/sourcing/SavedSearchSelector'
import { SourcingProjectView } from '@/components/sourcing/SourcingProjectView'
import { useSourcingCreditWarnings } from '@/hooks/useSourcingCreditWarnings'
import { RoleGate } from '@/components/auth/RoleGate'
import { useUserJobRoles } from '@/hooks/useUserJobRoles'
import { GioThinkingHeader } from '@/components/sourcing/GioThinkingHeader'
import { FirstRunOrientationDialog } from '@/components/onboarding/FirstRunOrientationDialog'
import { useSourcingProjects } from '@/hooks/useSourcingProjects'
import { SourcingProjectFilters, SearchCriteria, SourcingProject } from '@/types/sourcing'
import gioAvatar from '@/assets/gio-avatar.png'

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
  const [currentProject, setCurrentProject] = useState<SourcingProject | null>(null)
  
  const [editableCriteria, setEditableCriteria] = useState<SearchCriteria | null>(null)
  const updateSearchCriteriaRef = useRef<((criteria: SearchCriteria) => Promise<void>) | null>(null)
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

  const handleCriteriaChange = useCallback((updates: Partial<SearchCriteria>) => {
    setEditableCriteria(prev => prev ? { ...prev, ...updates } : null)
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
      
      <div className="min-h-screen flex flex-col overflow-hidden">
        {/* Banded header with divider */}
        <Section variant="default" banded>
          <div className="px-6">
            <PageHeader title="Find" compact />
          </div>
        </Section>
        
        {/* Main content area */}
        <div className="flex-1 flex gap-6 p-6 overflow-hidden">
          {/* Floating filter sidebar card */}
          <FindFilterPanel
            criteria={editableCriteria}
            onCriteriaChange={handleCriteriaChange}
            resultFilters={filters}
            onResultFiltersChange={setFilters}
          />
          
          {/* Main content card */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar row */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <SavedSearchSelector
                selectedProjectId={projectId}
                currentProject={currentProject}
                onSelectProject={handleSelectProject}
                onNewSearch={handleNewSearch}
              />
            </div>
            
            {/* Content body */}
            <div className="flex-1 overflow-hidden">
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
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </RoleGate>
  )
}
