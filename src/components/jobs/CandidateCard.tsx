import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Clock, Heart, Sparkles, Check } from 'lucide-react'
import { JobStage } from '@/hooks/useJobHiringPlan'
import { supabase } from '@/lib/supabaseClient'
import { BookingDetailsDialog } from '@/components/booking/BookingDetailsDialog'
import { scoreColor, isStale, PIPELINE_RED, PIPELINE_TERTIARY } from './pipelineVisuals'

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
  /** Whole days in the current stage — red + 600 past 7. */
  daysInStage?: number
  onMove: (toStageId: string) => void | Promise<void>
  onClick?: () => void
  showCheckbox?: boolean
  /** Keeps the checkbox visible even without hover (column has a selection) */
  checkboxAlwaysVisible?: boolean
  selected?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  onCheckboxClick?: (e: React.MouseEvent) => void
  jobId?: string
  whatsappTemplateSentAt?: string | null
  isFavorite?: boolean
}

export default function CandidateCard(props: CandidateCardProps) {
  const { candidateId, candidateName, onClick, daysInStage = 0 } = props
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

  // Lightweight candidate meta (current role / company / AI fit) for the card body.
  const { data: candidateMeta } = useQuery({
    queryKey: ['candidate-meta', candidateId],
    queryFn: async () => {
      if (!candidateId) return null
      const { data } = await supabase
        .from('candidates')
        .select('current_job_title, role_current, company_current, ai_fit_score')
        .eq('id', candidateId)
        .maybeSingle()
      const meta = (data || {}) as any
      // Fall back to the latest parsed work-experience row when the profile
      // fields are empty — the parser fills one or the other.
      if (!meta.current_job_title && !meta.role_current) {
        const { data: exp } = await supabase
          .from('candidate_work_experience')
          .select('job_title, company_name, is_current, end_date, start_date')
          .eq('candidate_id', candidateId)
          .order('is_current', { ascending: false })
          .order('start_date', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()
        if (exp) {
          meta.exp_title = exp.job_title ?? null
          meta.exp_company = exp.company_name ?? null
        }
      }
      return meta
    },
    enabled: !!candidateId,
    staleTime: 5 * 60 * 1000,
  })

  const role = candidateMeta?.current_job_title || candidateMeta?.role_current || candidateMeta?.exp_title || null
  const company = candidateMeta?.company_current || candidateMeta?.exp_company || null
  const score = typeof candidateMeta?.ai_fit_score === 'number' ? candidateMeta.ai_fit_score : null

  // Due pill — only when there is an interview landing today or tomorrow.
  let duePill: string | null = null
  if (nextInterview?.scheduled_start) {
    const d = differenceInCalendarDays(parseISO(nextInterview.scheduled_start), new Date())
    if (d <= 0) duePill = 'Due today'
    else if (d === 1) duePill = 'Due tmrw'
  }

  const checkboxVisible = !!props.showCheckbox && (!!props.checked || !!props.checkboxAlwaysVisible)
  const stale = isStale(daysInStage)

  return (
    <>
      <div
        className={cn('group/card relative cursor-grab bg-white', props.selected && 'is-selected')}
        style={{
          border: `1px solid ${props.selected ? '#6F3FF5' : '#E7E8EE'}`,
          borderRadius: 10,
          padding: 12,
          marginBottom: 8,
          boxShadow: props.selected ? '0 0 0 1px #6F3FF5' : '0 1px 2px rgba(13,13,9,0.03)',
        }}
        onClick={onClick}
        role="button"
        aria-label="Open candidate profile"
      >
        {props.showCheckbox && (
          <button
            type="button"
            role="checkbox"
            aria-checked={!!props.checked}
            aria-label="Select candidate"
            className={cn(
              'absolute inline-flex items-center justify-center transition-opacity duration-100',
              checkboxVisible ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100',
            )}
            style={{
              top: 10,
              left: 10,
              zIndex: 2,
              width: 16,
              height: 16,
              borderRadius: 4,
              border: props.checked ? 'none' : '1.5px solid #C2C6D2',
              background: props.checked ? '#0d0d09' : '#fff',
              boxShadow: props.checked ? 'none' : '0 1px 2px rgba(13,13,9,0.06)',
            }}
            onClick={(e) => {
              e.stopPropagation()
              props.onCheckboxClick?.(e)
              props.onCheckedChange?.(!props.checked)
            }}
          >
            {props.checked && <Check size={10} strokeWidth={3} color="#fffcf9" />}
          </button>
        )}

        <div
          className="flex items-start gap-[10px] transition-[padding-left] duration-100"
          style={{ paddingLeft: checkboxVisible ? 22 : 0 }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[6px]">
              <span
                className="flex-1 truncate"
                style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}
                title={candidateName}
              >
                {candidateName}
              </span>
              {props.isFavorite && <Heart size={12} color={PIPELINE_RED} fill={PIPELINE_RED} />}
            </div>
            {role && (
              <div
                className="truncate"
                style={{ fontFamily: 'Inter, sans-serif', fontSize: 10.5, color: PIPELINE_TERTIARY, marginTop: 1 }}
              >
                {role}
              </div>
            )}
            {company && (
              <div
                className="truncate"
                style={{ fontFamily: 'Inter, sans-serif', fontSize: 10.5, color: PIPELINE_TERTIARY, marginTop: 1 }}
              >
                @ {company}
              </div>
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-between"
          style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #F1F0EC' }}
        >
          <span
            className="inline-flex items-center"
            style={{
              gap: 4,
              fontFamily: 'Inter, sans-serif',
              fontSize: 10.5,
              fontWeight: 600,
              color: scoreColor(score),
            }}
          >
            <Sparkles size={10} strokeWidth={2.25} />
            {score ?? '—'}
          </span>
          <span className="inline-flex items-center" style={{ gap: 8 }}>
            <span
              className="inline-flex items-center"
              style={{
                gap: 4,
                fontFamily: 'Inter, sans-serif',
                fontSize: 10.5,
                fontWeight: stale ? 600 : 500,
                color: stale ? PIPELINE_RED : PIPELINE_TERTIARY,
              }}
            >
              <Clock size={10} strokeWidth={2} />
              {daysInStage}d
            </span>
            {duePill && (
              <Badge
                tone="pink"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation()
                  if (nextInterview?.id) {
                    setSelectedBookingId(nextInterview.id)
                    setBookingDialogOpen(true)
                  }
                }}
              >
                {duePill}
              </Badge>
            )}
          </span>
        </div>
      </div>

      <BookingDetailsDialog
        bookingId={selectedBookingId}
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
      />
    </>
  )
}
