import { useMemo, useState } from 'react'
import { ChevronDown, Plus, Search, Settings2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState, EmptyAction } from '@/components/ui/empty-state'
import { SoftPaper } from '@/components/ui/EmptyIllustrations'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { ReferencesShell, ReferencesNoAccess } from '@/components/references/ReferencesShell'
import { ReferenceRequestsTable } from '@/components/references/ReferenceRequestsTable'
import { useTenantReferenceRequests, type ReferenceListRow } from '@/hooks/useReferenceList'
import { refPredicates, type RefBucket } from '@/lib/references/status'

const TABS: [RefBucket, string][] = [
  ['all', 'All'],
  ['needsAttention', 'Needs attention'],
  ['waiting', 'Waiting'],
  ['complete', 'Complete'],
]

const ALL = '__all__'

function FilterPill({
  label,
  value,
  options,
  onSelect,
}: {
  label: string
  value: string
  options: { id: string; label: string }[]
  onSelect: (id: string) => void
}) {
  const active = value !== ALL
  const current = options.find((o) => o.id === value)?.label ?? 'All'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center font-inter"
          style={{
            gap: 6,
            height: 30,
            padding: '0 11px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            border: `1px solid ${active ? '#0d0d09' : '#E0DDD3'}`,
            background: active ? '#0d0d09' : '#fff',
            color: active ? '#fffcf9' : '#1F2230',
          }}
        >
          <span style={{ color: active ? 'rgba(255,252,249,0.6)' : '#8B8F9E' }}>{label}:</span>
          <span className="truncate" style={{ maxWidth: 140 }}>
            {current}
          </span>
          <ChevronDown size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onSelect(ALL)}>All</DropdownMenuItem>
        {options
          .filter((o) => o.id !== ALL)
          .map((o) => (
            <DropdownMenuItem key={o.id} onClick={() => onSelect(o.id)}>
              {o.label}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** /references — the request list (Flow E.1). */
export default function ReferencesPage() {
  const navigate = useNavigate()
  const { canViewReferences } = usePermissions()
  const { user } = useAuth()
  const { requests, isLoading } = useTenantReferenceRequests()

  const [tab, setTab] = useState<RefBucket>('all')
  const [job, setJob] = useState(ALL)
  const [client, setClient] = useState(ALL)
  const [recruiter, setRecruiter] = useState(ALL)
  const [search, setSearch] = useState('')

  const jobOptions = useMemo(
    () =>
      dedupe(
        requests
          .filter((r) => r.jobId)
          .map((r) => ({ id: r.jobId!, label: r.jobTitle ?? 'Job' })),
      ),
    [requests],
  )
  const clientOptions = useMemo(
    () =>
      dedupe(
        requests
          .filter((r) => r.clientId)
          .map((r) => ({ id: r.clientId!, label: r.clientName ?? 'Client' })),
      ),
    [requests],
  )
  const recruiterOptions = useMemo(
    () =>
      dedupe(
        requests
          .filter((r) => r.requestedBy)
          .map((r) => ({
            id: r.requestedBy!,
            label:
              r.recruiterName ?? (r.requestedBy === user?.id ? 'Me' : 'Recruiter'),
          })),
      ),
    [requests, user?.id],
  )

  /** Pills and search narrow the pool; the tab predicate then decides. */
  const pool = useMemo(() => {
    const q = search.trim().toLowerCase()
    return requests.filter((r) => {
      if (job !== ALL && r.jobId !== job) return false
      if (client !== ALL && r.clientId !== client) return false
      if (recruiter !== ALL && r.requestedBy !== recruiter) return false
      if (!q) return true
      // Referee names are searchable too — recruiters look for a referee
      // they already have somewhere else in the workspace.
      return (
        r.candidateName.toLowerCase().includes(q) ||
        r.referees.some((ref) => (ref.name ?? '').toLowerCase().includes(q))
      )
    })
  }, [requests, job, client, recruiter, search])

  // ONE predicate object drives both the tab counts and the rows.
  const tabs = TABS.map(
    ([id, label]) => [id, label, pool.filter(refPredicates[id]).length] as const,
  )
  const rows = pool.filter(refPredicates[tab])

  const jobsCount = new Set(requests.map((r) => r.jobId).filter(Boolean)).size
  const attentionCount = requests.filter(refPredicates.needsAttention).length

  if (!canViewReferences) return <ReferencesNoAccess />

  return (
    <ReferencesShell>
      <PageHeader
        title="Reference checks"
        kicker
        count={requests.length}
        meta={
          <>
            <span>Across {jobsCount} jobs</span>
            {attentionCount > 0 && (
              <span style={{ color: '#B45309' }}>{attentionCount} need attention</span>
            )}
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              icon={Settings2}
              onClick={() => navigate('/references/templates')}
            >
              Templates
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => navigate('/candidates')}
            >
              New request
            </Button>
          </>
        }
      />

      {requests.length > 0 && (
        <div
          className="flex items-center"
          style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}
        >
          <div
            className="inline-flex"
            style={{ gap: 3, padding: 3, background: '#F1F0EC', borderRadius: 9 }}
          >
            {tabs.map(([id, label, count]) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className="inline-flex items-center font-poppins"
                  style={{
                    gap: 6,
                    padding: '6px 11px',
                    borderRadius: 7,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    color: active ? '#1F2230' : '#5A6072',
                    background: active ? '#fff' : 'transparent',
                    boxShadow: active ? '0 1px 2px rgba(13,13,9,0.06)' : undefined,
                  }}
                >
                  {label}
                  <span
                    className="font-inter tabular-nums"
                    style={{
                      fontSize: 10.5,
                      padding: '0 5px',
                      borderRadius: 999,
                      color: '#5A6072',
                      background: active ? '#F1F0EC' : 'rgba(13,13,9,0.06)',
                    }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <span aria-hidden style={{ width: 1, height: 22, background: '#E0DDD3' }} />

          <FilterPill label="Job" value={job} options={jobOptions} onSelect={setJob} />
          <FilterPill label="Client" value={client} options={clientOptions} onSelect={setClient} />
          <FilterPill
            label="Recruiter"
            value={recruiter}
            options={recruiterOptions}
            onSelect={setRecruiter}
          />

          <div
            className="inline-flex items-center"
            style={{
              marginLeft: 'auto',
              gap: 7,
              height: 30,
              padding: '0 11px',
              background: '#fff',
              border: '1px solid #E0DDD3',
              borderRadius: 8,
              minWidth: 200,
            }}
          >
            <Search size={13} color="#8B8F9E" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate or referee…"
              className="font-inter bg-transparent outline-none flex-1 min-w-0"
              style={{ fontSize: 12, color: '#1F2230' }}
            />
          </div>
        </div>
      )}

      {requests.length === 0 ? (
        isLoading ? null : (
          <EmptyState
            illustration={<SoftPaper />}
            title="No reference checks yet"
            body="Request references from a candidate's profile — checks live with the candidate and follow them across jobs."
            secondary={
              <EmptyAction variant="secondary" onClick={() => navigate('/references/templates')}>
                Manage templates
              </EmptyAction>
            }
          />
        )
      ) : rows.length === 0 ? (
        <div
          className="font-inter"
          style={{
            background: '#fff',
            border: '1px solid #E7E8EE',
            borderRadius: 12,
            padding: '28px 18px',
            textAlign: 'center',
            fontSize: 12,
            color: '#5A6072',
          }}
        >
          No checks match this view.
        </div>
      ) : (
        <ReferenceRequestsTable
          rows={rows}
          onOpen={(row: ReferenceListRow) => navigate(`/references/requests/${row.id}`)}
        />
      )}
    </ReferencesShell>
  )
}

function dedupe(items: { id: string; label: string }[]) {
  const map = new Map<string, string>()
  for (const i of items) if (!map.has(i.id)) map.set(i.id, i.label)
  return Array.from(map, ([id, label]) => ({ id, label }))
}
