import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, User, Plus, X, CalendarPlus, Link as LinkIcon, Settings2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useBookingConfig } from '@/hooks/useBookingConfig'
import { useContextualBookingLink } from '@/hooks/useContextualBookingLink'
import { useUserProfile } from '@/hooks/useUserProfile'

export interface BookingCardPayload {
  kind: 'booking_link'
  variant: 'job' | 'personal' | 'custom'
  url: string
  title: string
  meta: string
  status?: 'awaiting' | 'booked'
}

interface Props {
  threadId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (payload: BookingCardPayload) => void
}

interface ThreadCtx {
  jobId: string | null
  candidateId: string | null
  associationId: string | null
  jhsId: string | null
  jobTitle: string | null
  candidateName: string | null
  candidateEmail: string | null
  stageName: string | null
}

function useThreadBookingCtx(threadId: string | undefined, enabled: boolean) {
  const [ctx, setCtx] = useState<ThreadCtx | null>(null)
  useEffect(() => {
    let alive = true
    if (!threadId || !enabled) return
    ;(async () => {
      const sb = supabase as any
      const { data: row } = await sb
        .from('chat_threads')
        .select('candidate_id, job_id, association_id')
        .eq('id', threadId)
        .maybeSingle()
      if (!row || !alive) return
      const [cand, job, assoc] = await Promise.all([
        row.candidate_id
          ? sb.from('candidates').select('candidate_name, email').eq('id', row.candidate_id).maybeSingle()
          : Promise.resolve({ data: null }),
        row.job_id
          ? sb.from('jobs').select('title').eq('id', row.job_id).maybeSingle()
          : Promise.resolve({ data: null }),
        row.association_id
          ? sb
              .from('job_candidate_associations')
              .select('current_stage_id')
              .eq('id', row.association_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      let stageName: string | null = null
      const jhsId = assoc?.data?.current_stage_id ?? null
      if (jhsId) {
        const { data: hs } = await sb
          .from('job_hiring_stages')
          .select('custom_stage_name, job_stages:job_stages(stage_name)')
          .eq('id', jhsId)
          .maybeSingle()
        const js = Array.isArray(hs?.job_stages) ? hs?.job_stages[0] : hs?.job_stages
        stageName = hs?.custom_stage_name || js?.stage_name || null
      }
      if (!alive) return
      setCtx({
        jobId: row.job_id ?? null,
        candidateId: row.candidate_id ?? null,
        associationId: row.association_id ?? null,
        jhsId,
        jobTitle: job?.data?.title ?? null,
        candidateName: cand?.data?.candidate_name ?? null,
        candidateEmail: cand?.data?.email ?? null,
        stageName,
      })
    })()
    return () => {
      alive = false
    }
  }, [threadId, enabled])
  return ctx
}

/**
 * BookingLinkPopover — anchored above the composer. Shows the candidate's
 * current-stage job link (if configured) + the signed-in recruiter's personal
 * link. Selecting a row inserts a booking-link card into the thread.
 */
export function BookingLinkPopover({ threadId, open, onOpenChange, onPick }: Props) {
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const ctx = useThreadBookingCtx(threadId, open)
  const { config } = useBookingConfig()
  const { profile } = useUserProfile()

  const contextualParams =
    open && ctx?.jobId && ctx?.candidateId && ctx?.jhsId && ctx?.associationId
      ? {
          jobId: ctx.jobId,
          candidateId: ctx.candidateId,
          jhsId: ctx.jhsId,
          associationId: ctx.associationId,
          candidateName: ctx.candidateName ?? undefined,
          candidateEmail: ctx.candidateEmail ?? undefined,
          jobTitle: ctx.jobTitle ?? undefined,
          stageName: ctx.stageName ?? undefined,
        }
      : null
  const jobLink = useContextualBookingLink(contextualParams)

  // Click outside / Esc
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) onOpenChange(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  if (!open) return null

  const personalUrl =
    config?.short_code && config.is_active
      ? `${window.location.origin}/schedule/${config.short_code}`
      : null
  const recruiterName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
    config?.display_name ||
    'You'
  const personalDuration = config?.duration_minutes ?? 30
  const personalSlug = config?.short_code ? `cal.gio/${config.short_code}` : ''

  const showJobRow = Boolean(jobLink.contextualLink && jobLink.hasAssignedBookingConfig)
  const jobUrl = jobLink.contextualLink

  const handlePickJob = () => {
    if (!jobUrl || !ctx) return
    onPick({
      kind: 'booking_link',
      variant: 'job',
      url: jobUrl,
      title: `${ctx.stageName || 'Interview'} · ${ctx.jobTitle || 'Job'}`,
      meta: `${personalDuration} min · team round-robin`,
      status: 'awaiting',
    })
    onOpenChange(false)
  }

  const handlePickPersonal = () => {
    if (!personalUrl) return
    onPick({
      kind: 'booking_link',
      variant: 'personal',
      url: personalUrl,
      title: `Intro call with ${recruiterName}`,
      meta: `${personalDuration} min · video`,
      status: 'awaiting',
    })
    onOpenChange(false)
  }

  const handlePaste = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      const trimmed = (clip || '').trim()
      if (!trimmed) return
      onPick({
        kind: 'booking_link',
        variant: 'custom',
        url: trimmed,
        title: 'Booking link',
        meta: trimmed.replace(/^https?:\/\//, ''),
        status: 'awaiting',
      })
      onOpenChange(false)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Send a booking link"
      style={{
        position: 'absolute',
        left: 22,
        right: 22,
        bottom: '100%',
        marginBottom: 10,
        background: '#FFFFFF',
        border: '1px solid #E7E8EE',
        borderRadius: 14,
        boxShadow: '0 12px 32px rgba(15,18,34,0.14)',
        padding: 14,
        zIndex: 30,
      }}
    >
      {/* Header */}
      <div className="flex items-center" style={{ marginBottom: 10, padding: '0 3px', gap: 9 }}>
        <span
          className="flex items-center justify-center shrink-0"
          style={{ height: 22, width: 22, borderRadius: 7, background: '#EDE4FF', color: '#6F3FF5' }}
        >
          <CalendarPlus style={{ height: 13, width: 13 }} strokeWidth={2} />
        </span>
        <span
          className="font-poppins"
          style={{ fontSize: 13, fontWeight: 600, color: '#0d0d09' }}
        >
          Send a booking link
        </span>
        <button
          type="button"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
          className="ml-auto inline-flex items-center justify-center"
          style={{ height: 22, width: 22, borderRadius: 6, border: 0, background: 'transparent', color: '#8B8F9E' }}
        >
          <X style={{ height: 14, width: 14 }} strokeWidth={2} />
        </button>
      </div>

      {/* This job's link */}
      {showJobRow && (
        <>
          <SectionLabel style={{ padding: '6px 4px 3px' }}>This job's link</SectionLabel>
          <LinkRow
            tile={{ bg: '#EDE4FF', fg: '#6F3FF5' }}
            icon={Briefcase}
            title={`${ctx?.jobTitle || 'Job'} · ${ctx?.stageName || 'Interview'}`}
            badge={ctx?.stageName ? `${ctx.stageName} stage` : null}
            meta={`Team round-robin · ${personalDuration} min`}
            onClick={handlePickJob}
          />
        </>
      )}

      {/* Personal link */}
      <SectionLabel style={{ padding: showJobRow ? '10px 4px 3px' : '6px 4px 3px' }}>
        Your personal link
      </SectionLabel>
      {personalUrl ? (
        <LinkRow
          tile={{ bg: '#DBEAFE', fg: '#2563EB' }}
          icon={User}
          title={`${recruiterName} · Intro call`}
          meta={`${personalSlug} · ${personalDuration} min`}
          onClick={handlePickPersonal}
        />
      ) : (
        <div
          className="font-inter"
          style={{ padding: '10px 11px', fontSize: 11.5, color: '#8B8F9E' }}
        >
          You don't have a personal booking link yet. Set one up in Settings.
        </div>
      )}

      {/* Footer */}
      <div
        className="flex items-center"
        style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid #F1F0EC', gap: 8 }}
      >
        <FooterBtn icon={LinkIcon} label="Paste a link" onClick={handlePaste} />
        <FooterBtn
          icon={Settings2}
          label="Manage links"
          onClick={() => {
            onOpenChange(false)
            navigate('/settings?tab=scheduling')
          }}
        />
      </div>
    </div>
  )
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="font-inter"
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: '#8B8F9E',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function LinkRow({
  tile,
  icon: Icon,
  title,
  badge,
  meta,
  onClick,
}: {
  tile: { bg: string; fg: string }
  icon: typeof Briefcase
  title: string
  badge?: string | null
  meta: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center transition-colors"
      style={{
        gap: 11,
        padding: '10px 11px',
        borderRadius: 10,
        background: 'transparent',
        border: 0,
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#F6F5F1')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span
        className="flex items-center justify-center shrink-0"
        style={{ height: 34, width: 34, borderRadius: 9, background: tile.bg, color: tile.fg }}
      >
        <Icon style={{ height: 17, width: 17 }} strokeWidth={2} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center" style={{ gap: 7 }}>
          <span
            className="font-poppins truncate"
            style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09' }}
          >
            {title}
          </span>
          {badge && (
            <span
              className="font-poppins shrink-0"
              style={{
                padding: '2px 7px',
                borderRadius: 999,
                background: '#EDE4FF',
                color: '#5B21B6',
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: '-0.005em',
              }}
            >
              {badge}
            </span>
          )}
        </span>
        <span
          className="block font-inter truncate"
          style={{ marginTop: 2, fontSize: 11, color: '#8B8F9E' }}
        >
          {meta}
        </span>
      </span>
      <Plus style={{ height: 16, width: 16, color: '#5A6072' }} strokeWidth={2} />
    </button>
  )
}

function FooterBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof LinkIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center font-poppins transition-colors"
      style={{
        flex: 1,
        gap: 7,
        height: 30,
        borderRadius: 8,
        background: '#FFFFFF',
        border: '1px solid #E7E8EE',
        color: '#1F2230',
        fontSize: 12,
        fontWeight: 500,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#F6F5F1')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
    >
      <Icon style={{ height: 13, width: 13 }} strokeWidth={2} />
      {label}
    </button>
  )
}
