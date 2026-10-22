import { Info, Bookmark, Link as LinkIcon } from 'lucide-react'
import { AIJobAssistant } from '@/components/dashboard/AIJobAssistant'
import { GioThinkingHeader } from '@/components/sourcing/GioThinkingHeader'
import { Badge } from '@/components/ui/badge'
import { SoftFind } from '@/components/ui/EmptyIllustrations'
import { cn } from '@/lib/utils'
import type { SourcingProject } from '@/types/sourcing'

interface FindEmptyStateProps {
  isGenerating: boolean
  onGeneratingChange: (v: boolean) => void
  onProjectCreated: (projectId: string) => void
  recentProjects: SourcingProject[]
  onSelectProject: (id: string) => void
}

export function FindEmptyState({
  isGenerating,
  onGeneratingChange,
  onProjectCreated,
  recentProjects,
  onSelectProject,
}: FindEmptyStateProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-5 py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[820px] space-y-8">
          {/* Hero */}
          <div className="text-center space-y-4">
            <div className="mx-auto w-[200px] h-[160px] flex items-center justify-center">
              <SoftFind />
            </div>

            {isGenerating ? (
              <GioThinkingHeader />
            ) : (
              <>
                <h2 className="font-poppins font-semibold text-text-primary text-[26px] sm:text-[30px] leading-tight tracking-[-0.04em]">
                  Who are you looking for<span className="text-virgilio-purple">?</span>
                </h2>
                <p className="text-body-md text-text-secondary max-w-[520px] mx-auto">
                  Describe the role in your own words. Gio turns it into a search and pulls preview profiles you can browse for free — collect the ones you want.
                </p>
              </>
            )}
          </div>

          {/* Prompt composer */}
          <div className={cn(isGenerating && 'hidden')}>
            <AIJobAssistant
              variant="find"
              onProjectCreated={onProjectCreated}
              onGeneratingChange={onGeneratingChange}
            />
          </div>

          {/* Info banner */}
          {!isGenerating && (
            <div className="flex items-start gap-2.5 rounded-xl border border-virgilio-purple/15 bg-virgilio-lilac/25 px-3.5 py-3 text-[12.5px] text-text-secondary">
              <Info className="h-4 w-4 text-virgilio-purple shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <span className="font-semibold text-text-primary">Browsing is free.</span> People already in Gio come first. Adding someone new from Apollo uses <span className="font-semibold text-text-primary">1 credit</span> and brings in their email, work history and LinkedIn.
              </p>
            </div>
          )}

          {/* Continue a saved search */}
          {!isGenerating && recentProjects.length > 0 && (
            <section className="space-y-3">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                Continue a saved search
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recentProjects.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => onSelectProject(proj.id)}
                    className="group inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-full border border-border bg-white hover:bg-[#FAFAF7] transition-colors"
                  >
                    <Bookmark className="h-3.5 w-3.5 text-virgilio-purple" />
                    <span className="font-poppins font-medium text-[12px] text-text-primary tracking-[-0.005em] max-w-[160px] truncate">
                      {proj.name}
                    </span>
                    {proj.total_candidates > 0 && (
                      <Badge tone="neutral" size="xs">
                        {proj.total_candidates}
                      </Badge>
                    )}
                    {proj.job_id && (
                      <LinkIcon className="h-3 w-3 text-emerald-600" />
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
