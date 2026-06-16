import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
import { GlobalSearchPanel } from './v2/GlobalSearchPanel'
import { SearchResultsDialog } from './SearchResultsDialog'

interface GlobalSearchBarProps {
  collapsible?: boolean
}

export function GlobalSearchBar({ collapsible = false }: GlobalSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [expanded, setExpanded] = useState(!collapsible)

  // Cmd+K (and legacy Cmd+/) shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === '/')) {
        e.preventDefault()
        setExpanded(true)
        // Defer focus until input renders
        requestAnimationFrame(() => {
          inputRef.current?.focus()
          setIsOpen(true)
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Collapse on outside click when empty
  useEffect(() => {
    if (!collapsible || !expanded) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (wrapperRef.current?.contains(target)) return
      // Ignore clicks inside the popover content
      const popoverContent = document.querySelector('[data-radix-popper-content-wrapper]')
      if (popoverContent?.contains(target)) return
      if (!query) {
        setExpanded(false)
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [collapsible, expanded, query])

  const handleOpenCandidate = useCallback((id: string) => {
    setIsOpen(false)
    navigate(`/candidates/${id}`)
  }, [navigate])

  const handleExpand = () => {
    setExpanded(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      setIsOpen(true)
    })
  }

  const handleCollapse = () => {
    setQuery('')
    setIsOpen(false)
    setExpanded(false)
  }

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverAnchor asChild>
          <div
            ref={wrapperRef}
            className={cn(
              'relative hidden md:flex items-center justify-end',
              collapsible ? 'h-8 w-8' : '',
            )}
          >
            {collapsible && (
              <button
                type="button"
                onClick={expanded ? handleCollapse : handleExpand}
                aria-label={expanded ? 'Close search' : 'Search'}
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/40',
                  expanded && 'relative z-[1]',
                )}
              >
                {expanded ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              </button>
            )}
            {(!collapsible || expanded) && (
              <div
                className={cn(
                  collapsible
                    ? 'absolute right-9 top-1/2 -translate-y-1/2 z-[1]'
                    : 'relative',
                )}
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-virgilio-muted pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
                  onFocus={() => setIsOpen(true)}
                  placeholder="Search candidates, jobs, companies…"
                  className={cn(
                    'h-9 rounded-lg border border-virgilio-border pl-9 text-sm font-poppins',
                    'placeholder:text-virgilio-muted transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-virgilio-purple/30 focus:border-virgilio-purple/50',
                    'hover:border-virgilio-purple/40',
                    collapsible
                      ? 'w-[320px] pr-3 bg-[#0d0d09] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]'
                      : 'w-[320px] focus:w-[420px] pr-12 bg-surface-primary',
                  )}
                />
                {!collapsible && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-virgilio-muted pointer-events-none">
                    <kbd className="px-1.5 py-0.5 bg-virgilio-border/50 rounded font-mono">⌘</kbd>
                    <kbd className="px-1 py-0.5 bg-virgilio-border/50 rounded font-mono">K</kbd>
                  </div>
                )}
              </div>
            )}
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
