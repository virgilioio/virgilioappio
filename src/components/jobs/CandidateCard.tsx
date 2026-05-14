import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO, formatDistanceToNowStrict } from 'date-fns'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Calendar, Clock, FileText, CheckCircle, Send, Phone, Heart, Sparkles } from 'lucide-react'
import { JobStage } from '@/hooks/useJobHiringPlan'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabaseClient'
import { BookingDetailsDialog } from '@/components/booking/BookingDetailsDialog'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'
import { useWhatsAppEnabled } from '@/hooks/useWhatsAppEnabled'
import { buildWhatsAppUrl, formatE164Display } from '@/utils/phoneUtils'
import { renderTemplate, buildPlaceholderData, stripHtmlToPlainText } from '@/utils/templateUtils'
import { useAuth } from '@/contexts/AuthContext'

interface CandidateCardProps {
  candidateId?: string
  associationId?: string
  candidateName: string
  linkedinUrl?: string | null
  phone?: string | null
  stageOptions: { jhsId: string; stage: JobStage }[]
  currentStageJhsId?: string | null
  timeInStageLabel?: string
  timeBadgeVariant?: BadgeProps['variant']
  onMove: (toStageId: string) => void | Promise<void>
  onClick?: () => void
  showCheckbox?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  jobId?: string
  whatsappTemplateSentAt?: string | null
  isFavorite?: boolean
}

export default function CandidateCard(props: CandidateCardProps) {
  const { candidateId, associationId, candidateName, linkedinUrl, phone, timeInStageLabel, timeBadgeVariant, onClick, currentStageJhsId, jobId, whatsappTemplateSentAt: initialSentAt } = props
  const { isEnabled: whatsAppEnabled, messageTemplate: whatsAppTemplate } = useWhatsAppEnabled()
  const { user } = useAuth()
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [localSentAt, setLocalSentAt] = useState<string | null>(initialSentAt ?? null)

  // Keep local state in sync with prop changes (e.g. after pipeline reload)
  const effectiveSentAt = localSentAt ?? initialSentAt ?? null

  const { data: nextInterview } = useQuery({
    queryKey: ['next-interview', candidateId],
    queryFn: async () => {
      if (!candidateId) return null
      const { data } = await supabase
        .from('scheduled_bookings')
        .select('id, scheduled_start, status')
        .eq('candidate_id', candidateId)
        .gte('scheduled_start', new Date().toISOString())
        .in('status', ['confirmed', 'rescheduled'])
        .order('scheduled_start', { ascending: true })
        .limit(1)
        .maybeSingle()
      return data
    },
    enabled: !!candidateId,
  })

  // Lightweight candidate meta (current role / company / AI fit) for visual subtitle.
  const { data: candidateMeta } = useQuery({
    queryKey: ['candidate-meta', candidateId],
    queryFn: async () => {
      if (!candidateId) return null
      const { data } = await supabase
        .from('candidates')
        .select('current_role, current_company, ai_fit_score')
        .eq('id', candidateId)
        .maybeSingle()
      return data as any
    },
    enabled: !!candidateId,
    staleTime: 5 * 60 * 1000,
  })

  // Query for candidate status (scorecards, bookings, and booking link sent)
  const { data: candidateStatus } = useQuery({
    queryKey: ['candidate-status', candidateId, associationId, currentStageJhsId],
    queryFn: async () => {
      if (!candidateId || !associationId || !currentStageJhsId) return null
      
      // Fetch scorecards for this association + stage (only human-submitted) with authors
      const { data: scorecards } = await supabase
        .from('job_stage_scorecards')
        .select('id, created_by')
        .eq('association_id', associationId)
        .eq('stage_instance_id', currentStageJhsId)
        .eq('is_ai_draft', false)
      
      // Fetch all bookings for this candidate in this stage
      const { data: bookings } = await supabase
        .from('scheduled_bookings')
        .select('id, scheduled_start, status, candidate_confirmation_status, interviewer_id')
        .eq('candidate_id', candidateId)
        .eq('job_hiring_stage_id', currentStageJhsId)
        .in('status', ['pending', 'confirmed', 'rescheduled', 'completed', 'no_show'])
        .order('scheduled_start', { ascending: true })

      // Fetch attendees for these bookings to derive expected interviewer set
      const bookingIds = (bookings || []).map(b => b.id)
      let attendees: { booking_id: string; user_id: string }[] = []
      if (bookingIds.length > 0) {
        const { data } = await supabase
          .from('scheduled_booking_attendees')
          .select('booking_id, user_id')
          .in('booking_id', bookingIds)
        attendees = (data || []) as any
      }

      // Build expected interviewer set across all bookings for this stage
      const expected = new Set<string>()
      for (const b of bookings || []) {
        if (b.interviewer_id) expected.add(b.interviewer_id)
      }
      for (const a of attendees) {
        if (a.user_id) expected.add(a.user_id)
      }

      const authors = new Set((scorecards || []).map(s => s.created_by).filter(Boolean) as string[])
      const hasAnyScorecard = (scorecards?.length ?? 0) > 0
      const allSubmitted = expected.size > 0 && [...expected].every(uid => authors.has(uid))
      
      // Fetch booking_link_sent_at from the association
      const { data: association } = await supabase
        .from('job_candidate_associations')
        .select('booking_link_sent_at')
        .eq('id', associationId)
        .single()
      
      const now = new Date()
      
      const completedInterview = bookings?.find(b => 
        b.status === 'completed' || 
        b.status === 'no_show' ||
        (b.status === 'confirmed' && new Date(b.scheduled_start) < now)
      )
      
      const upcomingInterview = bookings?.find(b => 
        (b.status === 'confirmed' || b.status === 'rescheduled') && 
        new Date(b.scheduled_start) >= now
      )
      
      const pendingBookingLink = bookings?.find(b => 
        b.status === 'pending' || 
        (b.candidate_confirmation_status === 'pending' && b.status !== 'cancelled')
      )
      
      const bookingLinkSentAt = association?.booking_link_sent_at
      
      return {
        hasAnyScorecard,
        allSubmitted,
        expectedCount: expected.size,
        submittedCount: [...expected].filter(uid => authors.has(uid)).length,
        completedInterview,
        upcomingInterview,
        pendingBookingLink,
        bookingLinkSentAt,
      }
    },
    enabled: !!candidateId && !!associationId && !!currentStageJhsId,
  })

  // WhatsApp first-click template handler
  const handleWhatsAppClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!phone) return

    // If no template, no association, or already sent — open plain URL
    if (!whatsAppTemplate || !associationId || effectiveSentAt) {
      const url = buildWhatsAppUrl(phone)
      if (url) window.open(url, '_blank')
      return
    }

    // Resolve placeholders
    const senderProfile = user?.id
      ? await supabase
          .from('profiles')
          .select('first_name, last_name, email, title, phone, linkedin_url')
          .eq('user_id', user.id)
          .maybeSingle()
          .then((r) => r.data)
      : null

    // Fetch candidate details for placeholders
    const candidateData = candidateId
      ? await supabase
          .from('candidates')
          .select('candidate_name, email, phone, location_city, location_state, location_country')
          .eq('id', candidateId)
          .maybeSingle()
          .then((r) => r.data)
      : null

    // Fetch job details
    const jobData = jobId
      ? await supabase
          .from('jobs')
          .select('title, department, location, organization:organizations(name)')
          .eq('id', jobId)
          .maybeSingle()
          .then((r) => r.data)
      : null

    const orgName = (jobData as any)?.organization?.name ?? ''

    const placeholderData = buildPlaceholderData({
      candidate: candidateData
        ? {
            candidate_name: candidateData.candidate_name,
            email: candidateData.email,
            phone: candidateData.phone,
            location_city: candidateData.location_city,
            location_state: candidateData.location_state,
            location_country: candidateData.location_country,
          }
        : undefined,
      job: jobData ? { title: jobData.title, department: jobData.department, location: jobData.location } : undefined,
      sender: senderProfile
        ? {
            first_name: senderProfile.first_name ?? undefined,
            last_name: senderProfile.last_name ?? undefined,
            email: senderProfile.email ?? user?.email ?? undefined,
            title: senderProfile.title ?? undefined,
            phone: senderProfile.phone ?? undefined,
            linkedin_url: senderProfile.linkedin_url ?? undefined,
          }
        : undefined,
      organizationName: orgName,
    })

    const resolvedText = stripHtmlToPlainText(renderTemplate(whatsAppTemplate, placeholderData))
    const url = buildWhatsAppUrl(phone, resolvedText)
    if (url) window.open(url, '_blank')

    // Mark as sent
    await supabase
      .from('job_candidate_associations' as any)
      .update({ whatsapp_template_sent_at: new Date().toISOString() })
      .eq('id', associationId)
    setLocalSentAt(new Date().toISOString())
  }

  // Get status badge based on priority
  const getStatusBadge = () => {
    if (!candidateStatus) return null
    const {
      hasAnyScorecard,
      allSubmitted,
      expectedCount,
      submittedCount,
      completedInterview,
      upcomingInterview,
      pendingBookingLink,
      bookingLinkSentAt,
    } = candidateStatus

    // All expected interviewers submitted -> Needs Decision
    if (allSubmitted) {
      return { label: 'Needs Decision', variant: 'purple' as const, Icon: CheckCircle }
    }

    // Some submitted but not all (multi-interviewer) -> Pending Scorecard with progress
    if (hasAnyScorecard && expectedCount > 1) {
      return {
        label: `Pending Scorecard (${submittedCount}/${expectedCount})`,
        variant: 'warning' as const,
        Icon: FileText,
      }
    }

    if (completedInterview) {
      const label = expectedCount > 1
        ? `Pending Scorecard (${submittedCount}/${expectedCount})`
        : 'Pending Scorecard'
      return { label, variant: 'warning' as const, Icon: FileText }
    }

    if (upcomingInterview) {
      const timeUntil = formatDistanceToNowStrict(new Date(upcomingInterview.scheduled_start), { addSuffix: false })
      return { label: `In ${timeUntil}`, variant: 'info' as const, Icon: Calendar }
    }

    if (pendingBookingLink || bookingLinkSentAt) {
      return { label: 'Booking Link Sent', variant: 'secondary' as const, Icon: Send }
    }

    return { label: 'Pending Schedule', variant: 'pastel-yellow' as const, Icon: Clock }
  }

  const statusBadge = getStatusBadge()

  const initials = (candidateName || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase())
    .join('') || '?'

  const role = candidateMeta?.current_role || null
  const company = candidateMeta?.current_company || null
  const aiFitScore = typeof candidateMeta?.ai_fit_score === 'number' ? candidateMeta.ai_fit_score : null

  return (
    <>
      <Card
        className="relative bg-white border border-virgilio-border rounded-xl shadow-none hover:shadow-[var(--shadow-xs)] transition-shadow p-3 cursor-pointer"
        onClick={onClick}
        role="button"
        aria-label="Open candidate profile"
      >
        {props.showCheckbox && (
          <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={!!props.checked} onCheckedChange={(v) => props.onCheckedChange?.(!!v)} aria-label="Select candidate" />
          </div>
        )}

        {!props.showCheckbox && props.isFavorite && (
          <Heart className="absolute top-2.5 right-2.5 h-3.5 w-3.5 fill-red-500 text-red-500" />
        )}

        <div className="flex items-start gap-2.5">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-virgilio-purple text-white text-[11px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="font-poppins text-[13px] font-semibold text-text-primary leading-tight truncate">
              {candidateName}
            </div>
            <div className="text-[12px] text-text-tertiary truncate mt-0.5">
              {role || ''}{role && company ? ' ' : ''}{company ? `@ ${company}` : ''}
            </div>
          </div>
        </div>

        {(linkedinUrl || phone) && (
          <div className="mt-2 flex items-center gap-3 text-[11px]">
            {linkedinUrl && (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#0A66C2] hover:underline"
                title="Open LinkedIn"
                onClick={(e) => e.stopPropagation()}
              >
                <LinkedInFilled className="w-3 h-3" />
              </a>
            )}
            {phone && (whatsAppEnabled && buildWhatsAppUrl(phone) ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[#25D366] hover:text-[#128C7E] bg-transparent border-none p-0 cursor-pointer"
                title="Open WhatsApp"
                onClick={handleWhatsAppClick}
              >
                <WhatsAppIcon size={12} />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-text-tertiary">
                <Phone className="w-3 h-3" />
              </span>
            ))}
          </div>
        )}

        {/* Bottom row: AI fit (left) + time chip / status (right) */}
        <div className="mt-3 pt-2 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 font-poppins text-[12px] tabular-nums text-text-secondary">
            <Sparkles className="h-3 w-3 text-virgilio-purple" />
            <span className="font-semibold text-text-primary">{aiFitScore ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {nextInterview ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md bg-pastel-pink/60 px-1.5 py-0.5 text-[11px] font-medium text-text-primary hover:brightness-95"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedBookingId(nextInterview.id)
                        setBookingDialogOpen(true)
                      }}
                    >
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(nextInterview.scheduled_start), 'MMM d')}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Interview: {format(parseISO(nextInterview.scheduled_start), 'PPpp')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : timeInStageLabel ? (
              <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-text-tertiary">
                <Clock className="h-3 w-3" />
                {timeInStageLabel}
              </span>
            ) : null}
            {statusBadge && !nextInterview && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span aria-label={statusBadge.label}>
                      <statusBadge.Icon className="h-3 w-3 text-text-tertiary" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{statusBadge.label}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </Card>

      <BookingDetailsDialog
        bookingId={selectedBookingId}
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
      />
    </>
  )
}
