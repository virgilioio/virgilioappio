import { useState } from 'react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AIJobAssistant } from '@/components/dashboard/AIJobAssistant'
import { SourcingSidebar } from '@/components/sourcing/SourcingSidebar'
import { SourcingProjectView } from '@/components/sourcing/SourcingProjectView'
import { useSourcingCreditWarnings } from '@/hooks/useSourcingCreditWarnings'
import { RoleGate } from '@/components/auth/RoleGate'
import { GioThinkingHeader } from '@/components/sourcing/GioThinkingHeader'
import gioAvatar from '@/assets/gio-avatar.png'

export default function Find() {
  const [mode, setMode] = useState<'new' | 'project'>('new')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Initialize credit warnings
  useSourcingCreditWarnings()

  return (
    <RoleGate
      allowedRoles={['isPlatformAdmin', 'isWorkspaceOwner', 'isAdmin', 'isRecruiter']}
      redirectTo="/dashboard"
      accessDeniedMessage="The Find feature is only available to recruiters and administrators."
    >
      <SidebarProvider defaultOpen={true}>
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
                            className="h-16 w-16 rounded-full shadow-lg transition-all duration-500"
                          />
                        </div>
                        <h1 className="text-h2-mobile md:text-h2-desktop font-poppins font-bold text-virgilio-text tracking-page-title">
                          Find your people<span className="text-virgilio-purple">.</span>
                        </h1>
                        <p className="text-base text-virgilio-muted max-w-2xl mx-auto">
                          Describe the talent you need and let AI generate a complete job specification with matching candidates.
                        </p>
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
