import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Coins, ListChecks } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadError } from '@/components/empty/LoadError'
import { JobPreview } from '@/components/previews/EntityPreview'
import { ProfileCard } from '@/components/os/ProfileParts'
import { supabase } from '@/lib/supabaseClient'
import { JOB_SEAT_LABEL, type PersonJob } from '@/lib/os/peopleAccess'

/** The seats that earn on a placement. */
const EARNING_SEATS = new Set(['recruiter', 'sourcer'])

interface Opening {
  id: string
  job_id: string
  req_id: string | null
  status: 'open' | 'offer' | 'filled' | 'cancelled'
  candidate_name: string | null
  filled_at: string | null
  fee_pct: number | null
  target_hire_date: string | null
}

/** Openings on the jobs where this person is TA Partner or Sourcing Partner. */
function usePersonOpenings(userId: string | null | undefined, jobIds: string[]) {
  return useQuery({
    queryKey: ['os-person-openings', userId, jobIds.slice().sort().join(',')],
    enabled: !!userId && jobIds.length > 0,
    queryFn: async (): Promise<Opening[]> => {
      const { data, error } = await supabase
        .from('job_openings_with_status')
        .select('id, job_id, req_id, status, candidate_name, filled_at, fee_pct, target_hire_date')
        .in('job_id', jobIds)
      if (error) throw error
      return (data ?? []) as Opening[]
    },
  })
}

const STATUS = {
  filled: { label: 'Filled', dot: '#12B886' },
  offer: { label: 'In offer', dot: '#F59E0B' },
  open: { label: 'Open', dot: '#0EA5E9' },
  cancelled: { label: 'Cancelled', dot: '#9CA3AF' },
} as const
const ORDER = { offer: 0, open: 1, filled: 2, cancelled: 3 } as const

function day(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null
}

/**
 * Earnings (Part A, 2026-10-23): what a person's commissions will be built
 * from, the openings on the jobs where they earn, until the commission rules
 * exist (Part C). Nothing here is a made-up amount.
 */
export function PersonEarnings({ userId, jobs, jobsLoading }: { userId: string | null; jobs: PersonJob[]; jobsLoading: boolean }) {
  const seats = jobs.filter((j) => EARNING_SEATS.has(j.role))
  const seatOf = new Map(seats.map((j) => [j.job_id, j]))
  const openings = usePersonOpenings(userId, [...seatOf.keys()])
  const rows = (openings.data ?? [])
    .slice()
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.filled_at ?? '').localeCompare(a.filled_at ?? ''))
  const year = new Date().getFullYear()
  const filledThisYear = rows.filter((r) => r.status === 'filled' && r.filled_at && new Date(r.filled_at).getFullYear() === year).length
  const loading = jobsLoading || (seats.length > 0 && openings.isLoading)

  return (
    <div className="space-y-4">
      <ProfileCard title="Commissions" icon={Coins}>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { label: `Filled in ${year}`, n: filledThisYear },
            { label: 'In offer', n: rows.filter((r) => r.status === 'offer').length },
            { label: 'Open', n: rows.filter((r) => r.status === 'open').length },
          ].map((s) => (
            <div key={s.label} className="rounded-[10px] bg-[#F7F6F2] px-3 py-2">
              <div className="font-poppins text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-[#1F2230]">
                {loading ? <Skeleton className="my-1 h-5 w-8" /> : s.n}
              </div>
              <div className="font-inter text-[11.5px] text-[#6B7080]">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="pt-3 font-inter text-[12px] leading-[1.5] text-[#6B7080]">
          Paid, pending and potential commissions will show here, worked out from each opening below, once Virgilio's
          commission rules are set up in Gio.
        </p>
      </ProfileCard>

      <ProfileCard title="Openings" icon={ListChecks} flush>
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[40px] w-full" />
            ))}
          </div>
        ) : openings.isError ? (
          <div className="p-4">
            <LoadError what="their openings" compact onRetry={() => void openings.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-4 font-inter text-[12.5px] text-[#6B7080]">
            {seats.length === 0
              ? 'Not TA Partner or Sourcing Partner on any job yet.'
              : 'No openings on their jobs yet.'}
          </p>
        ) : (
          <div className="max-h-[520px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead className="hidden md:table-cell">Seat</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Hire</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => {
                  const job = seatOf.get(o.job_id)
                  const s = STATUS[o.status]
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="max-w-[280px]">
                        <JobPreview jobId={o.job_id}>
                          <Link
                            to={`/jobs/${o.job_id}`}
                            className="block truncate font-medium text-[#1F2230] transition-colors duration-hover hover:text-[#6F3FF5]"
                          >
                            {job?.title ?? 'Job'}
                          </Link>
                        </JobPreview>
                        <span className="block truncate text-[11.5px] text-[#6B7080]">
                          {[o.req_id, job?.client].filter(Boolean).join(' · ')}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-[#5A6072]">{job ? JOB_SEAT_LABEL[job.role] ?? job.role : ''}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} aria-hidden />
                          {s.label}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px]">
                        {o.candidate_name ? (
                          <span className="block truncate">{o.candidate_name}</span>
                        ) : (
                          <span className="text-[#8B8F9E]">{o.target_hire_date ? `Target ${day(o.target_hire_date)}` : '—'}</span>
                        )}
                        {o.filled_at && <span className="block text-[11.5px] text-[#6B7080]">{day(o.filled_at)}</span>}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right">
                        {o.fee_pct != null ? `${Number(o.fee_pct)}%` : <span className="text-[#8B8F9E]">Not set</span>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </ProfileCard>
    </div>
  )
}
