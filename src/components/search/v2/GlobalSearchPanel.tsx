import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Briefcase, Users, Bookmark, Clock, Plus,
  Sparkles, ArrowRight, CornerDownLeft, ArrowUp, ArrowDown,
  Building2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useGlobalSearch } from '@/hooks/useGlobalSearch'
import { useRecentSearches } from './useRecentSearches'
import { SearchResultRowV2, GlyphKind } from './SearchResultRowV2'
import { highlight } from './highlight'

type Scope = 'all' | 'candidates' | 'jobs' | 'saved'

interface SavedViewLite { id: string; name: string }

interface FlatRow {
  key: string
  glyph: GlyphKind
  initials?: string
  icon?: React.ComponentType<{ className?: string }>
  title: string
  sub?: React.ReactNode
  rightMeta?: React.ReactNode
  onSelect: () => void
}

interface GlobalSearchPanelProps {
  query: string
  onQueryChange: (q: string) => void
  onClose: () => void
  onOpenCandidate: (id: string) => void
}

const SCOPES: { id: Scope; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all',        label: 'All',        icon: Search },
  { id: 'candidates', label: 'Candidates', icon: Users },
  { id: 'jobs',       label: 'Jobs',       icon: Briefcase },
  { id: 'saved',      label: 'Saved',      icon: Bookmark },
]

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function GlobalSearchPanel({
  query, onQueryChange, onClose, onOpenCandidate,
}: GlobalSearchPanelProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [scope, setScope] = useState<Scope>('all')
  const [askMode, setAskMode] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const trimmed = query.trim()
  const hasQuery = trimmed.length >= 2

  const { results, isLoading, totalCounts } = useGlobalSearch(hasQuery && !askMode ? query : '', { limit: 5 })
  const recent = useRecentSearches(user?.id ?? null)

  // Saved views (candidates context — most used)
  const { data: savedViews = [] } = useQuery({
    queryKey: ['global-search-saved-views', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<SavedViewLite[]> => {
      if (!user) return []
      const { data } = await (supabase as any)
        .from('saved_views')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('page_context', 'candidates')
        .order('updated_at', { ascending: false })
        .limit(20)
      return (data ?? []) as SavedViewLite[]
    },
  })

  // Ask Gio results
  const [askResult, setAskResult] = useState<null | {
    skills: string[]; cities: string[]; countries: string[]; seniorityLevels: string[]; stages: string[]; statuses: string[]; query: string
  }>(null)
  const [askLoading, setAskLoading] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)

  useEffect(() => {
    if (!askMode || !hasQuery) { setAskResult(null); return }
    let cancelled = false
    setAskLoading(true)
    setAskError(null)
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('candidates-nl-search', {
          body: { prompt: trimmed, options: {} },
        })
        if (cancelled) return
        if (error) throw error
        setAskResult(data)
      } catch (e: any) {
        if (!cancelled) setAskError(e?.message || 'Ask Gio failed')
      } finally {
        if (!cancelled) setAskLoading(false)
      }
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [askMode, trimmed, hasQuery])

  // Filter results by scope
  const filteredResults = useMemo(() => {
    if (scope === 'all') return results
    if (scope === 'candidates') return results.filter(r => r.type === 'candidate')
    if (scope === 'jobs') return results.filter(r => r.type === 'job')
    return []
  }, [results, scope])

  const filteredSaved = useMemo(() => {
    if (!hasQuery) return savedViews.slice(0, 5)
    const q = trimmed.toLowerCase()
    return savedViews.filter(v => v.name.toLowerCase().includes(q)).slice(0, 5)
  }, [savedViews, hasQuery, trimmed])

  // Build the flat row list for keyboard nav
  const rows: FlatRow[] = useMemo(() => {
    const r: FlatRow[] = []
    const commit = (q: string, s: Scope) => recent.push(q, s)

    // Ask Gio mode
    if (askMode) {
      if (askResult) {
        r.push({
          key: 'ask-open',
          glyph: 'ai',
          icon: Sparkles,
          title: `Open in Candidates`,
          sub: 'Apply Gio\u2019s interpretation',
          rightMeta: <CornerDownLeft className="h-3 w-3" />,
          onSelect: () => { commit(trimmed, 'candidates'); navigate('/candidates'); onClose() },
        })
      }
      return r
    }

    // Empty state: recents + jump-to + commands
    if (!hasQuery) {
      for (const it of recent.items) {
        r.push({
          key: `recent-${it.ts}`,
          glyph: 'recent',
          icon: Clock,
          title: it.query,
          sub: `in ${it.scope}`,
          rightMeta: <span>{new Date(it.ts).toLocaleDateString()}</span>,
          onSelect: () => { onQueryChange(it.query); setScope(it.scope as Scope) },
        })
      }
      for (const v of savedViews.slice(0, 4)) {
        r.push({
          key: `saved-${v.id}`,
          glyph: 'saved',
          icon: Bookmark,
          title: v.name,
          sub: 'Saved search',
          rightMeta: <span>Searches</span>,
          onSelect: () => { navigate('/candidates'); onClose() },
        })
      }
      // Commands
      r.push({
        key: 'cmd-add-candidate', glyph: 'command', icon: Plus,
        title: 'Add candidate',
        rightMeta: <span className="font-mono">\u2318N</span>,
        onSelect: () => { navigate('/candidates?new=1'); onClose() },
      })
      r.push({
        key: 'cmd-create-job', glyph: 'command', icon: Plus,
        title: 'Create job',
        rightMeta: <span className="font-mono">\u2318J</span>,
        onSelect: () => { navigate('/jobs?new=1'); onClose() },
      })
      return r
    }

    // Results mode
    if (scope === 'all' || scope === 'candidates') {
      const cands = results.filter(r => r.type === 'candidate')
      for (const c of cands) {
        r.push({
          key: `cand-${c.id}`,
          glyph: 'avatar',
          initials: initialsOf(c.title),
          title: c.title,
          sub: c.subtitle,
          rightMeta: c.metadata ? <span className="truncate max-w-[120px]">{c.metadata}</span> : undefined,
          onSelect: () => { commit(trimmed, 'candidates'); onOpenCandidate(c.id); onClose() },
        })
      }
    }
    if (scope === 'all' || scope === 'jobs') {
      const jobs = results.filter(r => r.type === 'job')
      for (const j of jobs) {
        r.push({
          key: `job-${j.id}`,
          glyph: 'job',
          icon: Briefcase,
          title: j.title,
          sub: j.subtitle,
          rightMeta: <span>Jobs</span>,
          onSelect: () => { commit(trimmed, 'jobs'); navigate(j.route); onClose() },
        })
      }
    }
    if (scope === 'all' || scope === 'saved') {
      for (const v of filteredSaved) {
        r.push({
          key: `sv-${v.id}`,
          glyph: 'saved',
          icon: Bookmark,
          title: v.name,
          sub: 'Saved search',
          rightMeta: <span>Searches</span>,
          onSelect: () => { commit(trimmed, 'saved'); navigate('/candidates'); onClose() },
        })
      }
    }

    // No results recovery
    if (r.length === 0 && hasQuery && !isLoading) {
      r.push({
        key: 'no-ask',
        glyph: 'ai',
        icon: Sparkles,
        title: `Ask Gio: \u201Cfind ${trimmed}\u201D`,
        onSelect: () => { setAskMode(true) },
      })
      r.push({
        key: 'no-add',
        glyph: 'command',
        icon: Plus,
        title: `Add \u201C${trimmed}\u201D as a new candidate`,
        onSelect: () => { navigate('/candidates?new=1'); onClose() },
      })
    }
    return r
  }, [askMode, askResult, hasQuery, recent, savedViews, results, scope, filteredSaved, trimmed, isLoading, navigate, onClose, onOpenCandidate, onQueryChange])

  useEffect(() => { setHighlighted(0) }, [rows.length, scope, askMode])

  // Keyboard handling
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(p => Math.min(rows.length - 1, p + 1)); return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(p => Math.max(0, p - 1)); return }
    if (e.key === 'Tab') {
      e.preventDefault()
      const idx = SCOPES.findIndex(s => s.id === scope)
      const next = SCOPES[(idx + (e.shiftKey ? -1 : 1) + SCOPES.length) % SCOPES.length]
      setScope(next.id)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[highlighted]
      if (row) row.onSelect()
      return
    }
  }, [rows, highlighted, scope, onClose])

  // Top "See all N results" banner when mixed and has query
  const totalAll = totalCounts.jobs + totalCounts.candidates
  const showSeeAll = hasQuery && !askMode && scope === 'all' && totalAll > 0

  return (
    <div
      role="listbox"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      className="w-[600px] max-h-[560px] flex flex-col rounded-[12px] border border-border bg-popover text-popover-foreground shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18)] overflow-hidden"
    >
      {/* Scope chip bar */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-2 border-b border-border">
        {SCOPES.map(s => {
          const Icon = s.icon
          const active = !askMode && scope === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => { setAskMode(false); setScope(s.id) }}
              className={cn(
                'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md font-poppins font-medium text-[12px] tracking-[-0.005em] transition-colors',
                active
                  ? 'bg-[#0d0d09] text-[#FFFCF9]'
                  : 'text-virgilio-muted hover:text-foreground hover:bg-[#F1F0EC]'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setAskMode(v => !v)}
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md font-poppins font-medium text-[12px] tracking-[-0.005em] transition-colors',
            askMode
              ? 'bg-violet-100 text-violet-700'
              : 'text-violet-600 hover:bg-violet-50'
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ask Gio
        </button>
      </div>

      {/* See-all banner */}
      {showSeeAll && (
        <button
          type="button"
          onClick={() => { /* could open dialog; for now do nothing */ }}
          className="flex items-center gap-2 px-4 py-2 text-[12px] font-inter text-foreground hover:bg-[#FAFAF7] border-b border-border"
        >
          <Search className="h-3.5 w-3.5 text-virgilio-muted" />
          See all <strong className="font-semibold">{totalAll}</strong> results for
          <span className="font-medium">\u201C{trimmed}\u201D</span>
          <ArrowRight className="h-3 w-3 ml-auto text-virgilio-muted" />
        </button>
      )}

      {/* Ask Gio interpretation chips */}
      {askMode && hasQuery && (
        <div className="px-4 py-3 border-b border-border bg-violet-50/40">
          <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.06em] font-inter font-semibold text-violet-700 mb-2">
            <Sparkles className="h-3 w-3" />
            {askLoading ? 'Gio is thinking\u2026' : askError ? 'Couldn\u2019t parse' : 'Gio understood'}
          </div>
          {askError && (
            <p className="text-[12px] font-inter text-destructive">{askError}</p>
          )}
          {askResult && (
            <div className="flex flex-wrap gap-1.5">
              {[
                ...askResult.seniorityLevels.map(v => ({ k: 'Role', v })),
                ...askResult.cities.map(v => ({ k: 'City', v })),
                ...askResult.countries.map(v => ({ k: 'Country', v })),
                ...askResult.skills.map(v => ({ k: 'Skill', v })),
                ...askResult.stages.map(v => ({ k: 'Stage', v })),
                ...askResult.statuses.map(v => ({ k: 'Status', v })),
              ].slice(0, 8).map((chip, i) => (
                <span key={i} className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-white border border-violet-200 text-[11.5px] font-inter text-violet-700">
                  <span className="text-violet-500">{chip.k}</span>
                  <span className="font-medium">{chip.v}</span>
                </span>
              ))}
              {askResult.query && (
                <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-white border border-violet-200 text-[11.5px] font-inter text-violet-700">
                  <span className="text-violet-500">Text</span>
                  <span className="font-medium">{askResult.query}</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {/* Group label when empty state */}
        {!hasQuery && !askMode && recent.items.length > 0 && (
          <GroupLabel
            label="Recent"
            right={<button onClick={recent.clear} className="text-[10px] font-inter font-medium text-virgilio-muted hover:text-foreground">Clear all</button>}
          />
        )}
        {!hasQuery && !askMode && savedViews.length > 0 && recent.items.length > 0 && (
          <div className="h-1" />
        )}
        {!hasQuery && !askMode && savedViews.length > 0 && (
          <GroupLabel label="Jump to" />
        )}

        {/* Render rows */}
        {rows.length === 0 && !isLoading && (
          <div className="px-4 py-12 text-center">
            {hasQuery ? (
              <>
                <p className="font-poppins font-semibold text-[14px] text-foreground">No results for \u201C{trimmed}\u201D</p>
                <p className="font-inter text-[12px] text-virgilio-muted mt-1">
                  Check spelling, broaden your scope, or ask Gio in plain English.
                </p>
              </>
            ) : (
              <p className="font-inter text-[12px] text-virgilio-muted">
                Start typing to search candidates, jobs, and saved searches.
              </p>
            )}
          </div>
        )}

        {rows.map((row, i) => (
          <SearchResultRowV2
            key={row.key}
            glyph={row.glyph}
            initials={row.initials}
            icon={row.icon}
            title={row.title}
            sub={row.sub}
            rightMeta={row.rightMeta}
            query={hasQuery && !askMode ? trimmed : ''}
            selected={i === highlighted}
            onClick={row.onSelect}
            onMouseEnter={() => setHighlighted(i)}
          />
        ))}

        {isLoading && !askMode && (
          <div className="px-4 py-3 text-[12px] font-inter text-virgilio-muted">Searching\u2026</div>
        )}
      </div>

      {/* Keyboard footer */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border bg-[#FAFAF7] text-[10.5px] font-inter text-virgilio-muted">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Kbd><ArrowUp className="h-2.5 w-2.5" /></Kbd>
            <Kbd><ArrowDown className="h-2.5 w-2.5" /></Kbd>
            navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd><CornerDownLeft className="h-2.5 w-2.5" /></Kbd>
            open
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>Tab</Kbd>
            scope
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>esc</Kbd>
            close
          </span>
        </div>
        <span className="inline-flex items-center gap-1">
          Powered by <span className="font-semibold text-foreground">Gio</span>
        </span>
      </div>
    </div>
  )
}

function GroupLabel({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2 pt-2 pb-1">
      <span className="font-inter font-semibold uppercase text-[10px] tracking-[0.06em] text-[#8B8F9E]">
        {label}
      </span>
      {right}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded bg-white border border-border font-mono text-[9.5px] text-virgilio-muted">
      {children}
    </kbd>
  )
}
