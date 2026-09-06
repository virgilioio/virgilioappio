import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarCheck2, ChevronDown, Users } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { AvatarStack } from '@/components/ui/table-cells'
import { cn } from '@/lib/utils'
import AttendeeDetailsBlock, { isBookingActionable } from './primitives/AttendeeDetailsBlock'
import type { PlanStageOption } from './ProfileStageStrip'

interface InterviewHistoryCardProps {
  candidateId: string
  jobId: string
  stages: PlanStageOption[]
  candidateEmail?: string | null
  candidatePhone?: string | null
}

interface PastBooking {
  id: string
  scheduled_start: string
  scheduled_end: string
  title?: string | null
  event_title?: string | null
  candidate_email?: string | null
  candidate_phone?: string | null
  candidate_name?: string | null
  notes?: string | null
  interviewer_id?: string | null
  job_hiring_stage_id?: string | null
  job_id?: string | null
  job_candidate_association_id?: string | null
}

interface Interviewer {
  user_id: string
  name: string
  src: string | null
}

interface EnrichedBooking extends PastBooking {
  interviewers: Interviewer[]
  scorecardCount: number
}

function fmtMonth(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTimeLine(startIso: string, endIso: string) {
  const s = new Date(startIso)
  const e = new Date(endIso)
  const dur = Math.round((e.getTime() - s.getTime()) / 60000)
  const day = s.toLocaleDateString(undefined, { weekday: 'short' })
  const time = s.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}${dur > 0 ? ` · ${dur} min` : ''}`
}

export function InterviewHistoryCard({
  candidateId,
  jobId,
  stages,
  candidateEmail,
  candidatePhone,
}: InterviewHistoryCardProps) {
  const nowIso = useMemo(() => new Date().toISOString(), [])

  const { data } = useQuery({
    queryKey: ['interview-history', candidateId, jobId],
    enabled: !!candidateId && !!jobId,
    queryFn: async (): Promise<EnrichedBooking[]> => {
      const { data: rows, error } = await supabase
        .from('scheduled_bookings')
        .select('*')
        .eq('candidate_id', candidateId)
        .eq('status', 'confirmed')
        .lt('scheduled_end', nowIso)
        .order('scheduled_start', { ascending: false })
      if (error) throw error
      if (!rows) return []

      // Filter to this job (either by job_id, or by matching a jhs in our stages list)
      const stageJhsIds = new Set(stages.map(s => s.jhsId))
      const filtered = (rows as PastBooking[]).filter(b => {
        if (b.job_id && b.job_id === jobId) return true
        if (b.job_hiring_stage_id && stageJhsIds.has(b.job_hiring_stage_id)) return true
        return false
      })
      if (filtered.length === 0) return []

      const bookingIds = filtered.map(b => b.id)

      // Attendees
      const { data: attendees } = await supabase
        .from('scheduled_booking_attendees')
        .select('booking_id, user_id')
        .in('booking_id', bookingIds)

      const interviewerIdsByBooking = new Map<string, Set<string>>()
      for (const b of filtered) {
        const set = new Set<string>()
        if (b.interviewer_id) set.add(b.interviewer_id)
        interviewerIdsByBooking.set(b.id, set)
      }
      for (const a of attendees || []) {
        const set = interviewerIdsByBooking.get(a.booking_id)
        if (set && a.user_id) set.add(a.user_id)
      }

      const allUserIds = [...new Set([...interviewerIdsByBooking.values()].flatMap(s => [...s]))]

      const { data: profiles } = allUserIds.length
        ? await supabase
            .from('profiles')
            .select('user_id, first_name, last_name, email, avatar_url')
            .in('user_id', allUserIds)
        : { data: [] as any[] }
      const profilesMap = new Map((profiles || []).map(p => [p.user_id, p]))

      // Scorecards per (association, stage_instance)
      const associationIds = [...new Set(filtered.map(b => b.job_candidate_association_id).filter(Boolean))]
      const stageInstIds = [...new Set(filtered.map(b => b.job_hiring_stage_id).filter(Boolean))]
      let scorecardCountByStage = new Map<string, number>()
      if (associationIds.length > 0 && stageInstIds.length > 0) {
        const { data: sc } = await supabase
          .from('job_stage_scorecards')
          .select('association_id, stage_instance_id')
          .in('association_id', associationIds as string[])
          .in('stage_instance_id', stageInstIds as string[])
          .eq('is_ai_draft', false)
        for (const r of sc || []) {
          const key = r.stage_instance_id as string
          scorecardCountByStage.set(key, (scorecardCountByStage.get(key) ?? 0) + 1)
        }
      }

      return filtered.map(b => {
        const ids = interviewerIdsByBooking.get(b.id) || new Set<string>()
        const interviewers: Interviewer[] = [...ids].map(uid => {
          const p = profilesMap.get(uid)
          const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() || p?.email || 'Unknown'
          return { user_id: uid, name, src: p?.avatar_url ?? null }
        })
        return {
          ...b,
          interviewers,
          scorecardCount: b.job_hiring_stage_id ? scorecardCountByStage.get(b.job_hiring_stage_id) ?? 0 : 0,
        }
      })
    },
  })

  const grouped = useMemo(() => {
    if (!data || data.length === 0) return []
    // Group by jhsId; keep insertion order = most recent first
    const stageMap = new Map(stages.map(s => [s.jhsId, s]))
    const groups = new Map<string, { key: string; stageName: string; position: number; events: EnrichedBooking[] }>()
    for (const b of data) {
      const key = b.job_hiring_stage_id || 'unknown'
      const stage = key !== 'unknown' ? stageMap.get(key) : undefined
      const stageName = stage?.stage.stage_name || 'Other'
      if (!groups.has(key)) {
        groups.set(key, { key, stageName, position: stage?.position ?? -1, events: [] })
      }
      groups.get(key)!.events.push(b)
    }
    // Sort groups by most recent event within them
    return [...groups.values()].sort((a, b) => {
      const ta = new Date(a.events[0].scheduled_start).getTime()
      const tb = new Date(b.events[0].scheduled_start).getTime()
      return tb - ta
    })
  }, [data, stages])

  const totalEvents = data?.length ?? 0
  const stageCount = grouped.length

  if (totalEvents === 0) return null

  return (
    <section className="bg-white border border-virgilio-border rounded-2xl shadow-sm p-3">
      <div className="mb-3 px-2 pt-1">
        <h3 className="font-poppins font-semibold text-[15px] tracking-[-0.01em] text-text-primary">
          Interview history
        </h3>
        <p className="mt-1 text-[12.5px] text-text-tertiary font-poppins">
          {totalEvents} completed · across {stageCount} {stageCount === 1 ? 'stage' : 'stages'}
        </p>
      </div>

      <div className="space-y-3">
        {grouped.map((group) => {
          const lastCompleted = group.events[0].scheduled_end
          return (
            <div key={group.key}>
              {/* Stage header row */}
              <div className="flex items-center gap-3 mb-2.5">
                <span
                  className="font-inter text-[10.5px] font-semibold uppercase text-[#8B8F9E] whitespace-nowrap"
                  style={{ letterSpacing: '0.07em' }}
                >
                  {group.stageName}
                </span>
                <div className="flex-1 h-px bg-[#F1F0EC]" />
                <span className="font-inter text-[11px] text-[#B5B9C4] whitespace-nowrap">
                  Completed {fmtDate(lastCompleted)} · {group.events.length} event{group.events.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-2">
                {group.events.map((ev) => (
                  <PastEventRow
                    key={ev.id}
                    ev={ev}
                    candidateId={candidateId}
                    candidateEmail={candidateEmail}
                    candidatePhone={candidatePhone}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PastEventRow({
  ev,
  candidateId,
  candidateEmail,
  candidatePhone,
}: {
  ev: EnrichedBooking
  candidateId: string
  candidateEmail?: string | null
  candidatePhone?: string | null
}) {
  const actionable = isBookingActionable({
    bookingCandidateEmail: ev.candidate_email,
    bookingCandidatePhone: ev.candidate_phone,
    profileEmail: candidateEmail,
    profilePhone: candidatePhone,
  })
  const [expanded, setExpanded] = useState(false)

  const start = new Date(ev.scheduled_start)
  const title = ev.title || ev.event_title || 'Interview'

  return (
    <div className="rounded-[9px] border border-[#EDECE6] bg-white overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
        {/* Left: PAST EVENT tile */}
        <div className="rounded-[9px] bg-[#FBFAF7] p-3">
          <div className="font-inter text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8F9E] mb-1.5">
            Past event
          </div>
          <div className="flex items-start gap-[9px]">
            <div className="relative shrink-0">
              <div className="flex flex-col items-center justify-center bg-[#F1F0EC] text-[#5A6072] rounded-[9px] h-[38px] w-[38px]">
                <span className="font-poppins text-[9px] font-semibold tracking-[0.08em] opacity-80 leading-none">
                  {fmtMonth(start)}
                </span>
                <span className="font-poppins font-bold text-[15px] leading-none mt-[3px]">
                  {start.getDate()}
                </span>
              </div>
              <div
                className="absolute -bottom-1 -right-1 h-[16px] w-[16px] rounded-full bg-[#0B7A57] flex items-center justify-center"
                style={{ boxShadow: '0 0 0 2px #fff' }}
                aria-label="Completed"
              >
                <CalendarCheck2 className="h-2.5 w-2.5 text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-inter font-medium text-[12.5px] text-[#1F2230] truncate">
                {title}
              </div>
              <div className="mt-px font-inter text-[11px] text-[#8B8F9E]">
                {fmtTimeLine(ev.scheduled_start, ev.scheduled_end)}
              </div>
            </div>
          </div>
        </div>

        {/* Right: INTERVIEWERS tile */}
        <div className="rounded-[9px] bg-[#FBFAF7] p-3">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="font-inter text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8F9E]">
              Interviewers
            </div>
            {actionable && (
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="inline-flex items-center gap-1 h-[20px] px-1.5 rounded-md hover:bg-[#FFFBF2] transition-colors"
              >
                <AlertTriangle className="h-3 w-3 text-[#B45309]" />
                <span className="font-inter text-[11px] font-semibold text-[#B45309]">
                  Review booking
                </span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 text-[#B45309] transition-transform',
                    expanded && 'rotate-180',
                  )}
                />
              </button>
            )}
          </div>
          {ev.interviewers.length > 0 ? (
            <div className="flex items-center gap-3">
              <AvatarStack
                people={ev.interviewers.map(i => ({ name: i.name, src: i.src, fallback: i.name }))}
                size={26}
                max={4}
              />
              <div className="min-w-0">
                <div className="font-poppins font-medium text-[13px] text-[#1F2230]">
                  {ev.interviewers.length} {ev.interviewers.length === 1 ? 'panelist' : 'panelists'}
                </div>
                <div className="mt-0.5 text-[11.5px] text-[#8B8F9E] font-poppins">
                  {ev.scorecardCount} {ev.scorecardCount === 1 ? 'scorecard' : 'scorecards'} in
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[12px] text-[#8B8F9E] font-inter">
              <Users className="h-3.5 w-3.5" />
              No panelists recorded
            </div>
          )}
        </div>
      </div>

      {actionable && expanded && (
        <div className="px-3 pb-3">
          <AttendeeDetailsBlock
            bookingId={ev.id}
            bookingCandidateName={ev.candidate_name}
            bookingCandidateEmail={ev.candidate_email}
            bookingCandidatePhone={ev.candidate_phone}
            bookingNotes={ev.notes}
            profileEmail={candidateEmail}
            profilePhone={candidatePhone}
            candidateId={candidateId}
            variant="past"
          />
        </div>
      )}
    </div>
  )
}

export default InterviewHistoryCard
