import { Search, Sparkles, CornerDownLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/progress-system/Spinner'
import type { SearchMode } from './SearchModeTabs'

interface CandidateSearchBarProps {
  value: string
  onChange: (v: string) => void
  mode: SearchMode
  /** Called for boolean / ai when the user commits (Enter / Run / Cmd+Enter). */
  onSubmit?: () => void
  /** Called when user presses Esc on a non-live mode — clears committed query. */
  onClear?: () => void
  loading?: boolean
  error?: string | null
  /** True when input value differs from the last committed query (boolean / ai). */
  isDirty?: boolean
}

const PLACEHOLDERS: Record<SearchMode, string> = {
  everything: 'Search by name, email, skill, company…',
  boolean: 'e.g. Figma AND ("design systems" OR tokens) NOT junior — press Enter to run',
  ai: 'Try: senior product designers in NYC who know Figma',
}

export function CandidateSearchBar({
  value, onChange, mode, onSubmit, onClear, loading, error, isDirty,
}: CandidateSearchBarProps) {
  const Icon = mode === 'ai' ? Sparkles : Search
  const submittable = mode === 'boolean' || mode === 'ai'

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'relative flex items-center h-11 rounded-xl border bg-white transition-colors',
          mode === 'ai' ? 'border-virgilio-purple/30 focus-within:border-virgilio-purple' : 'border-virgilio-border focus-within:border-virgilio-purple',
          'focus-within:ring-2 focus-within:ring-virgilio-purple/30',
        )}
      >
        <Icon className={cn('absolute left-4 h-4 w-4', mode === 'ai' ? 'text-virgilio-purple' : 'text-text-tertiary')} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSubmit) { e.preventDefault(); onSubmit() }
            else if (e.key === 'Escape' && submittable && onClear) { e.preventDefault(); onClear() }
          }}
          placeholder={PLACEHOLDERS[mode]}
          className="flex-1 h-full pl-11 pr-32 bg-transparent outline-none text-[13.5px] font-inter text-text-primary placeholder:text-text-tertiary"
        />
        <div className="absolute right-3 flex items-center gap-2">
          {loading && <Spinner size={14} tone="purple" />}
          {mode === 'ai' ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={loading || !value.trim()}
              className={cn(
                'inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11.5px] font-poppins font-medium text-white transition-opacity',
                'bg-virgilio-purple hover:bg-virgilio-purple/90 disabled:opacity-40',
                isDirty && !loading ? 'opacity-100' : 'opacity-90',
              )}
            >
              Ask
            </button>
          ) : mode === 'boolean' ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={loading}
              title="Run boolean search (Enter)"
              className={cn(
                'inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11.5px] font-poppins font-medium border transition-colors',
                isDirty
                  ? 'bg-[#0d0d09] text-[#fffcf9] border-[#0d0d09] hover:bg-[#1a1a14]'
                  : 'bg-white text-text-tertiary border-virgilio-border opacity-70',
              )}
            >
              <CornerDownLeft className="h-3 w-3" />
              Run
            </button>
          ) : (
            <div className="flex items-center gap-0.5 text-[10px] text-text-tertiary">
              <kbd className="px-1.5 py-0.5 bg-[#F1F0EC] rounded font-mono">⌘</kbd>
              <kbd className="px-1 py-0.5 bg-[#F1F0EC] rounded font-mono">K</kbd>
            </div>
          )}
        </div>
      </div>
      {error && (
        <div className="text-[11.5px] text-destructive font-inter pl-2">{error}</div>
      )}
      {!error && submittable && isDirty && !loading && (
        <div className="text-[11px] text-text-tertiary font-inter pl-2">
          Press <kbd className="px-1 py-0.5 bg-[#F1F0EC] rounded font-mono">Enter</kbd> to run
          {mode === 'boolean' ? ' · ' : ' · '}
          <kbd className="px-1 py-0.5 bg-[#F1F0EC] rounded font-mono">Esc</kbd> to clear
        </div>
      )}
    </div>
  )
}
