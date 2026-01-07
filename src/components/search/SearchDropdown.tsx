import { useNavigate } from 'react-router-dom'
import { Briefcase, Users, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SearchResultRow } from './SearchResultRow'
import { SearchResultsSkeleton } from './SearchResultsSkeleton'
import type { SearchResult } from '@/hooks/useGlobalSearch'

interface SearchDropdownProps {
  results: SearchResult[]
  isLoading: boolean
  query: string
  totalCounts: {
    jobs: number
    candidates: number
    sourcing_projects: number
  }
  highlightedIndex: number
  onResultClick: (result: SearchResult) => void
  onClose: () => void
}

export function SearchDropdown({
  results,
  isLoading,
  query,
  totalCounts,
  highlightedIndex,
  onResultClick,
  onClose
}: SearchDropdownProps) {
  const navigate = useNavigate()

  // Group results by type
  const jobResults = results.filter(r => r.type === 'job')
  const candidateResults = results.filter(r => r.type === 'candidate')
  const sourcingResults = results.filter(r => r.type === 'sourcing_project')

  const totalResults = totalCounts.jobs + totalCounts.candidates + totalCounts.sourcing_projects

  // Calculate which result is highlighted
  let currentIndex = 0
  const getIsHighlighted = (localIndex: number, type: 'job' | 'candidate' | 'sourcing_project') => {
    let offset = 0
    if (type === 'candidate') offset = jobResults.length
    if (type === 'sourcing_project') offset = jobResults.length + candidateResults.length
    return highlightedIndex === offset + localIndex
  }

  if (isLoading) {
    return (
      <div className="p-2">
        <SearchResultsSkeleton count={3} />
      </div>
    )
  }

  if (results.length === 0 && query.length >= 2) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-virgilio-muted font-poppins">
          No results found for "{query}"
        </p>
      </div>
    )
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      {/* Jobs Section */}
      {jobResults.length > 0 && (
        <div className="p-2">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Briefcase className="h-3.5 w-3.5 text-virgilio-muted" />
            <span className="text-xs font-poppins font-semibold text-virgilio-muted uppercase tracking-wide">
              Jobs
            </span>
            {totalCounts.jobs > jobResults.length && (
              <span className="text-xs text-virgilio-muted">
                ({totalCounts.jobs} total)
              </span>
            )}
          </div>
          {jobResults.map((result, i) => (
            <SearchResultRow
              key={result.id}
              result={result}
              onClick={() => onResultClick(result)}
              isHighlighted={getIsHighlighted(i, 'job')}
            />
          ))}
        </div>
      )}

      {/* Candidates Section */}
      {candidateResults.length > 0 && (
        <div className="p-2 border-t border-virgilio-border">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Users className="h-3.5 w-3.5 text-virgilio-muted" />
            <span className="text-xs font-poppins font-semibold text-virgilio-muted uppercase tracking-wide">
              Candidates
            </span>
            {totalCounts.candidates > candidateResults.length && (
              <span className="text-xs text-virgilio-muted">
                ({totalCounts.candidates} total)
              </span>
            )}
          </div>
          {candidateResults.map((result, i) => (
            <SearchResultRow
              key={result.id}
              result={result}
              onClick={() => onResultClick(result)}
              isHighlighted={getIsHighlighted(i, 'candidate')}
            />
          ))}
        </div>
      )}

      {/* Sourcing Projects Section */}
      {sourcingResults.length > 0 && (
        <div className="p-2 border-t border-virgilio-border">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Target className="h-3.5 w-3.5 text-virgilio-muted" />
            <span className="text-xs font-poppins font-semibold text-virgilio-muted uppercase tracking-wide">
              Sourcing Projects
            </span>
            {totalCounts.sourcing_projects > sourcingResults.length && (
              <span className="text-xs text-virgilio-muted">
                ({totalCounts.sourcing_projects} total)
              </span>
            )}
          </div>
          {sourcingResults.map((result, i) => (
            <SearchResultRow
              key={result.id}
              result={result}
              onClick={() => onResultClick(result)}
              isHighlighted={getIsHighlighted(i, 'sourcing_project')}
            />
          ))}
        </div>
      )}

      {/* Footer hint */}
      {totalResults > 0 && (
        <div className="p-3 border-t border-virgilio-border bg-surface-secondary/50">
          <p className="text-xs text-virgilio-muted text-center font-poppins">
            Press <kbd className="px-1.5 py-0.5 bg-virgilio-border rounded text-[10px] font-mono">Enter</kbd> to see all {totalResults} results
          </p>
        </div>
      )}
    </div>
  )
}
