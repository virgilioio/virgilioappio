
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Card } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Calendar, ExternalLink } from 'lucide-react'
import { JobStage } from '@/hooks/useJobHiringPlan'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabaseClient'
import { BookingDetailsDialog } from '@/components/booking/BookingDetailsDialog'

interface CandidateCardProps {
  candidateId?: string
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
  const { candidateId, candidateName, linkedinUrl, timeInStageLabel, timeBadgeVariant, onClick } = props
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

        {timeInStageLabel && (
          <div className="absolute left-4 bottom-3">
            <Badge variant={timeBadgeVariant ?? 'outline'}>{timeInStageLabel}</Badge>
          </div>
        )}
      </Card>

      <BookingDetailsDialog
        bookingId={selectedBookingId}
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
      />
    </>
  )
}
