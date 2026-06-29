import { User2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * ContextPane — placeholder shell (Step 1.4).
 * Snapshot, pipeline stepper, and quick actions wire up in Step 1.8.
 */
export function ContextPane() {
  return (
    <aside
      className="hidden xl:flex w-[304px] shrink-0 flex-col border-l border-virgilio-border bg-surface-primary"
      aria-label="Candidate context"
    >
      <header className="flex items-center h-14 px-4 border-b border-virgilio-border">
        <h3 className="font-poppins font-semibold text-[13px] tracking-[-0.02em] text-virgilio-text">
          Context<span className="text-[#d7c5fb]">.</span>
        </h3>
      </header>
      <div className="flex-1 overflow-auto p-4">
        <EmptyState
          variant="inline"
          size="sm"
          mascot={false}
          icon={User2}
          title="No candidate selected"
          description="Snapshot and pipeline appear once a thread is open."
        />
      </div>
    </aside>
  )
}
