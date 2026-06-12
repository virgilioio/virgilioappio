import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
import { GlobalSearchPanel } from './v2/GlobalSearchPanel'
import { SearchResultsDialog } from './SearchResultsDialog'

export function GlobalSearchBar() {
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Cmd+K (and legacy Cmd+/) shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === '/')) {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleOpenCandidate = useCallback((id: string) => {
    setIsOpen(false)
    navigate(`/candidates/${id}`)
  }, [navigate])

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverAnchor asChild>
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-virgilio-muted pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
              onFocus={() => setIsOpen(true)}
              placeholder="Search candidates, jobs, companies…"
              className={cn(
                'h-9 w-[320px] rounded-lg border border-virgilio-border bg-surface-primary pl-9 pr-12 text-sm font-poppins',
                'placeholder:text-virgilio-muted transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-virgilio-purple/30 focus:border-virgilio-purple/50 focus:w-[420px]',
                'hover:border-virgilio-purple/40'
              )}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-virgilio-muted pointer-events-none">
              <kbd className="px-1.5 py-0.5 bg-virgilio-border/50 rounded font-mono">⌘</kbd>
              <kbd className="px-1 py-0.5 bg-virgilio-border/50 rounded font-mono">K</kbd>
            </div>
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          sideOffset={10}
          className="p-0 border-0 bg-transparent shadow-none w-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <GlobalSearchPanel
            query={query}
            onQueryChange={(q) => { setQuery(q); inputRef.current?.focus() }}
            onClose={() => setIsOpen(false)}
            onOpenCandidate={handleOpenCandidate}
          />
        </PopoverContent>
      </Popover>

      {/* Mobile fallback */}
      <button
        onClick={() => setIsDialogOpen(true)}
        className="md:hidden h-9 w-9 rounded-lg border border-virgilio-border bg-surface-primary flex items-center justify-center hover:bg-virgilio-purple/5 transition-colors"
        aria-label="Search"
      >
        <Search className="h-4 w-4 text-virgilio-muted" />
      </button>

      <SearchResultsDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialQuery={query}
      />
    </>
  )
}
