import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useIndependentCandidates } from '@/hooks/useIndependentCandidates'
import { useCandidateJobAssociationsMap } from '@/hooks/useCandidateJobAssociations'
import { Initials, PhoneCard, PhoneEmpty, PhonePage, PhoneRow, PhoneSkeletonRows, PhoneTitle, Pill } from './PhoneUI'
import { LoadError } from '@/components/empty/LoadError'
import { cn } from '@/lib/utils'

/**
 * Candidates on a phone (2026-10-12): search and a list at a glance — who,
 * their role, and where they are in your pipelines. Tapping someone opens
 * their glance. Filters, bulk actions and saved views stay on the computer.
 */

const PAGE = 40
const ACTIVE = new Set(['active', 'offer'])

export default function PhoneCandidates() {
  const { candidates, isLoading, error, getCandidates } = useIndependentCandidates()
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [scope, setScope] = useState<'pipeline' | 'all'>('pipeline')
  const [shown, setShown] = useState(PAGE)

  // §12: results wait 150ms after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim().toLowerCase()), 150)
    return () => clearTimeout(t)
  }, [query])
  useEffect(() => { setShown(PAGE) }, [term, scope])

  const ids = useMemo(() => candidates.map(c => c.id), [candidates])
  const { associationsMap, isLoading: assocLoading } = useCandidateJobAssociationsMap(ids)

  const activeOf = (id: string) => (associationsMap.get(id) ?? []).filter(a => ACTIVE.has(a.pipelineStatus ?? ''))

  const list = useMemo(() => {
    const rows = candidates.filter(c => {
      if (scope === 'pipeline' && activeOf(c.id).length === 0) return false
      if (!term) return true
      return [c.candidate_name, c.current_job_title, c.company_current, c.email, c.location_city]
        .some(v => (v ?? '').toLowerCase().includes(term))
    })
    return rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, term, scope, associationsMap])

  const pipelineCount = useMemo(() => candidates.filter(c => activeOf(c.id).length > 0).length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [candidates, associationsMap])

  const loading = isLoading || (scope === 'pipeline' && assocLoading && associationsMap.size === 0)

  return (
    <PhonePage>
      <PhoneTitle
        eyebrow="Candidates"
        title="People"
        sub={isLoading ? 'Loading…' : `${candidates.length.toLocaleString('en-US')} in Gio · ${pipelineCount.toLocaleString('en-US')} in a pipeline`}
      />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7080]" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          type="search"
          inputMode="search"
          placeholder="Name, role, company…"
          aria-label="Search candidates"
          className="gio-field h-11 w-full rounded-[12px] border border-[#E7E8EE] bg-white pl-10 pr-10 font-inter text-[16px] text-[#0d0d09] placeholder:text-[#6B7080]"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery('')}
            className="gio-search-clear absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#5A6072]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Which candidates" className="mb-4 grid grid-cols-2 gap-1 rounded-[12px] bg-[#EDEAE2] p-1">
        {([['pipeline', 'In a pipeline'], ['all', 'Everyone']] as const).map(([id, label]) => (
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
            {label}
          </button>
        ))}
      </div>

      <PhoneCard>
        {error && candidates.length === 0 ? (
          <LoadError what="candidates" compact onRetry={() => { void getCandidates?.() }} />
        ) : loading ? (
          <PhoneSkeletonRows rows={6} />
        ) : list.length === 0 ? (
          <PhoneEmpty>{term ? `No one matches “${query.trim()}”.` : scope === 'pipeline' ? 'No one is in an active pipeline.' : 'No candidates yet.'}</PhoneEmpty>
        ) : list.slice(0, shown).map(c => {
          const active = activeOf(c.id)
          const first = active[0]
          return (
            <PhoneRow
              key={c.id}
              to={`/candidates/${c.id}`}
              leading={<Initials name={c.candidate_name} />}
              title={c.candidate_name || 'Unnamed candidate'}
              meta={[c.current_job_title, c.company_current].filter(Boolean).join(' · ') || [c.location_city, c.location_country].filter(Boolean).join(', ') || c.email || '—'}
              trailing={first ? (
                <span className="flex max-w-[120px] flex-col items-end gap-0.5">
                  <Pill tone="purple">{first.stageName ?? 'Active'}</Pill>
                  {active.length > 1 && <span className="font-inter text-[11px] text-[#6B7080]">+{active.length - 1} more</span>}
                </span>
              ) : undefined}
              chevron={false}
            />
          )
        })}
      </PhoneCard>

      {list.length > shown && (
        <button
          type="button"
          onClick={() => setShown(s => s + PAGE)}
          className="gio-pressable mt-3 inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-[#E7E8EE] bg-white font-poppins font-semibold text-[13.5px] text-[#0d0d09]"
        >
          Show {Math.min(PAGE, list.length - shown)} more of {list.length.toLocaleString('en-US')}
        </button>
      )}
    </PhonePage>
  )
}
