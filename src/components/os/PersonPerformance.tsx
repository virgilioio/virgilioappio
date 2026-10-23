import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, CalendarCheck2, FileCheck2, ListChecks, Timer, TrendingUp, UserPlus } from 'lucide-react'

import { MetricStrip } from '@/components/ui/metric-strip'
import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadError } from '@/components/empty/LoadError'
import { JobPreview } from '@/components/previews/EntityPreview'
import { ProfileCard } from '@/components/os/ProfileParts'
import { PERIOD_LABEL, share, usePersonPerformance, type PerformancePeriod } from '@/lib/os/performance'

const PERIODS: PerformancePeriod[] = ['90d', 'year', 'all']

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Performance (member profile step 4, 2026-10-23): a person's hires, time to
 * fill, candidates added, interviews and offers over a period, the funnel of
 * the candidates they added, and the same counts per job. Counted on the
 * server (os_person_performance). Hires count only openings that credit them.
 */
export function PersonPerformance({
  tenantId,
  userId,
  self = false,
}: {
  tenantId: string | undefined
  userId: string | null
  /** My profile: the copy speaks to the person. */
  self?: boolean
}) {
  const [period, setPeriod] = useState<PerformancePeriod>('90d')
  const perf = usePersonPerformance(tenantId, userId, period)
  const segRef = useSegmentLayer<HTMLDivElement>()
  const d = perf.data
  const they = self ? 'you' : 'they'
  const firstLoad = perf.isLoading

  const funnel = d?.funnel
  const funnelLine = funnel
    ? funnel.added === 0
      ? `${self ? "You haven't" : "They haven't"} added candidates in this period.`
      : `Of the ${plural(funnel.added, 'candidate', 'candidates')} ${they} added: ${funnel.interviewed} reached an interview${
          share(funnel.interviewed, funnel.added) ? ` (${share(funnel.interviewed, funnel.added)})` : ''
        }, ${funnel.offered} got an offer and ${funnel.hired} ${funnel.hired === 1 ? 'was' : 'were'} hired.`
    : null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-poppins text-[13.5px] font-semibold tracking-[-0.02em] text-[#1F2230]">
          <TrendingUp className="h-4 w-4 text-[#6B7080]" strokeWidth={2} aria-hidden />
          Performance
          {perf.isFetching && !firstLoad && (
            <span role="status" aria-label="Refreshing" className="inline-flex h-4 w-4 items-center justify-center text-[#8B8F9E]">
              <span className="gio-spinner gio-spinner-current" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
            </span>
          )}
        </h2>
        <div
          ref={segRef}
          role="radiogroup"
          aria-label="Period"
          className="gio-seg inline-flex max-w-full"
          style={{ gap: 2, padding: 3, background: '#ECEAE2', borderRadius: 9 }}
        >
          {PERIODS.map((p) => {
            const active = period === p
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={active}
                data-seg-option
                data-active={active || undefined}
                onClick={() => setPeriod(p)}
                className="whitespace-nowrap font-inter"
                style={{
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: active ? '#fff' : '#5A6072',
                  background: 'transparent',
                  transition: 'color var(--dur-hover) ease',
                }}
              >
                {PERIOD_LABEL[p]}
              </button>
            )
          })}
          <SegmentLayer fill="#0d0d09" />
        </div>
      </div>

      {perf.isError && !d ? (
        <div className="rounded-[12px] border border-[#E7E8EE] bg-white p-4">
          <LoadError what={self ? 'your performance' : 'their performance'} compact onRetry={() => void perf.refetch()} />
        </div>
      ) : (
        <>
          <MetricStrip
            id={`os-perf-${userId}`}
            loading={firstLoad}
            items={[
              {
                label: 'Hires',
                icon: BadgeCheck,
                tone: 'green',
                value: d?.hires ?? 0,
                detail: d && d.hires > 0 ? `Sourcer ${d.hires_as_sourcer} · Recruiter ${d.hires_as_recruiter}` : undefined,
              },
              {
                label: 'Time to fill',
                icon: Timer,
                tone: 'yellow',
                value: d?.fill_days_median ?? '—',
                format: (v) => `${Math.round(v)} ${Math.round(v) === 1 ? 'day' : 'days'}`,
                detail: d && d.hires > 0 ? 'Median, opening to hire' : undefined,
              },
              { label: 'Candidates added', icon: UserPlus, tone: 'purple', value: d?.added ?? 0 },
              { label: 'Interviews', icon: CalendarCheck2, tone: 'blue', value: d?.interviews ?? 0 },
              { label: 'Offers', icon: FileCheck2, tone: 'neutral', value: d?.offers ?? 0 },
            ]}
          />
          <p className="min-h-[18px] px-1 font-inter text-[12px] leading-[1.5] text-[#6B7080]">
            {firstLoad ? null : (
              <>
                {funnelLine}
                {d && d.uncredited_fills > 0
                  ? ` ${plural(d.uncredited_fills, 'opening', 'openings')} on ${self ? 'your' : 'their'} jobs ${
                      d.uncredited_fills === 1 ? 'was' : 'were'
                    } filled with no Sourcer or Recruiter credit yet, so ${d.uncredited_fills === 1 ? "it isn't" : "they aren't"} in Hires.`
                  : ''}
              </>
            )}
          </p>

          <ProfileCard title="By job" icon={ListChecks} flush>
            {firstLoad ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-[40px] w-full" />
                ))}
              </div>
            ) : !d || d.by_job.length === 0 ? (
              <p className="p-4 font-inter text-[12.5px] text-[#6B7080]">
                Nothing in {PERIOD_LABEL[period].toLowerCase()}: no candidates added, interviews, offers or credited hires.
              </p>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead className="text-right">Added</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Interviews</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Offers</TableHead>
                      <TableHead className="text-right">Hires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.by_job.map((j) => (
                      <TableRow key={j.job_id}>
                        <TableCell className="max-w-[200px] sm:max-w-[360px]">
                          <JobPreview jobId={j.job_id}>
                            <Link
                              to={`/jobs/${j.job_id}`}
                              className="block truncate font-medium text-[#1F2230] transition-colors duration-hover hover:text-[#6F3FF5]"
                            >
                              {j.title || 'Untitled job'}
                            </Link>
                          </JobPreview>
                          <span className="block truncate text-[11.5px] text-[#6B7080]">
                            {[j.client, j.status === 'closed' ? 'Closed' : j.status === 'draft' ? 'Draft' : null].filter(Boolean).join(' · ') || '—'}
                          </span>
                          <span className="mt-0.5 block text-[11.5px] text-[#5A6072] sm:hidden">
                            {plural(j.interviews, 'interview', 'interviews')} · {plural(j.offers, 'offer', 'offers')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{j.added || <span className="text-[#8B8F9E]">—</span>}</TableCell>
                        <TableCell className="hidden text-right sm:table-cell">{j.interviews || <span className="text-[#8B8F9E]">—</span>}</TableCell>
                        <TableCell className="hidden text-right sm:table-cell">{j.offers || <span className="text-[#8B8F9E]">—</span>}</TableCell>
                        <TableCell className="text-right font-medium">{j.hires || <span className="font-normal text-[#8B8F9E]">—</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </ProfileCard>
        </>
      )}
    </div>
  )
}
