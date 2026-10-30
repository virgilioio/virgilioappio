import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, RotateCcw, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ListTabs } from '@/components/ui/list-tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableSkeleton } from '@/components/ui/table-states'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { JobPreview } from '@/components/previews/EntityPreview'
import { useScrollMemory } from '@/lib/scrollMemory'
import { JOB_STATUS_TONE } from '@/lib/badge-tones'
import { JOB_SEAT_LABEL, jobBucket, type JobBucket, type PersonJob } from '@/lib/os/peopleAccess'

const COLS = 5

function opened(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * A person's job seats as a table: Open · Draft · Closed with counts, a search,
 * and a body that scrolls inside the card so a long list never stretches the page.
 */
export function PersonJobsTable({
  jobs,
  loading,
  error,
  onRetry,
  firstName,
  isAdmin,
  memoryKey,
  self = false,
}: {
  jobs: PersonJob[] | undefined
  loading: boolean
  error: boolean
  onRetry: () => void
  firstName: string
  isAdmin: boolean
  /** Remembers each status tab's scroll position, per person. */
  memoryKey: string
  /** My profile: the empty and error states speak to them. */
  self?: boolean
}) {
  const all = useMemo(() => jobs ?? [], [jobs])
  const counts = useMemo(() => {
    const c: Record<JobBucket, number> = { open: 0, draft: 0, closed: 0 }
    for (const j of all) c[jobBucket(j.status)]++
    return c
  }, [all])
  // The status tab lives in the URL (?status=closed) so Back and links keep it (§9).
  const [params, setParams] = useSearchParams()
  const picked = params.get('status')
  const bucket: JobBucket | null = picked === 'open' || picked === 'draft' || picked === 'closed' ? picked : null
  const setBucket = (next: JobBucket) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('status', next)
        return p
      },
      { replace: true },
    )
  // Start on the first tab that has jobs, so an all-closed list doesn't open empty.
  const firstWithJobs: JobBucket | null = counts.open ? 'open' : counts.draft ? 'draft' : counts.closed ? 'closed' : null
  const shown: JobBucket = bucket ?? firstWithJobs ?? 'open'
  const scrollRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [retry, setRetry] = useState(0)
  const timedOut = useLoadTimeout(loading, retry)

  const q = search.trim().toLowerCase()
  const inBucket = all.filter((j) => jobBucket(j.status) === shown)
  const rows = q
    ? inBucket.filter((j) => j.title.toLowerCase().includes(q) || (j.client ?? '').toLowerCase().includes(q))
    : inBucket
  const failed = error || timedOut
  useScrollMemory(scrollRef, `${memoryKey}:${shown}`, !loading && !failed)
  const elsewhere = (['open', 'draft', 'closed'] as const).find((b) => b !== shown && counts[b] > 0)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-virgilio-border bg-white overflow-hidden">
        <ListTabs
          label="Job status"
          value={shown}
          onChange={(v) => setBucket(v as JobBucket)}
          tabs={[
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'draft', label: 'Draft', count: counts.draft },
            { value: 'closed', label: 'Closed', count: counts.closed },
          ]}
        />
        <div className="p-3">
          <div className="relative">
            <Search aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by job or client…"
              aria-label="Search jobs"
              className="h-10 pl-10 pr-3 bg-[#FAFAF7] border-transparent rounded-xl text-[13.5px] focus-visible:bg-white"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-virgilio-border bg-white overflow-clip">
        <div ref={scrollRef} className="max-h-[560px] overflow-auto">
          <Table density="comfortable">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[38%]">Job</TableHead>
                <TableHead className="hidden md:table-cell">Client</TableHead>
                <TableHead className="hidden md:table-cell">Seat</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !failed ? (
                <TableSkeleton rows={5} columns={COLS} />
              ) : failed ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={COLS} style={{ padding: '48px 24px' }}>
                    <LoadError
                      what={self ? 'your jobs' : 'their jobs'}
                      timedOut={timedOut && !error}
                      compact
                      onRetry={() => {
                        setRetry((n) => n + 1)
                        onRetry()
                      }}
                    />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={COLS} style={{ padding: '40px 24px' }}>
                    {all.length === 0 ? (
                      <AnimatedEmpty
                        scene="jobs"
                        size="compact"
                        onceKey="os-person-jobs"
                        title={self ? (isAdmin ? "You're not on any job" : "You're not on any job yet") : `${firstName} isn't on any job`}
                        body={
                          self
                            ? isAdmin
                              ? 'As an admin you see every job without a seat.'
                              : "A job's recruiter adds you from its Hiring team."
                            : isAdmin
                              ? 'Admins see every job without a seat.'
                              : "Seat them from a job's Hiring team."
                        }
                      />
                    ) : (
                      <AnimatedEmpty
                        scene="search"
                        size="compact"
                        onceKey="os-person-jobs"
                        title={q ? 'No jobs match your search' : `No ${shown} jobs`}
                        body={
                          q
                            ? `${inBucket.length} ${inBucket.length === 1 ? 'job is' : 'jobs are'} hidden by your search.`
                            : `${all.length} ${all.length === 1 ? 'job is' : 'jobs are'} in the other tabs.`
                        }
                        primary={
                          q
                            ? { label: 'Clear search', icon: <RotateCcw size={16} strokeWidth={2} />, onClick: () => setSearch('') }
                            : elsewhere
                              ? {
                                  label: `Show ${elsewhere} jobs`,
                                  icon: <ArrowRight size={16} strokeWidth={2} />,
                                  onClick: () => setBucket(elsewhere),
                                }
                              : undefined
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((j) => (
                  <TableRow key={`${j.job_id}-${j.role}`}>
                    <TableCell>
                      <JobPreview jobId={j.job_id}>
                        <Link
                          to={`/jobs/${j.job_id}`}
                          className="block max-w-[190px] truncate font-inter text-[13px] font-medium text-text-primary hover:text-virgilio-purple md:max-w-[360px]"
                        >
                          {j.title}
                        </Link>
                      </JobPreview>
                      {/* Phones: seat and client under the title instead of their own columns. */}
                      <span className="mt-0.5 block max-w-[190px] truncate font-inter text-[12px] text-text-tertiary md:hidden">
                        {JOB_SEAT_LABEL[j.role] ?? j.role}
                        {j.client ? ` · ${j.client}` : ''}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="block max-w-[220px] truncate font-inter text-[13px] text-text-secondary">
                        {j.client ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="whitespace-nowrap font-inter text-[13px] text-text-secondary">
                        {JOB_SEAT_LABEL[j.role] ?? j.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge tone={JOB_STATUS_TONE[j.status] ?? 'neutral'} size="xs">
                        {j.status[0].toUpperCase() + j.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="whitespace-nowrap font-inter text-[13px] text-text-secondary">{opened(j.created_at)}</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
