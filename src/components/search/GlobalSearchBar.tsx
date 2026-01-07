import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
import { useGlobalSearch, type SearchResult } from '@/hooks/useGlobalSearch'
import { SearchDropdown } from './SearchDropdown'
import { SearchResultsDialog } from './SearchResultsDialog'

export function GlobalSearchBar() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  
  const [query, setQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  
  const { results, isLoading, totalCounts } = useGlobalSearch(query, { limit: 5 })

  // Global keyboard shortcut (Cmd+/ or Ctrl+/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [results])

  // Handle keyboard navigation in dropdown
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (query) {
        setQuery('')
      } else {
        inputRef.current?.blur()
      }
      setIsDropdownOpen(false)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        // Navigate to highlighted result
        const result = results[highlightedIndex]
        navigate(result.route)
        setQuery('')
        setIsDropdownOpen(false)
      } else if (query.length >= 2) {
        // Open full results dialog
        setIsDialogOpen(true)
        setIsDropdownOpen(false)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => 
        prev < results.length - 1 ? prev + 1 : prev
      )
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1)
      return
    }
  }, [query, results, highlightedIndex, navigate])

  const handleResultClick = (result: SearchResult) => {
    navigate(result.route)
    setQuery('')
    setIsDropdownOpen(false)
  }

  const handleFocus = () => {
    if (query.length >= 2) {
      setIsDropdownOpen(true)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setIsDropdownOpen(value.length >= 2)
  }

  return (
    <>
      <Popover open={isDropdownOpen}>
        <PopoverAnchor asChild>
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-virgilio-muted pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              placeholder="Search for anything..."
              className={cn(
                "h-9 w-[200px] rounded-lg border border-virgilio-border bg-surface-primary pl-9 pr-12 text-sm font-poppins",
                "placeholder:text-virgilio-muted transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-virgilio-purple focus:border-virgilio-purple focus:w-[280px]",
                "hover:border-virgilio-purple/50"
              )}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-virgilio-muted pointer-events-none">
              <kbd className="px-1.5 py-0.5 bg-virgilio-border/50 rounded font-mono">⌘</kbd>
              <kbd className="px-1 py-0.5 bg-virgilio-border/50 rounded font-mono">/</kbd>
            </div>
          </div>
        </PopoverAnchor>
        
        <PopoverContent 
          className="w-[400px] p-0 shadow-elevated border-virgilio-border"
          align="start"
          sideOffset={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <SearchDropdown
            results={results}
            isLoading={isLoading}
            query={query}
            totalCounts={totalCounts}
            highlightedIndex={highlightedIndex}
            onResultClick={handleResultClick}
            onClose={() => setIsDropdownOpen(false)}
          />
        </PopoverContent>
      </Popover>

      {/* Mobile Search Button */}
      <button
        onClick={() => setIsDialogOpen(true)}
        className="md:hidden h-9 w-9 rounded-lg border border-virgilio-border bg-surface-primary flex items-center justify-center hover:bg-virgilio-purple/5 transition-colors"
      >
        <Search className="h-4 w-4 text-virgilio-muted" />
      </button>

      {/* Full Results Dialog */}
      <SearchResultsDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialQuery={query}
      />
    </>
  )
}
