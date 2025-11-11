import { useState } from 'react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AIJobAssistant } from '@/components/dashboard/AIJobAssistant'
import { Section } from '@/components/layout/Section'
import { SourcingSidebar } from '@/components/sourcing/SourcingSidebar'
import { SourcingProjectView } from '@/components/sourcing/SourcingProjectView'
import { useCoresignalCreditWarnings } from '@/hooks/useCoresignalCreditWarnings'
import { RoleGate } from '@/components/auth/RoleGate'
import gioAvatar from '@/assets/gio-avatar.png'

export default function Find() {
  const [mode, setMode] = useState<'new' | 'project'>('new')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  
  // Initialize credit warnings
  useCoresignalCreditWarnings()

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
              <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12 animate-fade-in">
                {/* Centered Container */}
                <div className="w-full max-w-3xl mx-auto space-y-8">
                  {/* Header - Centered */}
                  <div className="text-center space-y-3">
                    <div className="inline-flex items-center justify-center mb-4">
                      <img 
                        src={gioAvatar} 
                        alt="Gio AI Assistant"
                        className="h-16 w-16 rounded-full shadow-lg"
                      />
                    </div>
                    <h1 className="text-h2-mobile md:text-h2-desktop font-poppins font-bold text-virgilio-text tracking-page-title">
                      Find your people<span className="text-virgilio-purple">.</span>
                    </h1>
                    <p className="text-base text-virgilio-muted max-w-2xl mx-auto">
                      Describe the talent you need and let AI generate a complete job specification with matching candidates.
                    </p>
                  </div>

                  {/* AI Prompt Card - Centered */}
                  <AIJobAssistant 
                    onProjectCreated={(projectId) => {
                      setSelectedProjectId(projectId)
                      setMode('project')
                    }}
                  />
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
