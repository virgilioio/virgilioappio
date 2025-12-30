import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AIJobAssistant } from '@/components/dashboard/AIJobAssistant'
import { SourcingSidebar } from '@/components/sourcing/SourcingSidebar'
import { SourcingProjectView } from '@/components/sourcing/SourcingProjectView'
import { useSourcingCreditWarnings } from '@/hooks/useSourcingCreditWarnings'
import { useSourcingProjects } from '@/hooks/useSourcingProjects'
import { RoleGate } from '@/components/auth/RoleGate'
import { GioThinkingHeader } from '@/components/sourcing/GioThinkingHeader'
import { FirstRunOrientationDialog } from '@/components/onboarding/FirstRunOrientationDialog'
import gioAvatar from '@/assets/gio-avatar.png'

export default function Find() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [mode, setMode] = useState<'new' | 'project'>('new')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showFirstRunDialog, setShowFirstRunDialog] = useState(false)
  
  // Fetch sourcing projects to determine first-run state
  const { data: sourcingProjects, isLoading: isLoadingProjects } = useSourcingProjects()
  
  // Initialize credit warnings
  useSourcingCreditWarnings()

  // Handle query param for project selection (Phase 2 support)
  useEffect(() => {
    const projectParam = searchParams.get('project')
    if (projectParam && sourcingProjects) {
      const projectExists = sourcingProjects.some(p => p.id === projectParam)
      if (projectExists) {
        setSelectedProjectId(projectParam)
        setMode('project')
        // Clean URL after setting state
        setSearchParams({}, { replace: true })
      }
    }
  }, [searchParams, sourcingProjects, setSearchParams])

  // Determine first-run state and handle dialog (with loading guard)
  useEffect(() => {
    if (isLoadingProjects) return // Wait for loading to complete
    
    const firstRunFlag = sessionStorage.getItem('virgilio_first_run')
    
    // Guard: If user already has projects, clear the flag and don't show dialog
    if (sourcingProjects && sourcingProjects.length > 0) {
      if (firstRunFlag) {
        sessionStorage.removeItem('virgilio_first_run')
      }
      return
    }
    
    // Show dialog if first-run flag is set and no projects exist
    if (firstRunFlag === 'true') {
      setShowFirstRunDialog(true)
    }
  }, [isLoadingProjects, sourcingProjects])

  const handleFirstRunComplete = () => {
    setShowFirstRunDialog(false)
  }

  // Compute first-run state for sidebar collapse
  const isFirstRunTenantFlow = !isLoadingProjects && 
    sessionStorage.getItem('virgilio_first_run') === 'true' && 
    (!sourcingProjects || sourcingProjects.length === 0)

  return (
    <RoleGate
      allowedRoles={['isPlatformAdmin', 'isWorkspaceOwner', 'isAdmin', 'isRecruiter']}
      redirectTo="/dashboard"
      accessDeniedMessage="The Find feature is only available to recruiters and administrators."
    >
      <FirstRunOrientationDialog 
        open={showFirstRunDialog} 
        onComplete={handleFirstRunComplete} 
      />
      
      <SidebarProvider defaultOpen={!isFirstRunTenantFlow}>
        <div className="min-h-screen flex w-full overflow-hidden">
          <SourcingSidebar 
            selectedProjectId={selectedProjectId}
            onSelectProject={(id) => {
              setSelectedProjectId(id)
              setMode('project')
            }}
            onNewSearch={() => {
              setSelectedProjectId(null)
              setMode('new')
            }}
          />
          
          <main className="flex-1 bg-white overflow-hidden">
            {mode === 'new' && (
              <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12">
                {/* Centered Container with smooth transitions */}
                <div 
                  className={`w-full max-w-3xl mx-auto transition-all duration-500 ease-out ${
                    isGenerating ? 'space-y-0' : 'space-y-8'
                  }`}
                >
                  {/* Header - Smooth transition between states */}
                  <div className={`text-center transition-all duration-500 ease-out ${
                    isGenerating ? 'py-8' : 'space-y-3'
                  }`}>
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
                        <h1 className="text-xl md:text-2xl font-poppins font-bold text-virgilio-text" style={{ letterSpacing: '-0.06em' }}>
                          What role are you hiring right now<span className="text-virgilio-purple">?</span>
                        </h1>
                      </div>
                    )}
                  </div>

                  {/* AI Prompt Card - Fades out when generating */}
                  <div className={`transition-all duration-500 ease-out ${
                    isGenerating 
                      ? 'opacity-0 scale-95 max-h-0 overflow-hidden pointer-events-none' 
                      : 'opacity-100 scale-100 max-h-[1000px]'
                  }`}>
                    <AIJobAssistant 
                      onProjectCreated={(projectId) => {
                        setSelectedProjectId(projectId)
                        setMode('project')
                      }}
                      onGeneratingChange={setIsGenerating}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {mode === 'project' && selectedProjectId && (
              <SourcingProjectView projectId={selectedProjectId} />
            )}
          </main>
        </div>
      </SidebarProvider>
    </RoleGate>
  )
}
