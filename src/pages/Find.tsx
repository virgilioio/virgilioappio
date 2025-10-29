import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AIJobAssistant } from '@/components/dashboard/AIJobAssistant'
import { Section } from '@/components/layout/Section'
import { SourcingSidebar } from '@/components/sourcing/SourcingSidebar'
import { SourcingProjectView } from '@/components/sourcing/SourcingProjectView'

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
        
        <main className="flex-1">
          <Section container className="py-6 sm:py-8 lg:py-12 animate-fade-in">
            {mode === 'new' && (
              <div className="space-y-6">
                {/* Page Header */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-accent-foreground" />
                    <h1 className="text-h3-mobile sm:text-h3-desktop font-poppins font-bold text-foreground tracking-page-title">
                      Find Talent<span className="text-purple-period">.</span>
                    </h1>
                  </div>
                  <p className="text-base text-muted-foreground max-w-3xl">
                    Use AI to generate complete job specifications and discover matching candidates from your talent pool.
                  </p>
                </div>

                {/* AI Job Assistant */}
                <AIJobAssistant 
                  onProjectCreated={(projectId) => {
                    setSelectedProjectId(projectId)
                    setMode('project')
                  }}
                />
              </div>
            )}
            
            {mode === 'project' && selectedProjectId && (
              <SourcingProjectView projectId={selectedProjectId} />
            )}
          </Section>
        </main>
      </div>
    </SidebarProvider>
  )
}
