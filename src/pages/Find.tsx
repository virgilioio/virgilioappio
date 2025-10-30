import { useState } from 'react'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AIJobAssistant } from '@/components/dashboard/AIJobAssistant'
import { Section } from '@/components/layout/Section'
import { SourcingSidebar } from '@/components/sourcing/SourcingSidebar'
import { SourcingProjectView } from '@/components/sourcing/SourcingProjectView'
import gioAvatar from '@/assets/gio-avatar.png'

export default function Find() {
  const [mode, setMode] = useState<'new' | 'project'>('new')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
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
        
        <div className="flex-1 flex flex-col">
          {/* Header with toggle - always visible */}
          <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4 gap-4">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold">Find Talent</h1>
            </div>
          </header>
          
          <main className="flex-1 bg-white">
          {mode === 'new' && (
            <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12">
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
            <Section container className="py-6 sm:py-8 lg:py-12 animate-fade-in">
              <SourcingProjectView projectId={selectedProjectId} />
            </Section>
          )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
