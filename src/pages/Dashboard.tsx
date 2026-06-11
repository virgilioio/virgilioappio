/**
 * Dashboard — "The Queue".
 * One prioritized work feed (left) + today rail (right). Strict spec.
 */
import { ReactNode, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  Inbox,
  ClipboardCheck,
  GitBranch,
  Mail,
  FileText,
  Calendar as CalendarIcon,
  Briefcase,
  Video,
  Check,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import { format } from 'date-fns'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'
import { useOrgContext } from '@/contexts/OrgContext'
import { WorkspaceProvisioningLoader } from '@/components/onboarding/WorkspaceProvisioningLoader'
import { useReportSplashReady } from '@/contexts/SplashReadyContext'
import { usePendingActivities, PendingActivity } from '@/hooks/usePendingActivities'
import { useStaleCandidates } from '@/hooks/useStaleCandidates'
import { useScheduledBookings, ScheduledBooking } from '@/hooks/useScheduledBookings'
import { useJobs } from '@/hooks/useJobs'
import { usePipelineJobMetrics } from '@/hooks/usePipelineJobMetrics'
import { useNewApplicationsQueue } from '@/hooks/useNewApplicationsQueue'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

// ─── Color tokens (page-local; matches global tokens) ───────────────
const C = {
  pageBg: '#F6F5F1',
  card: '#FFFFFF',
  border: '#E7E8EE',
  hairline: '#F1F0EC',
  ink: '#0d0d09',
  ink2: '#1F2230',
  muted: '#5A6072',
  tertiary: '#8B8F9E',
  disabled: '#B5B9C4',
  purple: '#6F3FF5',
  purpleLight: '#EDE4FF',
  purpleBorder: '#D7C5FB',
  purpleText: '#5B21B6',
  green: '#12B886',
  amberText: '#B45309',
  amberBg: '#FEF3C7',
  redText: '#DC2626',
  redBg: '#FEE2E2',
} as const

// ─── Types ──────────────────────────────────────────────────────────
type QueueType = 'scorecard' | 'decision' | 'reply' | 'application'
type Urgency = 'overdue' | 'today' | 'normal'

interface QueueItem {
  id: string
  type: QueueType
  label: string
  candidateName: string
  candidateId: string
  context: string // job — extra
  href: string
  urgency: Urgency
  urgencyLabel: string
  sortRank: number // lower = more urgent
  emailId?: string
}

// ─── Helpers ────────────────────────────────────────────────────────
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function daysSince(iso?: string | null): number {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

function hoursSince(iso?: string | null): number {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000))
}

function greetingFor(d: Date) {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function urgencyChipColors(u: Urgency) {
  if (u === 'overdue') return { color: C.redText, bg: C.redBg }
  if (u === 'today') return { color: C.amberText, bg: C.amberBg }
  return { color: C.muted, bg: C.hairline }
}

function isMeetingUrl(s: string | null | undefined): boolean {
  if (!s) return false
  return /^https?:\/\//i.test(s) || /(zoom|meet|teams|whereby)/i.test(s)
}

// ─── Build queue items from raw data ─────────────────────────────────
function buildQueue(
  activities: PendingActivity[] | undefined,
  apps: ReturnType<typeof useNewApplicationsQueue>['data'],
): QueueItem[] {
  const out: QueueItem[] = []

  for (const a of activities ?? []) {
    if (a.type === 'scorecard') {
      const d = daysSince(a.timestamp)
      const urgency: Urgency = d >= 1 ? 'overdue' : 'today'
      out.push({
        id: `s-${a.id}`,
        type: 'scorecard',
        label: 'Scorecard due',
        candidateName: a.candidateName,
        candidateId: a.candidateId,
        context: a.jobTitle ? `${a.jobTitle} — interviewed ${d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`}` : '',
        href: `/jobs/${a.jobId}?candidate=${a.candidateId}&open=scorecard&stage=${a.stageInstanceId ?? ''}`,
        urgency,
        urgencyLabel: urgency === 'overdue' ? `${d}d overdue` : 'due today',
        sortRank: urgency === 'overdue' ? 0 - d * 0.01 : 1,
      })
    } else if (a.type === 'decision') {
      const d = daysSince(a.timestamp)
      const urgency: Urgency = d >= 14 ? 'overdue' : d >= 1 ? 'today' : 'normal'
      out.push({
        id: `d-${a.id}`,
        type: 'decision',
        label: 'Stage decision',
        candidateName: a.candidateName,
        candidateId: a.candidateId,
        context: `${a.jobTitle ?? ''} — ${d > 0 ? `${d} days` : 'today'} in ${a.stageName ?? 'Stage'}`,
        href: `/jobs/${a.jobId}?candidate=${a.candidateId}`,
        urgency,
        urgencyLabel: d >= 7 ? `stuck ${d}d` : d > 0 ? `waiting ${d}d` : 'today',
        sortRank: urgency === 'overdue' ? -0.5 - d * 0.01 : urgency === 'today' ? 1.5 : 2.5,
      })
    } else if (a.type === 'email') {
      const h = hoursSince(a.timestamp)
      const d = Math.floor(h / 24)
      const urgency: Urgency = d >= 2 ? 'overdue' : d >= 1 ? 'today' : 'normal'
      const waitLabel = d >= 1 ? `waiting ${d}d` : `waiting ${Math.max(1, h)}h`
      out.push({
        id: `e-${a.id}`,
        type: 'reply',
        label: 'Reply needed',
        candidateName: a.candidateName,
        candidateId: a.candidateId,
        context: `${a.jobTitle ?? ''}${a.emailSubject ? ` — ${a.emailSubject}` : ''}`,
        href: `/jobs/${a.jobId}?candidate=${a.candidateId}&tab=communications`,
        urgency,
        urgencyLabel: waitLabel,
        sortRank: urgency === 'overdue' ? -0.4 - d * 0.01 : urgency === 'today' ? 1.4 : 2.4,
        emailId: a.emailId,
      })
    }
  }

  for (const app of apps ?? []) {
    const d = daysSince(app.enteredAt)
    const urgency: Urgency = d >= 5 ? 'overdue' : d >= 2 ? 'today' : 'normal'
    out.push({
      id: `a-${app.associationId}`,
      type: 'application',
      label: 'New application',
      candidateName: app.candidateName,
      candidateId: app.candidateId,
      context: `${app.jobTitle} — applied${app.source ? ` via ${app.source}` : ''}`,
      href: `/jobs/${app.jobId}?candidate=${app.candidateId}`,
      urgency,
      urgencyLabel: d === 0 ? 'just now' : `${d}d in queue`,
      sortRank: urgency === 'overdue' ? -0.3 - d * 0.01 : urgency === 'today' ? 1.6 : 2.6,
    })
  }

  return out.sort((a, b) => a.sortRank - b.sortRank)
}

// ─── Page ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { profile, isLoading: profileLoading } = useUserProfile()
  const permissions = usePermissions()
  const { isLoading: orgLoading, hasOrganizationContext } = useOrgContext()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: pending, isLoading: pendingLoading } = usePendingActivities()
  const { data: stale } = useStaleCandidates()
  const { data: newApps, isLoading: appsLoading } = useNewApplicationsQueue()
  const { bookings: todayBookings, isLoading: bookingsLoading } =
    useScheduledBookings('upcoming', permissions)
  const { jobs, isLoading: jobsLoading } = useJobs()
  const openJobs = useMemo(() => (jobs ?? []).filter(j => j.status === 'open'), [jobs])
  const { data: jobMetrics } = usePipelineJobMetrics(openJobs.map(j => j.id))

  const queue = useMemo(() => buildQueue(pending, newApps), [pending, newApps])
  const [filter, setFilter] = useState<'all' | QueueType>('all')
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())

  const counts = useMemo(() => {
    const c = { all: queue.length, scorecard: 0, decision: 0, reply: 0, application: 0 }
    for (const q of queue) c[q.type] += 1
    return c
  }, [queue])

  const filtered = filter === 'all' ? queue : queue.filter(q => q.type === filter)

  // Today's bookings (between now and end-of-day)
  const todayList = useMemo(() => {
    const now = new Date()
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return (todayBookings ?? [])
      .filter(b => b.status !== 'cancelled')
      .filter(b => {
        const t = new Date(b.scheduled_start).getTime()
        return t >= now.getTime() - 30 * 60_000 && t <= end.getTime()
      })
      .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
  }, [todayBookings])

  const nextEventId = todayList[0]?.id

  // Free evening nudge
  const freeAfter = useMemo(() => {
    if (todayList.length === 0) return null
    const last = todayList[todayList.length - 1]
    const lastEnd = new Date(last.scheduled_end)
    const cutoff = new Date()
    cutoff.setHours(17, 0, 0, 0)
    if (lastEnd <= cutoff) return '17:00'
    const h = lastEnd.getHours()
    const m = lastEnd.getMinutes()
    if (h >= 19) return null
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }, [todayList])

  useReportSplashReady(!orgLoading && hasOrganizationContext && !profileLoading)

  if (orgLoading || !hasOrganizationContext) {
    return <WorkspaceProvisioningLoader status="finalizing" />
  }
  if (permissions.isSalesUser) return <Navigate to="/crm/deals" replace />

  // ─── Digest ────────────────────────────────────────────────
  const scorecardCount = counts.scorecard
  const decisionCount = counts.decision
  const interviewsToday = todayList.length
  const stuckLong = (stale ?? []).filter(s => s.daysInStage >= 21)
  const stuckByJob = stuckLong.reduce<Record<string, number>>((acc, s) => {
    acc[s.jobTitle] = (acc[s.jobTitle] ?? 0) + 1
    return acc
  }, {})
  const topStuckJob = Object.entries(stuckByJob).sort((a, b) => b[1] - a[1])[0]

  // ─── Toggle done ────────────────────────────────────────────
  const toggleDone = (item: QueueItem) => {
    setDoneIds(prev => {
      const next = new Set(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
    // Optimistic email-read for reply rows
    if (item.type === 'reply' && item.emailId && !doneIds.has(item.id)) {
      void supabase
        .from('email_logs')
        .update({ read_at: new Date().toISOString() })
        .eq('id', item.emailId)
        .then(() => queryClient.invalidateQueries({ queryKey: ['pending-activities'] }))
    }
  }

  const firstName = profile?.first_name ?? 'there'
  const today = new Date()
  const dateLine = format(today, 'EEEE, MMMM d')

  const queueLoading = pendingLoading || appsLoading

  return (
    <div style={{ background: C.pageBg, minHeight: '100%', padding: '24px 28px' }}>
      {/* Greeting */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ font: '500 11.5px/1.4 Inter', color: C.tertiary }}>{dateLine}</div>
        <h1
          style={{
            font: '600 26px/1.15 Poppins',
            letterSpacing: '-0.03em',
            color: C.ink,
            margin: '4px 0 6px',
          }}
        >
          {greetingFor(today)}, {firstName}
          <span style={{ color: C.purpleBorder }}>.</span>
        </h1>
        <p style={{ font: '400 13.5px/1.5 Inter', color: C.muted, margin: 0 }}>
          You have{' '}
          <strong style={{ color: C.ink, fontWeight: 600 }}>
            {scorecardCount} {scorecardCount === 1 ? 'scorecard' : 'scorecards'} due
          </strong>
          ,{' '}
          <strong style={{ color: C.ink, fontWeight: 600 }}>
            {decisionCount} stage {decisionCount === 1 ? 'decision' : 'decisions'} waiting
          </strong>{' '}
          and{' '}
          <strong style={{ color: C.ink, fontWeight: 600 }}>
            {interviewsToday} {interviewsToday === 1 ? 'interview' : 'interviews'}
          </strong>{' '}
          today.
          {topStuckJob ? (
            <>
              {' '}
              {topStuckJob[1]} {topStuckJob[1] === 1 ? 'candidate' : 'candidates'} in{' '}
              {topStuckJob[0]} {topStuckJob[1] === 1 ? 'has' : 'have'} been stuck for 3+ weeks.
            </>
          ) : null}
        </p>
      </div>

      {/* Two-column grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {/* LEFT: Queue card */}
        <QueueCard
          counts={counts}
          filter={filter}
          onFilter={setFilter}
          items={filtered}
          loading={queueLoading}
          doneIds={doneIds}
          onToggleDone={toggleDone}
          onRowClick={(href) => navigate(href)}
        />

        {/* RIGHT rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TodayCard
            bookings={todayList}
            isLoading={bookingsLoading}
            nextEventId={nextEventId}
            freeAfter={freeAfter}
            onFullCalendar={() => navigate('/calendar')}
            onRowClick={(b) => {
              if (b.job_id && b.candidate_id) {
                navigate(`/jobs/${b.job_id}?candidate=${b.candidate_id}`)
              }
            }}
          />
          <OpenJobsCard
            jobs={openJobs}
            metrics={jobMetrics ?? []}
            stale={stale ?? []}
            isLoading={jobsLoading}
            onPipeline={() => navigate('/pipeline')}
            onJobClick={(id) => navigate(`/jobs/${id}`)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Queue Card ──────────────────────────────────────────────────────

interface QueueCardProps {
  counts: { all: number; scorecard: number; decision: number; reply: number; application: number }
  filter: 'all' | QueueType
  onFilter: (f: 'all' | QueueType) => void
  items: QueueItem[]
  loading: boolean
  doneIds: Set<string>
  onToggleDone: (item: QueueItem) => void
  onRowClick: (href: string) => void
}

function QueueCard({ counts, filter, onFilter, items, loading, doneIds, onToggleDone, onRowClick }: QueueCardProps) {
  const chips: { id: 'all' | QueueType; label: string; count: number }[] = [
    { id: 'all', label: 'Everything', count: counts.all },
    { id: 'scorecard', label: 'Scorecards', count: counts.scorecard },
    { id: 'decision', label: 'Decisions', count: counts.decision },
    { id: 'reply', label: 'Replies', count: counts.reply },
    { id: 'application', label: 'Applications', count: counts.application },
  ]
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 0 }}>
      {/* Header */}
      <div
        style={{
          padding: '14px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <Inbox size={14} strokeWidth={2} color={C.muted} />
        <span style={{ font: '600 13px/1 Poppins', color: C.ink }}>Your queue</span>
        <span
          style={{
            font: '600 11px/1 Inter',
            color: C.tertiary,
            background: C.hairline,
            padding: '3px 8px',
            borderRadius: 999,
          }}
        >
          {counts.all}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {chips.map(c => {
            const active = filter === c.id
            return (
              <button
                key={c.id}
                onClick={() => onFilter(c.id)}
                style={{
                  height: 28,
                  padding: '0 12px',
                  borderRadius: 999,
                  border: `1px solid ${active ? C.ink : C.border}`,
                  background: active ? C.ink : '#fff',
                  color: active ? '#fffcf9' : C.ink2,
                  font: '500 12px/1 Inter',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  transition: 'background 140ms, color 140ms, border-color 140ms',
                }}
              >
                {c.label}
                <span style={{ fontSize: 10.5, opacity: 0.75 }}>{c.count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <QueueSkeleton />
      ) : items.length === 0 ? (
        <EmptyQueue />
      ) : (
        <div>
          {items.map((item, idx) => (
            <QueueRow
              key={item.id}
              item={item}
              isDone={doneIds.has(item.id)}
              isLast={idx === items.length - 1}
              onToggleDone={() => onToggleDone(item)}
              onClick={() => onRowClick(item.href)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '12px 16px', textAlign: 'center', borderTop: `1px solid ${C.hairline}` }}>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); onFilter('all') }}
          style={{
            font: '500 11.5px/1 Inter',
            color: C.purple,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Open all tasks <ArrowRight size={11} strokeWidth={2} />
        </a>
      </div>
    </div>
  )
}

function QueueRow({
  item,
  isDone,
  isLast,
  onToggleDone,
  onClick,
}: {
  item: QueueItem
  isDone: boolean
  isLast: boolean
  onToggleDone: () => void
  onClick: () => void
}) {
  const TypeIcon = (
    item.type === 'scorecard' ? ClipboardCheck :
    item.type === 'decision' ? GitBranch :
    item.type === 'reply' ? Mail : FileText
  )
  const urgencyColors = urgencyChipColors(item.urgency)

  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-checkbox]')) return
        onClick()
      }}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '11px 16px',
        borderBottom: isLast ? 'none' : `1px solid ${C.hairline}`,
        opacity: isDone ? 0.45 : 1,
        transition: 'opacity 250ms ease',
        cursor: 'pointer',
      }}
    >
      {/* Checkbox */}
      <button
        data-checkbox
        onClick={onToggleDone}
        aria-label={isDone ? 'Mark not done' : 'Mark done'}
        style={{
          width: 18,
          height: 18,
          borderRadius: 6,
          border: `1.5px solid ${isDone ? C.green : '#D2D4DC'}`,
          background: isDone ? C.green : '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {isDone ? <Check size={11} strokeWidth={3} color="#fff" /> : null}
      </button>

      {/* Type icon chip */}
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: C.pageBg,
          color: C.muted,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <TypeIcon size={13} strokeWidth={2} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: '600 12.5px/1.35 Inter',
            color: C.ink2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {item.label}
          <span style={{ color: C.muted, fontWeight: 400 }}> · {item.candidateName}</span>
        </div>
        <div
          style={{
            font: '400 11px/1.4 Inter',
            color: C.tertiary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: 2,
          }}
        >
          {item.context}
        </div>
      </div>

      {/* Urgency */}
      <span
        style={{
          font: '600 10.5px/1 Inter',
          padding: '2px 8px',
          borderRadius: 999,
          color: urgencyColors.color,
          background: urgencyColors.bg,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {item.urgencyLabel}
      </span>

      {/* Avatar */}
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: C.purpleLight,
          color: C.purpleText,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: '600 9px/1 Poppins',
          flexShrink: 0,
        }}
      >
        {initials(item.candidateName)}
      </div>
    </div>
  )
}

function QueueSkeleton() {
  return (
    <div>
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            padding: '11px 16px',
            borderBottom: i === 3 ? 'none' : `1px solid ${C.hairline}`,
          }}
        >
          <div style={{ width: 18, height: 18, borderRadius: 6, background: C.hairline }} />
          <div style={{ width: 26, height: 26, borderRadius: 8, background: C.hairline }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: '50%', height: 11, background: C.hairline, borderRadius: 4 }} />
            <div style={{ width: '35%', height: 9, background: C.hairline, borderRadius: 4, marginTop: 6 }} />
          </div>
          <div style={{ width: 60, height: 16, background: C.hairline, borderRadius: 999 }} />
          <div style={{ width: 22, height: 22, borderRadius: 999, background: C.hairline }} />
        </div>
      ))}
    </div>
  )
}

function EmptyQueue() {
  return (
    <div style={{ padding: '48px 16px', textAlign: 'center' }}>
      <CheckCircle2 size={18} strokeWidth={2} color={C.green} style={{ margin: '0 auto 8px' }} />
      <div style={{ font: '400 12.5px/1.4 Inter', color: C.tertiary }}>
        All clear — nothing needs you right now.
      </div>
    </div>
  )
}

// ─── Today Card ──────────────────────────────────────────────────────

interface TodayCardProps {
  bookings: ScheduledBooking[]
  isLoading: boolean
  nextEventId?: string
  freeAfter: string | null
  onFullCalendar: () => void
  onRowClick: (b: ScheduledBooking) => void
}

function TodayCard({ bookings, isLoading, nextEventId, freeAfter, onFullCalendar, onRowClick }: TodayCardProps) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <div
        style={{
          padding: '14px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <CalendarIcon size={14} strokeWidth={2} color={C.muted} />
        <span style={{ font: '600 13px/1 Poppins', color: C.ink }}>Today</span>
        <span
          style={{
            font: '600 11px/1 Inter',
            color: C.tertiary,
            background: C.hairline,
            padding: '3px 8px',
            borderRadius: 999,
          }}
        >
          {bookings.length}
        </span>
        <button
          onClick={onFullCalendar}
          style={{
            marginLeft: 'auto',
            font: '500 11.5px/1 Inter',
            color: C.purple,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: 0,
          }}
        >
          Full calendar <ArrowRight size={11} strokeWidth={2} />
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: '16px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 44, background: C.hairline, borderRadius: 6, marginBottom: 8 }} />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', font: '400 12px/1.4 Inter', color: C.tertiary }}>
          No events today.
        </div>
      ) : (
        bookings.map((b, idx) => {
          const isNext = b.id === nextEventId
          const start = new Date(b.scheduled_start)
          const timeLabel = format(start, 'HH:mm')
          const candidateName = b.candidate?.candidate_name || b.candidate_name || 'Unknown'
          const showJoin = isNext && isMeetingUrl(b.meeting_location)
          return (
            <div
              key={b.id}
              onClick={() => onRowClick(b)}
              style={{
                display: 'flex',
                gap: 12,
                padding: '10px 16px',
                borderTop: `1px solid ${C.hairline}`,
                cursor: 'pointer',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ width: 42, textAlign: 'right', flexShrink: 0 }}>
                <div
                  style={{
                    font: '600 12.5px/1.2 Poppins',
                    color: isNext ? C.purple : C.ink,
                  }}
                >
                  {timeLabel}
                </div>
                <div style={{ font: '400 9.5px/1 Inter', color: C.disabled, marginTop: 2 }}>
                  {b.duration_minutes} min
                </div>
              </div>
              <div
                style={{
                  width: 3,
                  alignSelf: 'stretch',
                  borderRadius: 2,
                  background: isNext ? C.purple : C.border,
                  flexShrink: 0,
                  minHeight: 30,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    font: '600 12px/1.35 Inter',
                    color: C.ink2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {candidateName}
                </div>
                <div
                  style={{
                    font: '400 11px/1.35 Inter',
                    color: C.tertiary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: 2,
                  }}
                >
                  {b.job?.title ?? (b.notes ? b.notes : '—')}
                </div>
                {showJoin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(b.meeting_location!, '_blank')
                    }}
                    style={{
                      marginTop: 6,
                      height: 24,
                      padding: '0 10px',
                      borderRadius: 7,
                      background: C.purpleLight,
                      color: C.purpleText,
                      border: 'none',
                      font: '600 11px/1 Inter',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Video size={11} strokeWidth={2} /> Join
                  </button>
                )}
              </div>
            </div>
          )
        })
      )}

      {freeAfter && (
        <div
          style={{
            padding: '9px 16px',
            borderTop: `1px solid ${C.hairline}`,
            font: '400 11px/1.4 Inter',
            color: C.tertiary,
          }}
        >
          Free after {freeAfter} — good slot for scorecards.
        </div>
      )}
    </div>
  )
}

// ─── Open Jobs Card ──────────────────────────────────────────────────

interface OpenJobsCardProps {
  jobs: ReturnType<typeof useJobs>['jobs']
  metrics: ReturnType<typeof usePipelineJobMetrics>['data']
  stale: ReturnType<typeof useStaleCandidates>['data'] extends infer T ? (T extends undefined ? never : T) : never
  isLoading: boolean
  onPipeline: () => void
  onJobClick: (id: string) => void
}

function OpenJobsCard({ jobs, metrics, stale, isLoading, onPipeline, onJobClick }: OpenJobsCardProps) {
  const list = jobs ?? []
  const metricsById = new Map((metrics ?? []).map(m => [m.job_id, m]))
  const stuckByJob = (stale ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.jobId] = (acc[s.jobId] ?? 0) + 1
    return acc
  }, {})

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <div
        style={{
          padding: '14px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Briefcase size={14} strokeWidth={2} color={C.muted} />
        <span style={{ font: '600 13px/1 Poppins', color: C.ink }}>Open jobs</span>
        <span
          style={{
            font: '600 11px/1 Inter',
            color: C.tertiary,
            background: C.hairline,
            padding: '3px 8px',
            borderRadius: 999,
          }}
        >
          {list.length}
        </span>
        <button
          onClick={onPipeline}
          style={{
            marginLeft: 'auto',
            font: '500 11.5px/1 Inter',
            color: C.purple,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: 0,
          }}
        >
          Pipeline <ArrowRight size={11} strokeWidth={2} />
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: 16 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 36, background: C.hairline, borderRadius: 6, marginBottom: 8 }} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', font: '400 12px/1.4 Inter', color: C.tertiary }}>
          No open jobs.
        </div>
      ) : (
        list.map((j, idx) => {
          const m = metricsById.get(j.id)
          const active = m?.active_candidates ?? 0
          const stuckCount = stuckByJob[j.id] ?? 0
          const quietDays = daysSince(j.updated_at)
          const isQuiet = quietDays >= 6 && active === 0
          const dotColor = stuckCount > 0 ? '#D97706' : isQuiet ? C.disabled : C.green
          const topStage = (m?.stages ?? []).slice().sort((a, b) => b.count_in_stage - a.count_in_stage)[0]
          const contextParts: string[] = []
          if (topStage) contextParts.push(`most in ${topStage.stage_name}`)
          if (stuckCount > 0) contextParts.push(`${stuckCount} stuck`)
          else if (isQuiet) contextParts.push(`quiet ${quietDays}d`)
          return (
            <div
              key={j.id}
              onClick={() => onJobClick(j.id)}
              style={{
                display: 'flex',
                gap: 10,
                padding: '8px 16px',
                alignItems: 'center',
                borderTop: `1px solid ${C.hairline}`,
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: dotColor,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    font: '500 12px/1.35 Inter',
                    color: C.ink2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {j.title}
                </div>
                <div
                  style={{
                    font: '400 10.5px/1.4 Inter',
                    color: C.tertiary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: 2,
                  }}
                >
                  {contextParts.join(' · ') || '—'}
                </div>
              </div>
              <span
                style={{
                  font: '600 13px/1 Poppins',
                  color: active === 0 ? C.disabled : C.ink,
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {active}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}
