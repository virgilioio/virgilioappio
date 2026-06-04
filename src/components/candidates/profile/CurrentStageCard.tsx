import { useMemo } from 'react'
import { Calendar, CalendarClock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvatarStack } from '@/components/ui/table-cells'
import { useStageBookings } from '@/hooks/useStageBookings'
import { GenerateBookingLinkButton } from '@/components/candidates/GenerateBookingLinkButton'

interface CurrentStageCardProps {
  stageName: string
  stageType?: string
  jhsId: string
  candidateId: string
  jobId: string
  associationId: string
  candidateName?: string
  candidateEmail?: string
  jobTitle?: string
  enteredStageAt?: string | null
  onSchedule?: () => void
  onReschedule?: (bookingId: string) => void
  scorecardsSubmittedCount?: number
}

function daysSince(iso?: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return null
  return Math.max(0, Math.floor((Date.now() - d) / 86_400_000))
}

function fmtMonth(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()
}

function fmtStarted(iso?: string | null) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch { return null }
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="font-poppins font-semibold text-[10.5px] uppercase tracking-[0.06em] text-[hsl(var(--menu-group-color))] mb-3">
    {children}
  </div>
)

export function CurrentStageCard({
  stageName, stageType, jhsId, candidateId,
  jobId, associationId, candidateName, candidateEmail, jobTitle,
  enteredStageAt, onSchedule, onReschedule, scorecardsSubmittedCount,
}: CurrentStageCardProps) {
  const { data: bookings } = useStageBookings(jhsId, candidateId)
  const isInterviewStage = stageType === 'interview' || stageType === 'screening' || stageType === 'assessment'

  // Pick the next upcoming booking (else most recent past as fallback for context)
  const nextBooking = useMemo(() => {
    if (!bookings || bookings.length === 0) return null
    const now = Date.now()
    const upcoming = bookings.filter(b => new Date(b.scheduled_start as string).getTime() >= now)
    return upcoming[0] || bookings[bookings.length - 1] || null
  }, [bookings])

  const hasUpcoming = useMemo(() => {
    if (!bookings) return false
    const now = Date.now()
    return bookings.some(b => new Date(b.scheduled_start as string).getTime() >= now)
  }, [bookings])

  // Aggregate panelists across all bookings in this stage
  const allInterviewers = useMemo(() => {
    const map = new Map<string, { name: string; src: string | null }>()
    for (const b of bookings || []) {
      for (const i of b.interviewers || []) {
        if (map.has(i.user_id)) continue
        const name = [i.first_name, i.last_name].filter(Boolean).join(' ').trim() || (i.email ?? '')
        map.set(i.user_id, { name, src: i.avatar_url })
      }
    }
    return [...map.values()]
  }, [bookings])

  const inDays = daysSince(enteredStageAt)
  const startedLabel = fmtStarted(enteredStageAt)

  let nextEventDate: Date | null = null
  if (nextBooking?.scheduled_start) {
    const d = new Date(nextBooking.scheduled_start as string)
    if (!Number.isNaN(d.getTime())) nextEventDate = d
  }

  const durationMin = nextBooking?.scheduled_start && nextBooking?.scheduled_end
    ? Math.round((new Date(nextBooking.scheduled_end as string).getTime() - new Date(nextBooking.scheduled_start as string).getTime()) / 60000)
    : null

  const eventTimeLabel = nextEventDate
    ? `${nextEventDate.toLocaleDateString(undefined, { weekday: 'short' })} · ${nextEventDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}${durationMin ? ` · ${durationMin} min` : ''}`
    : null

  const showScheduleButton = isInterviewStage && (onSchedule || onReschedule)
  const isReschedule = hasUpcoming && !!nextBooking?.id && !!onReschedule

  return (
    <section className="bg-white border border-virgilio-border rounded-2xl shadow-sm p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-poppins font-semibold text-[15px] tracking-[-0.01em] text-text-primary truncate">
            Current stage · {stageName}
          </h3>
          {(inDays != null || startedLabel) && (
            <p className="mt-1 text-[12.5px] text-text-tertiary font-poppins">
              {inDays != null && <>In stage {inDays}d</>}
              {inDays != null && startedLabel && ' · '}
              {startedLabel && <>started {startedLabel}</>}
            </p>
          )}
        </div>
        {showScheduleButton && (
          isReschedule ? (
            <Button
              variant="secondary"
              size="md"
              icon={CalendarClock}
              onClick={() => onReschedule!(nextBooking!.id as string)}
              className="shrink-0"
            >
              Reschedule
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="md"
              icon={Calendar}
              onClick={() => onSchedule?.()}
              className="shrink-0"
            >
              Schedule
            </Button>
          )
        )}
      </div>

      {isInterviewStage ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* NEXT EVENT */}
          <div className="rounded-xl bg-[#FAFAF7] p-4">
            <SectionLabel>Next event</SectionLabel>
            {nextEventDate && nextBooking ? (
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center justify-center bg-text-primary text-white rounded-lg px-2.5 py-2 min-w-[52px] shrink-0">
                  <span className="font-poppins text-[9.5px] font-semibold tracking-[0.08em] opacity-80">
                    {fmtMonth(nextEventDate)}
                  </span>
                  <span className="font-poppins font-semibold text-[18px] leading-none mt-0.5">
                    {nextEventDate.getDate()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-poppins font-medium text-[13.5px] text-text-primary truncate">
                    {(nextBooking as any).title || (nextBooking as any).event_title || `${stageName}`}
                  </div>
                  {eventTimeLabel && (
                    <div className="mt-1 text-[12.5px] text-text-tertiary font-poppins">
                      {eventTimeLabel}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[12.5px] text-text-tertiary font-poppins">
                <Calendar className="h-3.5 w-3.5" />
                No upcoming event
              </div>
            )}
          </div>

          {/* INTERVIEWERS */}
          <div className="rounded-xl bg-[#FAFAF7] p-4">
            <SectionLabel>Interviewers</SectionLabel>
            {allInterviewers.length > 0 ? (
              <div className="flex items-center gap-3">
                <AvatarStack
                  people={allInterviewers.map(i => ({ name: i.name, src: i.src, fallback: i.name }))}
                  size={28}
                  max={4}
                />
                <div className="min-w-0">
                  <div className="font-poppins font-medium text-[13.5px] text-text-primary">
                    {allInterviewers.length} {allInterviewers.length === 1 ? 'panelist' : 'panelists'}
                  </div>
                  {scorecardsSubmittedCount != null && (
                    <div className="mt-0.5 text-[12.5px] text-text-tertiary font-poppins">
                      {scorecardsSubmittedCount} scorecard{scorecardsSubmittedCount === 1 ? '' : 's'} in
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[12.5px] text-text-tertiary font-poppins">
                <Users className="h-3.5 w-3.5" />
                No interviewers yet
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-[#FAFAF7] p-4 text-[13px] text-text-secondary font-poppins">
          This stage doesn't require interviews. Use the actions on the right to advance the candidate when ready.
        </div>
      )}
    </section>
  )
}

export default CurrentStageCard
