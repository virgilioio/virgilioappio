import { Search, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SearchMode } from './SearchModeTabs'

interface CandidateSearchBarProps {
  value: string
  onChange: (v: string) => void
  mode: SearchMode
  onSubmit?: () => void
  loading?: boolean
  error?: string | null
}

const PLACEHOLDERS: Record<SearchMode, string> = {
  everything: 'Search by name, email, skill, company…',
  boolean: 'e.g. Figma AND ("design systems" OR tokens) NOT junior',
  ai: 'Try: senior product designers in NYC who know Figma',
}

export function CandidateSearchBar({ value, onChange, mode, onSubmit, loading, error }: CandidateSearchBarProps) {
  const Icon = mode === 'ai' ? Sparkles : Search
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
          onKeyDown={(e) => { if (e.key === 'Enter' && onSubmit) { e.preventDefault(); onSubmit() } }}
          placeholder={PLACEHOLDERS[mode]}
          className="flex-1 h-full pl-11 pr-24 bg-transparent outline-none text-[13.5px] font-inter text-text-primary placeholder:text-text-tertiary"
        />
        <div className="absolute right-3 flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-virgilio-purple" />}
          {mode === 'ai' ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={loading || !value.trim()}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11.5px] font-poppins font-medium bg-virgilio-purple text-white hover:bg-virgilio-purple/90 disabled:opacity-40"
            >
              Ask
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
    </div>
  )
}
