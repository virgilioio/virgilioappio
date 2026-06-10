/**
 * JobPipelineRow — collapsible job row for the Pipeline page.
 * Strict spec: 12×16 padding, radius 12, white card with hairline border.
 */
import { ChevronDown, ChevronRight, Building2, MapPin, Activity, ClockAlert, Moon, MoreHorizontal } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { Job } from '@/hooks/useJobs'
import { PipelineJobMetric } from '@/hooks/usePipelineJobMetrics'
import { StageFunnelBar, FunnelStage } from './StageFunnelBar'
import { InlineKanban } from './InlineKanban'
import { cn } from '@/lib/utils'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function shortRelative(iso?: string | null) {
  if (!iso) return '—'
  try {
    const s = formatDistanceToNowStrict(new Date(iso), { addSuffix: false })
    return s
      .replace('seconds', 's').replace('second', 's')
      .replace('minutes', 'm').replace('minute', 'm')
      .replace('hours', 'h').replace('hour', 'h')
      .replace('days', 'd').replace('day', 'd')
      .replace('months', 'mo').replace('month', 'mo')
      .replace('years', 'y').replace('year', 'y')
      .replace(/\s/g, ' ')
  } catch {
    return '—'
  }
}

export interface JobPipelineRowProps {
  job: Job
  metrics?: PipelineJobMetric
  expanded: boolean
  onToggle: () => void
  /** count of idle (>7d) candidates in this job, optional. */
  idleCount?: number
  /** days since last activity (job-level), to decide "quiet" flag. */
  quietDays?: number
}

export function JobPipelineRow({ job, metrics, expanded, onToggle, idleCount, quietDays }: JobPipelineRowProps) {
  const stages: FunnelStage[] =
    metrics?.stages?.map((s) => ({ id: s.stage_id, name: s.stage_name, count: s.count_in_stage })) ?? []
  const activeCount = metrics?.active_candidates ?? 0
  const Chevron = expanded ? ChevronDown : ChevronRight
  const team = (job.hiring_team_names || []).slice(0, 3)
  const showQuiet = (quietDays ?? 0) > 5 && (idleCount ?? 0) === 0

  return (
    <div
      className="rounded-[12px] bg-white"
      style={{ border: '1px solid #E7E8EE' }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 text-left hover:bg-[#FAFAF7] rounded-[12px] transition-colors"
        style={{ padding: '12px 16px' }}
      >
        <Chevron size={14} strokeWidth={2} color="#8B8F9E" className="shrink-0" />

        {/* Title block */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="truncate font-poppins text-[#0d0d09]"
              style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em' }}
            >
              {job.title}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-[1px] font-inter"
              style={{ fontSize: 10.5, background: '#D1FAE5', color: '#047857' }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#12B886' }} />
              {job.status === 'open' ? 'Open' : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </span>
            {!!idleCount && idleCount > 0 ? (
              <span
                className="inline-flex items-center gap-1 font-inter"
                style={{ fontSize: 10.5, color: '#B45309' }}
              >
                <ClockAlert size={11} strokeWidth={2} />
                {idleCount} idle &gt;7d
              </span>
            ) : showQuiet ? (
              <span
                className="inline-flex items-center gap-1 font-inter"
                style={{ fontSize: 10.5, color: '#8B8F9E' }}
              >
                <Moon size={11} strokeWidth={2} />
                quiet {quietDays}d
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-inter" style={{ fontSize: 11.5, color: '#8B8F9E' }}>
            {job.department ? (
              <span className="inline-flex items-center gap-1">
                <Building2 size={11} strokeWidth={2} /> {job.department}
              </span>
            ) : null}
            {job.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} strokeWidth={2} /> {job.location}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Activity size={11} strokeWidth={2} /> {shortRelative(job.updated_at)} ago
            </span>
          </div>
        </div>

        {/* Funnel */}
        <div onClick={(e) => e.stopPropagation()}>
          <StageFunnelBar stages={stages} />
        </div>

        {/* Active count */}
        <div className="flex shrink-0 flex-col items-end" style={{ minWidth: 44 }}>
          <span
            className="font-poppins tabular-nums"
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: activeCount === 0 ? '#B5B9C4' : '#0d0d09',
              lineHeight: 1.1,
            }}
          >
            {activeCount}
          </span>
          <span className="font-inter" style={{ fontSize: 10, color: '#8B8F9E' }}>
            active
          </span>
        </div>

        {/* Avatar stack */}
        <div className="flex shrink-0 -space-x-1.5">
          {team.length === 0 ? (
            <span
              className="flex items-center justify-center rounded-full font-poppins"
              style={{ width: 22, height: 22, background: '#F1F0EC', color: '#8B8F9E', fontSize: 9, fontWeight: 600 }}
            >
              –
            </span>
          ) : (
            team.map((n, i) => (
              <span
                key={i}
                className="flex items-center justify-center rounded-full font-poppins"
                style={{
                  width: 22,
                  height: 22,
                  background: ['#EDE4FF', '#D1FAE5', '#DBEAFE'][i % 3],
                  color: ['#5B21B6', '#047857', '#1D4ED8'][i % 3],
                  fontSize: 9,
                  fontWeight: 600,
                  border: '2px solid white',
                }}
                title={n}
              >
                {initials(n)}
              </span>
            ))
          )}
        </div>

        {/* More */}
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Job actions"
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md text-[#8B8F9E] hover:bg-[#F1F0EC]',
          )}
          style={{ width: 28, height: 28, border: '1px solid #E7E8EE' }}
        >
          <MoreHorizontal size={14} strokeWidth={2} />
        </button>
      </button>

      {expanded ? <InlineKanban jobId={job.id} /> : null}
    </div>
  )
}
