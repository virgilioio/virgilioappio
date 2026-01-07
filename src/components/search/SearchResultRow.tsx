import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SearchResult } from '@/hooks/useGlobalSearch'

interface SearchResultRowProps {
  result: SearchResult
  onClick: () => void
  isHighlighted?: boolean
}

export function SearchResultRow({ result, onClick, isHighlighted }: SearchResultRowProps) {
  const Icon = result.icon

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-md transition-all duration-150 group",
        isHighlighted
          ? "bg-virgilio-purple/10 text-virgilio-text"
          : "hover:bg-virgilio-purple/5 text-virgilio-text"
      )}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-virgilio-purple/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-virgilio-purple" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-poppins font-medium text-sm truncate">
          {result.title}
        </div>
        <div className="text-xs text-virgilio-muted truncate">
          {result.subtitle}
        </div>
        <div className="text-xs text-text-tertiary truncate">
          {result.metadata}
        </div>
      </div>

      <ChevronRight 
        className={cn(
          "h-4 w-4 text-virgilio-muted flex-shrink-0 transition-transform duration-150",
          isHighlighted ? "translate-x-0.5" : "group-hover:translate-x-0.5"
        )} 
      />
    </button>
  )
}
