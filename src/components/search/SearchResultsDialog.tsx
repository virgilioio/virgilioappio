import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Briefcase, Users, Target } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useGlobalSearch, type SearchResult } from '@/hooks/useGlobalSearch'
import { SearchResultRow } from './SearchResultRow'
import { SearchResultsSkeleton } from './SearchResultsSkeleton'

interface SearchResultsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialQuery: string
}

type TabType = 'all' | 'jobs' | 'candidates' | 'sourcing_projects'

export function SearchResultsDialog({ open, onOpenChange, initialQuery }: SearchResultsDialogProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<TabType>('all')
  
  // Use unlimited results for dialog
  const { results, isLoading, totalCounts } = useGlobalSearch(query, { limit: 50 })

  // Sync initial query when dialog opens
  useEffect(() => {
    if (open) {
      setQuery(initialQuery)
    }
  }, [open, initialQuery])

  const handleResultClick = (result: SearchResult) => {
    navigate(result.route)
    onOpenChange(false)
  }

  // Filter results by active tab
  const filteredResults = activeTab === 'all' 
    ? results 
    : results.filter(r => r.type === activeTab.replace('s', '') || r.type === activeTab.slice(0, -1) || 
        (activeTab === 'jobs' && r.type === 'job') ||
        (activeTab === 'candidates' && r.type === 'candidate') ||
        (activeTab === 'sourcing_projects' && r.type === 'sourcing_project'))

  const tabs: { id: TabType; label: string; count: number; icon: React.ElementType }[] = [
    { id: 'all', label: 'All', count: totalCounts.jobs + totalCounts.candidates + totalCounts.sourcing_projects, icon: Search },
    { id: 'jobs', label: 'Jobs', count: totalCounts.jobs, icon: Briefcase },
    { id: 'candidates', label: 'Candidates', count: totalCounts.candidates, icon: Users },
    { id: 'sourcing_projects', label: 'Projects', count: totalCounts.sourcing_projects, icon: Target },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Search Results</DialogTitle>
        
        {/* Search Input */}
        <div className="p-4 border-b border-virgilio-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-virgilio-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for anything..."
              className="pl-10 pr-10 h-11"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-virgilio-muted hover:text-virgilio-text transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-virgilio-border bg-surface-secondary/30">
          {tabs.map(tab => (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "font-poppins text-xs gap-1.5 h-8",
                activeTab === tab.id
                  ? "bg-virgilio-purple text-white hover:bg-virgilio-purple/90"
                  : "text-virgilio-muted hover:text-virgilio-text hover:bg-virgilio-purple/5"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id
                    ? "bg-white/20"
                    : "bg-virgilio-border"
                )}>
                  {tab.count}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4">
              <SearchResultsSkeleton count={5} />
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="p-8 text-center">
              <Search className="h-12 w-12 text-virgilio-border mx-auto mb-3" />
              <p className="text-sm text-virgilio-muted font-poppins">
                {query.length < 2 
                  ? "Type at least 2 characters to search" 
                  : `No results found for "${query}"`}
              </p>
            </div>
          ) : (
            <div className="p-2">
              {filteredResults.map((result) => (
                <SearchResultRow
                  key={result.id}
                  result={result}
                  onClick={() => handleResultClick(result)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-virgilio-border bg-surface-secondary/30">
          <div className="flex items-center justify-between text-xs text-virgilio-muted">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-virgilio-border rounded text-[10px] font-mono">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-virgilio-border rounded text-[10px] font-mono">Enter</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-virgilio-border rounded text-[10px] font-mono">Esc</kbd>
                Close
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
