
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO, formatDistanceToNowStrict } from 'date-fns'
import { Card } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Calendar, ExternalLink, Clock, FileText, CheckCircle, Send } from 'lucide-react'
import { JobStage } from '@/hooks/useJobHiringPlan'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabaseClient'
import { BookingDetailsDialog } from '@/components/booking/BookingDetailsDialog'

interface CandidateCardProps {
  candidateId?: string
  associationId?: string
  candidateName: string
  linkedinUrl?: string | null
  stageOptions: { jhsId: string; stage: JobStage }[]
  currentStageJhsId?: string | null
  timeInStageLabel?: string
  timeBadgeVariant?: BadgeProps['variant']
  onMove: (toStageId: string) => void | Promise<void>
  onClick?: () => void
  showCheckbox?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export default function CandidateCard(props: CandidateCardProps) {
  const { candidateId, associationId, candidateName, linkedinUrl, timeInStageLabel, timeBadgeVariant, onClick, currentStageJhsId } = props
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)

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

  // Query for candidate status (scorecards and bookings)
  const { data: candidateStatus } = useQuery({
    queryKey: ['candidate-status', candidateId, associationId, currentStageJhsId],
    queryFn: async () => {
      if (!candidateId || !associationId || !currentStageJhsId) return null
      
      // Fetch scorecards for this association + stage (only human-submitted)
      const { data: scorecards } = await supabase
        .from('job_stage_scorecards')
        .select('id')
        .eq('association_id', associationId)
        .eq('stage_instance_id', currentStageJhsId)
        .eq('is_ai_draft', false)
        .limit(1)
      
      // Fetch all bookings for this candidate in this stage
      const { data: bookings } = await supabase
        .from('scheduled_bookings')
        .select('id, scheduled_start, status, candidate_confirmation_status')
        .eq('candidate_id', candidateId)
        .eq('job_hiring_stage_id', currentStageJhsId)
        .in('status', ['pending', 'confirmed', 'rescheduled', 'completed', 'no_show'])
        .order('scheduled_start', { ascending: true })
      
      const hasScorecard = (scorecards?.length ?? 0) > 0
      const now = new Date()
      
      // Check for completed interviews (completed status OR confirmed but past)
      const completedInterview = bookings?.find(b => 
        b.status === 'completed' || 
        b.status === 'no_show' ||
        (b.status === 'confirmed' && new Date(b.scheduled_start) < now)
      )
      
      // Check for upcoming scheduled interview
      const upcomingInterview = bookings?.find(b => 
        (b.status === 'confirmed' || b.status === 'rescheduled') && 
        new Date(b.scheduled_start) >= now
      )
      
      // Check for pending booking link (sent but not confirmed by candidate)
      const pendingBookingLink = bookings?.find(b => 
        b.status === 'pending' || 
        (b.candidate_confirmation_status === 'pending' && b.status !== 'cancelled')
      )
      
      return { hasScorecard, completedInterview, upcomingInterview, pendingBookingLink }
    },
    enabled: !!candidateId && !!associationId && !!currentStageJhsId,
  })

  // Get status badge based on priority
  const getStatusBadge = () => {
    if (!candidateStatus) return null
    const { hasScorecard, completedInterview, upcomingInterview, pendingBookingLink } = candidateStatus
    
    if (hasScorecard) {
      return { label: 'Needs Decision', variant: 'purple' as const, Icon: CheckCircle }
    }
    
    if (completedInterview) {
      return { label: 'Pending Scorecard', variant: 'warning' as const, Icon: FileText }
    }
    
    if (upcomingInterview) {
      const timeUntil = formatDistanceToNowStrict(new Date(upcomingInterview.scheduled_start), { addSuffix: false })
      return { label: `In ${timeUntil}`, variant: 'info' as const, Icon: Calendar }
    }
    
    if (pendingBookingLink) {
      return { label: 'Booking Link Sent', variant: 'secondary' as const, Icon: Send }
    }
    
    return { label: 'Pending Schedule', variant: 'pastel-yellow' as const, Icon: Clock }
  }

  const statusBadge = getStatusBadge()

  return (
    <>
      <Card className="relative p-4 min-h-32 bg-white border-border cursor-pointer" onClick={onClick} role="button" aria-label="Open candidate profile">
        {props.showCheckbox && (
          <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={!!props.checked} onCheckedChange={(v) => props.onCheckedChange?.(!!v)} aria-label="Select candidate" />
          </div>
        )}

        {nextInterview && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="absolute top-2 right-2 cursor-pointer hover:bg-secondary/80 gap-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedBookingId(nextInterview.id)
                    setBookingDialogOpen(true)
                  }}
                >
                  <Calendar className="h-3 w-3" />
                  {format(parseISO(nextInterview.scheduled_start), 'MMM d')}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Interview: {format(parseISO(nextInterview.scheduled_start), 'PPpp')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="font-medium text-sm text-text-primary truncate">{candidateName}</div>
            </div>
            {linkedinUrl ? (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
                title="Open LinkedIn"
              >
                <ExternalLink className="w-3.5 h-3.5" /> LinkedIn
              </a>
            ) : (
              <div className="text-xs text-text-tertiary mt-1">No LinkedIn</div>
            )}
          </div>
        </div>

        {/* Bottom row with time badge (left) and status badge (right) */}
        <div className="absolute left-4 right-4 bottom-3 flex justify-between items-center gap-2">
          {timeInStageLabel && (
            <Badge variant={timeBadgeVariant ?? 'outline'}>{timeInStageLabel}</Badge>
          )}
          {statusBadge && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant={statusBadge.variant} className="gap-1 text-[10px] px-1.5">
                    <statusBadge.Icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{statusBadge.label}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {statusBadge.label}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
