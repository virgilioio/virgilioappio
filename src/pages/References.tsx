import { useMemo, useState } from 'react'
import { Plus, RotateCcw, Search, Settings2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterChipPopover } from '@/components/ui/filter-chip-popover'
import { ListTabs } from '@/components/ui/list-tabs'
import { ListPage, MetaDot } from '@/components/layout/ListPage'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { ReferencesNoAccess } from '@/components/references/ReferencesShell'
import { ReferenceRequestsTable } from '@/components/references/ReferenceRequestsTable'
import { useTenantReferenceRequests, type ReferenceListRow } from '@/hooks/useReferenceList'
import {
  useCancelReferenceRequest,
  useDeleteReferenceRequest,
  useResendCandidateLink,
} from '@/hooks/useReferenceRequests'
import { ShareReportDialog } from '@/components/references/ShareReportDialog'
import {
  CancelDeleteReferenceDialog,
  type RefDestructiveMode,
} from '@/components/references/CancelDeleteReferenceDialog'
import { isActiveRefState, refPredicates, type RefBucket } from '@/lib/references/status'

const TABS: [RefBucket, string][] = [
  ['all', 'All'],
  ['needsAttention', 'Needs attention'],
  ['waiting', 'Waiting'],
  ['complete', 'Complete'],
  ['cancelled', 'Cancelled'],
]

const TAB_EMPTY: Record<RefBucket, { title: string; body: string }> = {
  all: { title: 'No reference checks', body: 'Request references from a candidate\'s profile.' },
  needsAttention: { title: 'Nothing needs attention', body: 'Checks with overdue or flagged referees show up here.' },
  waiting: { title: 'Nothing waiting', body: 'Checks waiting on a candidate or referee show up here.' },
  complete: { title: 'No complete checks', body: 'Checks with every reference in show up here.' },
  cancelled: { title: 'No cancelled checks', body: 'Cancelled checks stay here until you delete them.' },
}

/** /references — the request list (Flow E.1), laid out like the Jobs list. */
export default function ReferencesPage() {
  const navigate = useNavigate()
  const { canViewReferences, canCancelReferences, canDeleteReferences } = usePermissions()
  const { user } = useAuth()
  const { requests, isLoading, isError, refetch } = useTenantReferenceRequests()
  const [retry, setRetry] = useState(0)
  const timedOut = useLoadTimeout(isLoading, retry)
  const loadError: 'failed' | 'timeout' | null = isError ? 'failed' : timedOut ? 'timeout' : null

  const [tab, setTab] = useState<RefBucket>('all')
  const [jobs, setJobs] = useState<string[]>([])
  const [clients, setClients] = useState<string[]>([])
  const [recruiters, setRecruiters] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [shareFor, setShareFor] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ mode: RefDestructiveMode; row: ReferenceListRow } | null>(
    null,
  )
  // Kept apart from `confirm` so the dialog keeps its content through its exit.
  const [confirmOpen, setConfirmOpen] = useState(false)
  const askFor = (mode: RefDestructiveMode, row: ReferenceListRow) => {
    setConfirm({ mode, row })
    setConfirmOpen(true)
  }

  const resend = useResendCandidateLink()
  const cancelRequest = useCancelReferenceRequest()
  const deleteRequest = useDeleteReferenceRequest()

  const options = (pick: (r: ReferenceListRow) => [string | null | undefined, string]) => {
    const map = new Map<string, { value: string; label: string; count: number }>()
    for (const r of requests) {
      const [id, label] = pick(r)
      if (!id) continue
      const hit = map.get(id)
      if (hit) hit.count++
      else map.set(id, { value: id, label, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }
  const jobOptions = useMemo(() => options((r) => [r.jobId, r.jobTitle ?? 'Job']), [requests]) // eslint-disable-line react-hooks/exhaustive-deps
  const clientOptions = useMemo(() => options((r) => [r.clientId, r.clientName ?? 'Client']), [requests]) // eslint-disable-line react-hooks/exhaustive-deps
  const recruiterOptions = useMemo(
    () => options((r) => [r.requestedBy, r.recruiterName ?? (r.requestedBy === user?.id ? 'Me' : 'Recruiter')]),
    [requests, user?.id], // eslint-disable-line react-hooks/exhaustive-deps
  )

  /** Chips and search narrow the pool; the tab predicate then decides. */
  const pool = useMemo(() => {
    const q = search.trim().toLowerCase()
    return requests.filter((r) => {
      if (jobs.length && !jobs.includes(r.jobId ?? '')) return false
      if (clients.length && !clients.includes(r.clientId ?? '')) return false
      if (recruiters.length && !recruiters.includes(r.requestedBy ?? '')) return false
      if (!q) return true
      // Referee names are searchable too: recruiters look for a referee
      // they already have somewhere else in the workspace.
      return (
        r.candidateName.toLowerCase().includes(q) ||
        r.referees.some((ref) => (ref.name ?? '').toLowerCase().includes(q))
      )
    })
  }, [requests, jobs, clients, recruiters, search])

  // ONE predicate object drives both the tab counts and the rows.
  const rows = pool.filter(refPredicates[tab])
  const filtered = jobs.length > 0 || clients.length > 0 || recruiters.length > 0 || search.trim() !== ''
  const hidden = requests.filter(refPredicates[tab]).length - rows.length
  const clearFilters = () => {
    setJobs([])
    setClients([])
    setRecruiters([])
    setSearch('')
  }

  const visible = requests.filter(refPredicates.all)
  const jobsCount = new Set(visible.map((r) => r.jobId).filter(Boolean)).size
  const attentionCount = visible.filter(refPredicates.needsAttention).length

  if (!canViewReferences) return <ReferencesNoAccess />

  const emptyState = loadError ? (
    <LoadError
      what="reference checks"
      timedOut={loadError === 'timeout'}
      onRetry={() => {
        setRetry((n) => n + 1)
        void refetch()
      }}
    />
  ) : requests.length === 0 ? (
    <AnimatedEmpty
      scene="candidates"
      onceKey="references-list"
      title="No reference checks yet"
      body="Request references from a candidate's profile. Checks live with the candidate and follow them across jobs."
      primary={{ label: 'New request', icon: <Plus size={16} />, onClick: () => navigate('/candidates') }}
      secondary={{ label: 'Manage templates', icon: <Settings2 size={16} strokeWidth={2} />, onClick: () => navigate('/references/templates') }}
    />
  ) : filtered && hidden > 0 ? (
    <AnimatedEmpty
      scene="search"
      onceKey="references-list"
      title="No reference checks match these filters"
      body={`${hidden} ${hidden === 1 ? 'check is' : 'checks are'} hidden by your filters.`}
      primary={{ label: 'Clear filters', icon: <RotateCcw size={16} strokeWidth={2} />, onClick: clearFilters }}
    />
  ) : (
    <AnimatedEmpty scene="candidates" onceKey="references-list" title={TAB_EMPTY[tab].title} body={TAB_EMPTY[tab].body} />
  )

  return (
    <ListPage
      title="Reference checks"
      count={visible.length}
      meta={
        <>
          <MetaDot color="#B5B9C4">
            Across {jobsCount} {jobsCount === 1 ? 'job' : 'jobs'}
          </MetaDot>
          {attentionCount > 0 ? (
            <button
              type="button"
              onClick={() => setTab('needsAttention')}
              className="inline-flex items-center gap-1.5 text-[#B45309] transition-colors duration-hover hover:text-text-primary"
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
              {attentionCount} need attention
            </button>
          ) : (
            <MetaDot color="#12B886">Nothing needs attention</MetaDot>
          )}
        </>
      }
      actions={
        <>
          <Button variant="secondary" size="md" icon={Settings2} onClick={() => navigate('/references/templates')}>
            Templates
          </Button>
          <Button variant="primary" size="md" icon={Plus} onClick={() => navigate('/candidates')}>
            New request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Tabs + filters card */}
        <div className="rounded-2xl border border-virgilio-border bg-white overflow-hidden">
          <ListTabs
            label="Status"
            value={tab}
            onChange={(v) => setTab(v as RefBucket)}
            tabs={TABS.map(([id, label]) => ({ value: id, label, count: pool.filter(refPredicates[id]).length }))}
          />
          <div className="flex flex-wrap items-center gap-3 p-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidate or referee…"
                aria-label="Search reference checks"
                className="h-10 pl-10 pr-3 bg-[#FAFAF7] border-transparent rounded-xl text-[13.5px] focus-visible:bg-white"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <FilterChipPopover label="Job" options={jobOptions} selectedValues={jobs} onSelectionChange={setJobs} searchable />
              <FilterChipPopover label="Client" options={clientOptions} selectedValues={clients} onSelectionChange={setClients} searchable />
              <FilterChipPopover
                label="Recruiter"
                options={recruiterOptions}
                selectedValues={recruiters}
                onSelectionChange={setRecruiters}
                searchable
              />
            </div>
          </div>
        </div>

        <ReferenceRequestsTable
          rows={loadError ? [] : rows}
          loading={isLoading && !loadError}
          emptyState={emptyState}
          onOpen={(row: ReferenceListRow) => navigate(`/references/requests/${row.id}`)}
          onResend={(row) => resend.mutate(row.id)}
          onShare={(row) => setShareFor(row.id)}
          onCancel={(row) => askFor('cancel', row)}
          onDelete={(row) => askFor('delete', row)}
          canCancel={canCancelReferences}
          canDelete={canDeleteReferences}
        />
      </div>

      <ShareReportDialog
        open={!!shareFor}
        onOpenChange={(v) => !v && setShareFor(null)}
        requestId={shareFor}
      />

      {confirm && (
        <CancelDeleteReferenceDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          mode={confirm.mode}
          candidateName={confirm.row.candidateName}
          referees={confirm.row.referees}
          canCancelInstead={canCancelReferences && isActiveRefState(confirm.row.state)}
          onConfirm={async () => {
            const { mode, row } = confirm
            if (mode === 'cancel') {
              cancelRequest.mutate(row.id)
              return
            }
            // With answers it's type to confirm: the dialog waits and shows a failure inline.
            try {
              await deleteRequest.mutateAsync(row.id)
            } catch {
              throw new Error(
                `Couldn\u2019t delete ${row.candidateName ? `${row.candidateName}\u2019s` : 'this'} reference check. Try again.`,
              )
            }
          }}
        />
      )}
    </ListPage>
  )
}
