import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar,
  CalendarClock,
  CalendarOff,
  CalendarX,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Link2,
  MoreHorizontal,
  RefreshCw,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvatarStack } from '@/components/ui/table-cells'
import { useStageBookings } from '@/hooks/useStageBookings'
import { useContextualBookingLink } from '@/hooks/useContextualBookingLink'
import { supabase } from '@/lib/supabaseClient'
import { copyToClipboardSilent } from '@/utils/clipboard'
import { toast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { IconTip } from '@/components/ui/tooltip'
import AttendeeDetailsBlock from './primitives/AttendeeDetailsBlock'
import EditAttendeeEmailDialog from '@/components/candidates/EditAttendeeEmailDialog'

interface CurrentStageCardProps {
  stageName: string
  stageType?: string
  jhsId: string
  candidateId: string
  jobId: string
  associationId: string
  candidateName?: string
  candidateEmail?: string
  candidatePhone?: string
  jobTitle?: string
  enteredStageAt?: string | null
  stageWindowStartAt?: string | null
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
  <div className="font-poppins font-semibold text-[10.5px] uppercase tracking-[0.06em] text-[hsl(var(--menu-group-color))] mb-1.5">
    {children}
  </div>
)

// Shared menu panel styling
const menuPanelCls =
  'absolute z-50 mt-2 rounded-xl bg-white border border-[#EDECE6] shadow-[0_16px_40px_-8px_rgba(13,13,9,0.24)] p-[5px]'

function MenuItem({
  icon: Icon,
  label,
  meta,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  meta?: string
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        danger
          ? 'text-[#DC2626] hover:bg-[#FEF2F2]'
          : 'text-[#1F2230] hover:bg-[#F1F0EC]',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', danger ? 'text-[#DC2626]' : 'text-[#5A6072]')} />
      <div className="min-w-0 flex-1">
        <div className="font-inter text-[12.5px] font-medium leading-tight truncate">{label}</div>
        {meta && <div className="font-inter text-[11px] text-[#8B8F9E] mt-0.5 truncate">{meta}</div>}
      </div>
    </button>
  )
}

export function CurrentStageCard({
  stageName, stageType, jhsId, candidateId,
  jobId, associationId, candidateName, candidateEmail, candidatePhone, jobTitle,
  enteredStageAt, stageWindowStartAt, onSchedule, onReschedule, scorecardsSubmittedCount,
}: CurrentStageCardProps) {
  const { data: bookings } = useStageBookings(jhsId, candidateId, { jobId, stageWindowStartAt: stageWindowStartAt ?? enteredStageAt })
  const isInterviewStage = stageType === 'interview' || stageType === 'screening' || stageType === 'assessment'
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [editAttendeeOpen, setEditAttendeeOpen] = useState(false)

  const {
    contextualLink,
    copyToClipboard,
    renewLink,
    hasBookingConfig,
  } = useContextualBookingLink(
    isInterviewStage
      ? { jobId, candidateId, jhsId, associationId, candidateName, candidateEmail, jobTitle, stageName }
      : null,
  )

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

  // --- Menu open state (one at a time) ---
  const [openMenu, setOpenMenu] = useState<null | 'link' | 'event'>(null)
  // C10/C11: the confirms are the shared dialog now; focus goes back to the trigger.
  const linkTriggerRef = useRef<HTMLButtonElement>(null)
  const eventTriggerRef = useRef<HTMLButtonElement>(null)
  const [linkFlash, setLinkFlash] = useState<null | 'copied' | 'renewed'>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [busy, setBusy] = useState<'copy' | 'renew' | 'cancel' | null>(null)

  // Detect new/replaced upcoming event to show "Event scheduled/rescheduled" flash
  const lastEventKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isInterviewStage || !bookings) return
    const key = nextBooking && hasUpcoming
      ? `${nextBooking.id}:${nextBooking.scheduled_start}`
      : null
    const prev = lastEventKeyRef.current
    if (prev !== null && key && key !== prev) {
      const sameId = prev.split(':')[0] === (nextBooking?.id ?? '')
      setFlash(sameId ? 'Event rescheduled · invites updated' : 'Event scheduled · invites sent')
      const t = window.setTimeout(() => setFlash(null), 2200)
      lastEventKeyRef.current = key
      return () => window.clearTimeout(t)
    }
    lastEventKeyRef.current = key
  }, [bookings, isInterviewStage, nextBooking, hasUpcoming])

  // Dismiss link flash
  useEffect(() => {
    if (!linkFlash) return
    const t = window.setTimeout(() => setLinkFlash(null), 2000)
    return () => window.clearTimeout(t)
  }, [linkFlash])

  const closeMenus = () => {
    setOpenMenu(null)
  }

  const handleCopyLink = async () => {
    setBusy('copy')
    try {
      const ok = await copyToClipboard()
      if (ok) setLinkFlash('copied')
    } finally {
      setBusy(null)
      closeMenus()
    }
  }

  const firstName = (candidateName || '').trim().split(/\s+/)[0] || ''

  // C11 (Block B §16, Pattern 1): renewing kills the link the candidate has.
  const handleRenew = async () => {
    closeMenus()
    linkTriggerRef.current?.focus()
    const ok = await confirmDestructive({
      icon: RefreshCw,
      title: firstName ? `Renew ${firstName}\u2019s booking link?` : 'Renew this booking link?',
      description: `You get a new link, copied for you. The current one stops working right away, so ${firstName || 'the candidate'} can\u2019t book with it. Interviews already booked stay. This can\u2019t be undone.`,
      confirmLabel: 'Renew link',
    })
    if (!ok) return
    setBusy('renew')
    try {
      const url = await renewLink()
      if (url) {
        setLinkFlash('renewed')
        toast({ title: 'Link renewed', description: 'The new link is copied. The old one no longer works.' })
      } else {
        toast({ variant: 'destructive', title: 'Couldn\u2019t renew the link', description: 'The current link still works; try again.' })
      }
    } finally {
      setBusy(null)
    }
  }

  const handleOpenBookingPage = () => {
    if (contextualLink) window.open(contextualLink, '_blank', 'noopener,noreferrer')
    closeMenus()
  }

  const handleCopyInviteDetails = async () => {
    if (!nextBooking || !nextEventDate) { closeMenus(); return }
    const title = (nextBooking as any).title || (nextBooking as any).event_title || `${stageName} — ${candidateName ?? 'Candidate'}`
    const when = `${nextEventDate.toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
    const loc = (nextBooking as any).google_meet_link || (nextBooking as any).meeting_location || (nextBooking as any).meeting_type || ''
    const lines = [title, when, durationMin ? `${durationMin} min` : '', loc].filter(Boolean)
    const ok = await copyToClipboardSilent(lines.join('\n'))
    toast({ title: ok ? 'Invite details copied' : 'Copy failed', description: ok ? undefined : 'Please try again.' })
    closeMenus()
  }

  const handleOpenInCalendar = () => {
    navigate('/calendar')
    closeMenus()
  }

  // C10 (Block B §16, Pattern 1): cancel-booking emails the candidate, the lead
  // interviewer and any guests, and deletes the Google event the panel is on.
  const handleCancelEvent = async () => {
    if (!nextBooking) return
    closeMenus()
    eventTriggerRef.current?.focus()
    const name = (candidateName || '').trim()
    const first = firstName || 'The candidate'
    const panel = (nextBooking.interviewers || []) as Array<{ first_name: string | null; last_name: string | null; email: string | null; is_primary?: boolean }>
    const lead = panel.find((i) => i.is_primary) ?? panel[0]
    const leadName = lead ? [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || lead.email || 'the interviewer' : null
    const when = nextEventDate
      ? nextEventDate.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : null
    const what = (nextBooking as any).title || `${stageName} interview`
    const emailed = panel.length > 1
      ? `${first}, ${leadName} and any guests are emailed, and the event comes off Google Calendar for all ${panel.length} panelists.`
      : leadName
      ? `${first}, ${leadName} and any guests are emailed, and the event comes off Google Calendar.`
      : `${first} and any guests are emailed, and the event comes off Google Calendar.`
    const ok = await confirmDestructive({
      icon: CalendarX,
      title: name ? `Cancel the interview with ${name}?` : 'Cancel this interview?',
      description: `${what}${when ? `, ${when}` : ''}. ${emailed} ${first} stays in ${stageName}. This can\u2019t be undone.`,
      confirmLabel: 'Cancel interview',
      cancelLabel: 'Keep interview',
    })
    if (!ok) return
    setBusy('cancel')
    try {
      const { error } = await supabase.functions.invoke('cancel-booking', {
        body: {
          booking_id: nextBooking.id,
          reason: 'Cancelled from candidate profile',
        },
      })
      if (error) throw error
      toast({ title: 'Interview cancelled', description: 'Everyone on it has been told.' })
      queryClient.invalidateQueries({ queryKey: ['scheduled-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['stage-bookings', jhsId, candidateId] })
      setFlash('Interview cancelled · panel notified')
      window.setTimeout(() => setFlash(null), 2200)
    } catch {
      toast({ variant: 'destructive', title: 'Couldn\u2019t cancel the interview', description: 'It\u2019s still booked and nobody was emailed; try again.' })
    } finally {
      setBusy(null)
    }
  }

  const displayLink = contextualLink
    ? contextualLink.replace(/^https?:\/\//, '')
    : ''

  const rightButton = () => {
    if (!isInterviewStage) return null
    if (hasUpcoming && nextBooking?.id && onReschedule) {
      return (
        <Button
          variant="secondary"
          size="md"
          icon={CalendarClock}
          onClick={() => onReschedule(nextBooking.id as string)}
        >
          Reschedule
        </Button>
      )
    }
    if (onSchedule) {
      return (
        <Button variant="secondary" size="md" icon={Calendar} onClick={() => onSchedule()}>
          Schedule
        </Button>
      )
    }
    return null
  }

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

        {isInterviewStage && (
          <div className="flex items-center gap-2 shrink-0 relative">
            {/* Booking-link menu */}
            {hasBookingConfig && (
              <div className="relative">
                <Button
                  ref={linkTriggerRef}
                  variant={linkFlash ? 'secondary' : 'secondary'}
                  size="md"
                  icon={linkFlash ? Check : Link2}
                  iconRight={linkFlash ? undefined : ChevronDown}
                  onClick={() => setOpenMenu(openMenu === 'link' ? null : 'link')}
                  className={cn(
                    linkFlash && 'bg-[#ECFDF3] border-[#A7E6C6] text-[#0B7A57] hover:bg-[#ECFDF3]',
                  )}
                >
                  {linkFlash === 'copied' ? 'Link copied' : linkFlash === 'renewed' ? 'Link renewed' : 'Booking link'}
                </Button>

                {openMenu === 'link' && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={closeMenus} />
                    <div className={cn(menuPanelCls, 'right-0 w-[268px]')}>
                      <div className="px-2.5 py-2 border-b border-[#F1F0EC] mb-1">
                        <div className="font-mono text-[10.5px] text-[#5A6072] truncate" style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
                          {displayLink || 'Generating link…'}
                        </div>
                      </div>
                      <MenuItem
                        icon={Copy}
                        label="Copy link"
                        meta="Candidate + this stage"
                        onClick={handleCopyLink}
                        disabled={!contextualLink || busy === 'copy'}
                      />
                      <MenuItem
                        icon={RefreshCw}
                        label="Renew link"
                        meta="Invalidate the current link"
                        onClick={() => void handleRenew()}
                        disabled={!contextualLink || busy === 'renew'}
                      />
                      <MenuItem
                        icon={ExternalLink}
                        label="Open booking page"
                        onClick={handleOpenBookingPage}
                        disabled={!contextualLink}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {rightButton()}
          </div>
        )}
      </div>

      {flash && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#A7E6C6] bg-[#ECFDF3] px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#0B7A57]" />
          <span className="font-inter text-[12.5px] font-medium text-[#0B7A57]">{flash}</span>
        </div>
      )}

      {isInterviewStage ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* NEXT EVENT */}
          <div className="rounded-[9px] bg-[#FAFAF7] p-3 relative">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="font-poppins font-semibold text-[10.5px] uppercase tracking-[0.06em] text-[hsl(var(--menu-group-color))]">
                Next event
              </div>
              {nextEventDate && nextBooking && hasUpcoming && (
                <div className="relative">
                  <IconTip label="Event options">
                  <button
                    ref={eventTriggerRef}
                    type="button"
                    aria-label="Event options"
                    className="h-6 w-6 -mr-1 -mt-1 rounded-md text-[#8B8F9E] hover:bg-[#F1F0EC] flex items-center justify-center transition-colors"
                    onClick={() => setOpenMenu(openMenu === 'event' ? null : 'event')}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  </IconTip>
                  {openMenu === 'event' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={closeMenus} />
                      <div className={cn(menuPanelCls, 'right-0 w-[210px]')}>
                        <MenuItem
                          icon={CalendarClock}
                          label="Reschedule"
                          onClick={() => { onReschedule?.(nextBooking.id as string); closeMenus() }}
                        />
                        <MenuItem icon={Copy} label="Copy invite details" onClick={handleCopyInviteDetails} />
                        <MenuItem icon={ExternalLink} label="Open in calendar" onClick={handleOpenInCalendar} />
                        <div className="my-1 border-t border-[#F1F0EC]" />
                        <MenuItem icon={CalendarX} label="Cancel interview" danger onClick={() => void handleCancelEvent()} disabled={busy === 'cancel'} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {nextEventDate && nextBooking && hasUpcoming ? (
              <div className="flex items-start gap-[9px]">
                <div className="flex flex-col items-center justify-center bg-text-primary text-white rounded-[9px] h-[38px] w-[38px] shrink-0">
                  <span className="font-poppins text-[9px] font-semibold tracking-[0.08em] opacity-80 leading-none">
                    {fmtMonth(nextEventDate)}
                  </span>
                  <span className="font-poppins font-bold text-[15px] leading-none mt-[3px]">
                    {nextEventDate.getDate()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-inter font-medium text-[12.5px] text-text-primary truncate">
                    {(nextBooking as any).title || (nextBooking as any).event_title || `${stageName}`}
                  </div>
                  {eventTimeLabel && (
                    <div className="mt-px text-[11px] text-[#5A6072] font-inter">
                      {eventTimeLabel}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-[9px]">
                <div className="flex items-center justify-center bg-[#F6F5F1] rounded-[9px] h-[38px] w-[38px] shrink-0">
                  <CalendarOff className="h-4 w-4 text-[#8B8F9E]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-inter font-medium text-[12.5px] text-[#5A6072]">
                    No event scheduled
                  </div>
                  {onSchedule && (
                    <button
                      type="button"
                      onClick={onSchedule}
                      className="mt-1 font-inter font-semibold text-[11.5px] text-[#6F3FF5] hover:text-[#5B21B6] transition-colors"
                    >
                      Schedule one →
                    </button>
                  )}
                </div>
              </div>
            )}

            {nextBooking && hasUpcoming && (
              <AttendeeDetailsBlock
                bookingId={nextBooking.id as string}
                bookingCandidateName={(nextBooking as any).candidate_name}
                bookingCandidateEmail={(nextBooking as any).candidate_email}
                bookingCandidatePhone={(nextBooking as any).candidate_phone}
                bookingNotes={(nextBooking as any).notes}
                profileEmail={candidateEmail}
                profilePhone={candidatePhone}
                candidateId={candidateId}
                variant="upcoming"
              />
            )}
          </div>


          {/* INTERVIEWERS */}
          <div className="rounded-[9px] bg-[#FAFAF7] p-3">
            <SectionLabel>Interviewers</SectionLabel>
            {allInterviewers.length > 0 ? (
              <div className="flex items-center gap-[9px]">
                <AvatarStack
                  people={allInterviewers.map(i => ({ name: i.name, src: i.src, fallback: i.name }))}
                  size={24}
                  max={4}
                />
                <div className="min-w-0">
                  <div className="font-poppins font-medium text-[12px] text-text-primary">
                    {allInterviewers.length} {allInterviewers.length === 1 ? 'panelist' : 'panelists'}
                  </div>
                  {scorecardsSubmittedCount != null && (
                    <div className="mt-0.5 text-[10.5px] text-text-tertiary font-poppins">
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
        <div className="rounded-[9px] bg-[#FAFAF7] p-3 text-[13px] text-text-secondary font-poppins">
          This stage doesn't require interviews. Use the actions on the right to advance the candidate when ready.
        </div>
      )}

      {nextBooking && (
        <EditAttendeeEmailDialog
          open={editAttendeeOpen}
          onOpenChange={setEditAttendeeOpen}
          bookingId={nextBooking.id as string}
          currentEmail={(nextBooking as any).candidate_email || ''}
        />
      )}
    </section>
  )
}

export default CurrentStageCard
