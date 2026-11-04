import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Accessibility, Download, Flag, ShieldCheck, UserRound, Users, UserX, Users2, UserCheck } from 'lucide-react'
import { ListPage } from '@/components/layout/ListPage'
import { Button } from '@/components/ui/button'
import { MetricStrip } from '@/components/ui/metric-strip'
import { Skeleton } from '@/components/ui/skeleton'
import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadError } from '@/components/empty/LoadError'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { ProfileCard } from '@/components/os/ProfileParts'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { supabase } from '@/lib/supabaseClient'
import { downloadCsv } from '@/lib/csv'
import {
  EEO_QUESTIONS,
  PERIOD_LABEL,
  answerRows,
  cellText,
  eeoCsvRows,
  share,
  useEeoReport,
  type EeoPeriod,
  type EeoQuestion,
} from '@/lib/eeoReport'

/**
 * Self-identification report (2026-11-04): what applicants told us in the voluntary
 * self-identification section, in totals only. No names, no candidate links: the
 * database hands back counts, and groups of 1 to 4 are hidden. Admins only.
 */
const PERIODS: EeoPeriod[] = ['year', 'quarter', '12m', 'all']
const ALL_JOBS = 'all'
const QUESTION_ICON: Record<EeoQuestion, typeof Users> = {
  gender: UserRound,
  race_ethnicity: Users2,
  veteran_status: Flag,
  disability_status: Accessibility,
}

function useTenantJobs(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['eeo-report-jobs', tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title')
        .eq('tenant_id', tenantId!)
        .is('deleted_at', null)
        .order('title')
      if (error) throw error
      return (data ?? []) as { id: string; title: string }[]
    },
  })
}

function Cell({ v, minGroup }: { v: number | null; minGroup: number }) {
  // A hidden small group reads "<5" in the table (the note above says why); screen
  // readers hear the words, and the CSV writes them out.
  return v === null ? (
    <span className="whitespace-nowrap text-[#8B8F9E]" aria-label={cellText(v, minGroup)}>
      &lt;{minGroup}
    </span>
  ) : (
    <span className="whitespace-nowrap">{cellText(v, minGroup)}</span>
  )
}

export default function SelfIdReport() {
  const navigate = useNavigate()
  const { isPlatformAdmin, isWorkspaceOwner, isAdmin } = usePermissions()
  const { isLoading: permsLoading } = useAuth()
  const allowed = isPlatformAdmin || isWorkspaceOwner || isAdmin
  useEffect(() => {
    if (!permsLoading && !allowed) navigate('/dashboard', { replace: true })
  }, [allowed, permsLoading, navigate])

  const { tenant } = useTenant()
  const [period, setPeriod] = useState<EeoPeriod>('year')
  const [job, setJob] = useState<string>(ALL_JOBS)
  const segRef = useSegmentLayer<HTMLDivElement>()
  const jobs = useTenantJobs(allowed ? tenant?.id : undefined)
  const report = useEeoReport(allowed ? tenant?.id : undefined, period, job === ALL_JOBS ? null : job)
  const [retry, setRetry] = useState(0)
  const first = report.isLoading && !report.data
  const timedOut = useLoadTimeout(first, retry)
  const d = report.data
  const minGroup = d?.min_group ?? 5

  const exportCsv = () => {
    if (!d) return
    const { header, rows } = eeoCsvRows(d)
    const jobName = job === ALL_JOBS ? 'All jobs' : jobs.data?.find((j) => j.id === job)?.title ?? 'One job'
    downloadCsv(`Self-identification · ${jobName} · ${PERIOD_LABEL[period]}`, header, rows)
  }

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
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
      <Select value={job} onValueChange={setJob}>
        <SelectTrigger aria-label="Job" className="h-9 w-auto min-w-[200px] max-w-[320px] gap-2 text-[12.5px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_JOBS}>All jobs</SelectItem>
          {(jobs.data ?? []).map((j) => (
            <SelectItem key={j.id} value={j.id}>
              {j.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {report.isFetching && !first && (
        <span role="status" aria-label="Refreshing" className="inline-flex h-4 w-4 items-center justify-center text-[#8B8F9E]">
          <span className="gio-spinner gio-spinner-current" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
        </span>
      )}
    </div>
  )

  const failed = (report.isError && !d) || timedOut

  return (
    <ListPage
      title="Self-identification"
      breadcrumb={[{ label: 'Analytics', to: '/analytics' }, { label: 'Self-identification' }]}
      meta={
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={13} aria-hidden /> Totals only. No names. Only admins can open this.
        </span>
      }
      actions={
        <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!d || d.applicants === 0}>
          Export CSV
        </Button>
      }
    >
      <div className="space-y-4">
        {filters}

        {failed ? (
          <div className="rounded-2xl border border-virgilio-border bg-white" style={{ padding: '56px 24px' }}>
            <LoadError
              what="the self-identification report"
              timedOut={timedOut && !report.isError}
              onRetry={() => {
                setRetry((n) => n + 1)
                void report.refetch()
              }}
            />
          </div>
        ) : !first && d && d.applicants === 0 ? (
          <div className="rounded-2xl border border-virgilio-border bg-white" style={{ padding: '40px 24px' }}>
            <AnimatedEmpty
              scene="search"
              title="No applications in this period"
              body="Only applications made through a careers form count here."
              primary={period !== 'all' ? { label: 'Show all time', onClick: () => setPeriod('all') } : undefined}
              secondary={job !== ALL_JOBS ? { label: 'All jobs', onClick: () => setJob(ALL_JOBS) } : undefined}
              onceKey="eeo-report-empty"
            />
          </div>
        ) : (
          <>
            <MetricStrip
              id="eeo-report"
              loading={first}
              items={[
                { label: 'Applicants', icon: Users, tone: 'purple', value: d?.applicants ?? 0 },
                { label: 'Answered at least one', icon: UserCheck, tone: 'green', value: d?.answered_any ?? 0 },
                { label: 'Declined every question', icon: UserX, tone: 'yellow', value: d?.declined_all ?? 0 },
                { label: "Didn't answer", icon: UserRound, tone: 'neutral', value: d?.not_answered ?? 0 },
              ]}
            />
            <p className="font-inter text-[12.5px] leading-[1.5] text-[#6B7080]">
              Applications made through a careers form in the period. Groups of fewer than {minGroup} people are hidden (shown as &lt;{minGroup}) so no one can be
              picked out. If someone applied more than once, their latest answers are used.
            </p>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {EEO_QUESTIONS.map((q) => (
                <ProfileCard key={q.id} title={q.title} icon={QUESTION_ICON[q.id]} tone="neutral" flush>
                  {first ? (
                    <div className="space-y-2 px-5 pb-5" aria-hidden>
                      {Array.from({ length: q.options.length + 1 }, (_, i) => (
                        <Skeleton key={i} className="h-[36px] w-full rounded-[8px]" />
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table density="compact">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[44%]">Answer</TableHead>
                            <TableHead className="text-right">Applicants</TableHead>
                            <TableHead className="text-right">Share</TableHead>
                            <TableHead className="text-right">Past review</TableHead>
                            <TableHead className="text-right">Offer</TableHead>
                            <TableHead className="text-right">Hired</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {answerRows(q.id, d).map((r) => {
                            const pct = share(r.applicants, d?.applicants ?? 0)
                            return (
                              <TableRow key={r.answer}>
                                <TableCell className="max-w-0">
                                  <span className="line-clamp-2 text-[12.5px] text-[#1F2230]">{r.label}</span>
                                </TableCell>
                                <TableCell className="text-right"><Cell v={r.applicants} minGroup={minGroup} /></TableCell>
                                <TableCell className="text-right text-[#5A6072]">{pct === null ? '—' : `${pct}%`}</TableCell>
                                <TableCell className="text-right"><Cell v={r.past_review} minGroup={minGroup} /></TableCell>
                                <TableCell className="text-right"><Cell v={r.offer} minGroup={minGroup} /></TableCell>
                                <TableCell className="text-right"><Cell v={r.hired} minGroup={minGroup} /></TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </ProfileCard>
              ))}
            </div>
          </>
        )}
      </div>
    </ListPage>
  )
}
