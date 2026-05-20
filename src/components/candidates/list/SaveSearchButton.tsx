import { Bookmark } from 'lucide-react'
import { forwardRef } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SaveSearchButtonProps {
  hasFilters: boolean
  pulse?: boolean
  onClick: () => void
}

/**
 * "Save as" chip-button. Lives in the search bar's right side.
 * - Dormant + tooltip when no filters are applied
 * - Calm one-shot pulse when filters are unsaved for the first time in a session
 */
export const SaveSearchButton = forwardRef<HTMLButtonElement, SaveSearchButtonProps>(
  ({ hasFilters, pulse, onClick }, ref) => {
    const btn = (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={!hasFilters}
        className={cn(
          'relative inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] font-poppins font-medium border transition-colors',
          hasFilters
            ? 'bg-white text-text-primary border-virgilio-border hover:bg-[#FAFAF7] hover:border-virgilio-purple/40'
            : 'bg-white text-text-tertiary border-virgilio-border opacity-60 cursor-not-allowed',
        )}
      >
        {/* one-shot pulse halo */}
        {hasFilters && pulse && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-md ring-2 ring-virgilio-purple/40 animate-gio-pulse motion-reduce:animate-none pointer-events-none"
          />
        )}
        <Bookmark className="h-3 w-3" />
        Save as
      </button>
    )

    if (hasFilters) return btn
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{btn}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Apply a filter first</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
)
SaveSearchButton.displayName = 'SaveSearchButton'
