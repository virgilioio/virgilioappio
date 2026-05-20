import { Search, Code2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SearchMode = 'everything' | 'boolean' | 'ai'

interface SearchModeTabsProps {
  value: SearchMode
  onChange: (mode: SearchMode) => void
}

const TABS: { value: SearchMode; label: string; icon: typeof Search }[] = [
  { value: 'everything', label: 'Everything', icon: Search },
  { value: 'boolean', label: 'Boolean', icon: Code2 },
  { value: 'ai', label: 'Ask in plain English', icon: Sparkles },
]

export function SearchModeTabs({ value, onChange }: SearchModeTabsProps) {
  return (
    <div className="inline-flex items-center gap-1">
      {TABS.map(t => {
        const active = value === t.value
        const Icon = t.icon
        const isAi = t.value === 'ai'
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg font-poppins text-[13.5px] tracking-[-0.01em] transition-colors',
              active
                ? 'bg-[#FAFAF7] text-text-primary font-semibold'
                : 'text-text-tertiary hover:text-text-primary font-medium',
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', active && isAi && 'text-virgilio-purple')} />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
