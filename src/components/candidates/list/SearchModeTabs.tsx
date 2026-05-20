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
    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#F5F4EF]">
      {TABS.map(t => {
        const active = value === t.value
        const Icon = t.icon
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              'inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-[12px] font-poppins font-medium transition-all',
              active ? 'bg-white text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-primary',
              t.value === 'ai' && active && 'text-virgilio-purple',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
