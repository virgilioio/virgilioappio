import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useJobs } from '@/hooks/useJobs'
import { usePipelineJobMetrics } from '@/hooks/usePipelineJobMetrics'
import { PhoneCard, PhoneEmpty, PhonePage, PhoneRow, PhoneSkeletonRows, PhoneTitle, Pill } from './PhoneUI'
import { cn } from '@/lib/utils'

/**
 * Jobs on a phone (2026-10-12): open, draft and closed jobs at a glance,
 * with how many people are active in each. Creating and editing jobs stays
 * on the computer.
 */
type Scope = 'open' | 'draft' | 'closed'

export default function PhoneJobs() {
  const { jobs, isLoading } = useJobs()
  const [scope, setScope] = useState<Scope>('open')
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim().toLowerCase()), 150)
    return () => clearTimeout(t)
  }, [query])

  const all = useMemo(() => jobs ?? [], [jobs])
  const counts = useMemo(() => ({
    open: all.filter(j => j.status === 'open').length,
    draft: all.filter(j => j.status === 'draft').length,
    closed: all.filter(j => j.status === 'closed' || j.status === 'archived').length,
  }), [all])
  const list = useMemo(() => all
    .filter(j => (scope === 'closed' ? j.status === 'closed' || j.status === 'archived' : j.status === scope))
    .filter(j => !term || [j.title, j.organization_name, j.location].some(v => (v ?? '').toLowerCase().includes(term)))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')), [all, scope, term])
  const { data: metrics } = usePipelineJobMetrics(list.filter(j => j.status === 'open').map(j => j.id))
  const active = useMemo(() => new Map((metrics ?? []).map(m => [m.job_id, m.active_candidates])), [metrics])

  return (
    <PhonePage>
      <PhoneTitle eyebrow="ATS" title="Jobs" sub={isLoading ? 'Loading…' : `${counts.open} open · ${counts.draft} ${counts.draft === 1 ? 'draft' : 'drafts'} · ${counts.closed} closed`} />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7080]" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          type="search"
          placeholder="Title, company, location…"
          aria-label="Search jobs"
          className="gio-field h-11 w-full rounded-[12px] border border-[#E7E8EE] bg-white pl-10 pr-10 font-inter text-[16px] text-[#0d0d09] placeholder:text-[#6B7080]"
        />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="gio-search-clear absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#5A6072]">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Which jobs" className="mb-4 grid grid-cols-3 gap-1 rounded-[12px] bg-[#EDEAE2] p-1">
        {(['open', 'draft', 'closed'] as const).map(id => (
          <button
            key={id}
            role="tab"
            aria-selected={scope === id}
            onClick={() => setScope(id)}
            className={cn(
              'gio-pressable h-9 rounded-[9px] font-poppins text-[13px] transition-colors duration-150',
              scope === id ? 'bg-white font-semibold text-[#0d0d09] shadow-[0_1px_2px_rgba(13,13,9,0.06)]' : 'font-medium text-[#5A6072]',
            )}
          >
            {id === 'open' ? 'Open' : id === 'draft' ? 'Drafts' : 'Closed'} <span className="tabular-nums opacity-70">{counts[id]}</span>
          </button>
        ))}
      </div>

      <PhoneCard>
        {isLoading ? <PhoneSkeletonRows rows={4} /> : list.length === 0 ? (
          <PhoneEmpty>{term ? `No jobs match “${query.trim()}”.` : scope === 'open' ? 'No open jobs.' : scope === 'draft' ? 'No drafts.' : 'No closed jobs.'}</PhoneEmpty>
        ) : list.map(j => (
          <PhoneRow
            key={j.id}
            to={`/jobs/${j.id}`}
            title={j.title}
            meta={[j.organization_name, j.location].filter(Boolean).join(' · ') || undefined}
            trailing={j.status === 'open'
              ? <Pill tone="purple">{active.get(j.id) ?? 0} active</Pill>
              : <Pill>{j.status === 'draft' ? 'Draft' : 'Closed'}</Pill>}
          />
        ))}
      </PhoneCard>
    </PhonePage>
  )
}
