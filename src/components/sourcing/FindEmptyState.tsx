import { Sparkles, Lightbulb, Info, Code2, TrendingUp, Users, ArrowUpRight, Bookmark, Link as LinkIcon, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
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

const STARTING_POINTS = [
  { icon: Code2, title: 'Sr. Backend Engineer (Go)', meta: '5+ yr · Stripe / Plaid alumni' },
  { icon: TrendingUp, title: 'Growth PM, B2B SaaS', meta: 'PLG · self-serve · NY or remote' },
  { icon: Users, title: 'Account Exec, US East', meta: 'Enterprise · $50k+ ACV' },
  { icon: Sparkles, title: 'Applied ML engineer', meta: 'LLM eval · agents · 4+ yr' },
]

export function FindEmptyState({
  isGenerating,
  onGeneratingChange,
  onProjectCreated,
  recentProjects,
  onSelectProject,
}: FindEmptyStateProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Top bar — saved-search trigger + Examples */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
        <button
          type="button"
          className="inline-flex items-center gap-2.5 group"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#0d0d09] text-white shrink-0">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="font-poppins font-semibold text-[13.5px] text-text-primary tracking-[-0.01em]">
              New search
            </span>
            <span className="text-[11.5px] text-text-tertiary">
              0 candidates · refreshed —
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-text-tertiary opacity-60 group-hover:opacity-100" />
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[12.5px] font-poppins font-medium text-text-secondary hover:text-text-primary hover:bg-[#F1F0EC] transition-colors"
        >
          <Lightbulb className="h-3.5 w-3.5" />
          Examples
        </button>
      </div>

      <div className="px-5 py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[820px] space-y-8">
          {/* Hero */}
          <div className="text-center space-y-4 animate-fade-in">
            <div className="relative inline-flex items-center justify-center">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-virgilio-purple to-virgilio-purple/60 flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(124,58,237,0.45)]">
                {isGenerating ? (
                  <Sparkles className="h-8 w-8 text-white animate-pulse" />
                ) : (
                  <Sparkles className="h-8 w-8 text-white" />
                )}
              </div>
              <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
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
          <div className={cn(
            'transition-all duration-500 ease-out',
            isGenerating ? 'opacity-0 scale-95 max-h-0 overflow-hidden pointer-events-none' : 'opacity-100 scale-100 max-h-[1200px]'
          )}>
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
                Gio returns ~80–120 preview candidates. <span className="font-semibold text-text-primary">Browsing is free.</span> Spend <span className="font-semibold text-text-primary">1 credit</span> per candidate to reveal email, phone, full work history and resume.
              </p>
            </div>
          )}

          {/* Try a starting point */}
          {!isGenerating && (
            <section className="space-y-3">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                Try a starting point
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {STARTING_POINTS.map((p) => {
                  const Icon = p.icon
                  return (
                    <button
                      key={p.title}
                      type="button"
                      className="group flex items-start gap-3 rounded-xl border border-border bg-white px-3.5 py-3 text-left transition-colors hover:bg-[#FAFAF7]"
                    >
                      <span className="h-9 w-9 rounded-lg bg-virgilio-lilac/40 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-virgilio-purple" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-poppins font-semibold text-[13.5px] text-text-primary tracking-[-0.01em] truncate">
                          {p.title}
                        </span>
                        <span className="block text-body-sm text-text-tertiary truncate">
                          {p.meta}
                        </span>
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-text-tertiary group-hover:text-virgilio-purple shrink-0 mt-0.5" />
                    </button>
                  )
                })}
              </div>
            </section>
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
                    title={`Updated ${formatDistanceToNow(new Date(proj.updated_at), { addSuffix: false })} ago`}
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
