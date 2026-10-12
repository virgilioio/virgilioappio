import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Linkedin, Mail, MapPin, MessageCircle, Monitor, Phone } from 'lucide-react'
import { format } from 'date-fns'
import { useIndependentCandidate } from '@/hooks/useIndependentCandidate'
import { useCandidateJobAssociations, type CandidateJobAssociation } from '@/hooks/useCandidateJobAssociations'
import { useAssociationScorecards } from '@/hooks/useAssociationScorecards'
import { useScheduledBookings } from '@/hooks/useScheduledBookings'
import { usePermissions } from '@/hooks/usePermissions'
import { RATING_META, RATING_VALUES, coerceRating } from '@/lib/scorecardRatings'
import { buildWhatsAppUrl } from '@/utils/phoneUtils'
import { ensureAbsoluteUrl } from '@/lib/utils'
import { AgendaRow } from './PhoneAgenda'
import { Initials, PhoneCard, PhoneEmpty, PhonePage, PhoneSection, PhoneSkeletonRows, Pill } from './PhoneUI'

/**
 * A candidate at a glance on a phone (2026-10-12): who they are, how to
 * reach them, where they are in your pipelines, what the panel thought
 * (scorecard summaries) and their next interview. The full profile —
 * résumé, emails, comments, editing — stays on the computer.
 */

function plainText(html: string | null | undefined): string {
  if (!html) return ''
  try {
    return (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim()
  } catch {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
}

function stageOf(a: CandidateJobAssociation): string {
  return a.current_stage?.custom_stage_name || a.current_stage?.stage?.stage_name || 'In pipeline'
}

function statusTone(status: string | null): 'purple' | 'green' | 'red' | 'amber' | 'neutral' {
  if (status === 'hired') return 'green'
  if (status === 'rejected') return 'red'
  if (status === 'offer') return 'amber'
  if (status === 'active') return 'purple'
  return 'neutral'
}

export default function PhoneCandidateGlance() {
  const { candidateId = '' } = useParams()
  const permissions = usePermissions()
  const { candidate, isLoading } = useIndependentCandidate(candidateId)
  const { jobAssociations, isLoading: assocLoading } = useCandidateJobAssociations(candidateId || null)
  const { bookings } = useScheduledBookings('upcoming', permissions)

  const next = useMemo(
    () => (bookings ?? []).filter(b => b.candidate_id === candidateId && b.status !== 'cancelled').slice(0, 2),
    [bookings, candidateId],
  )
  const pipelines = useMemo(() => {
    const order = { active: 0, offer: 0, hired: 1, rejected: 2 } as Record<string, number>
    return [...jobAssociations].sort((a, b) => (order[a.status ?? ''] ?? 3) - (order[b.status ?? ''] ?? 3))
  }, [jobAssociations])

  if (!isLoading && !candidate) {
    return (
      <PhonePage>
        <PhoneCard><PhoneEmpty>This candidate doesn’t exist or you don’t have access.</PhoneEmpty></PhoneCard>
      </PhonePage>
    )
  }

  const name = candidate?.candidate_name || 'Unnamed candidate'
  const role = [candidate?.current_job_title || candidate?.standardized_title, candidate?.company_current].filter(Boolean).join(' · ')
  const where = [candidate?.location_city, candidate?.location_country].filter(Boolean).join(', ')
  const wa = candidate?.phone ? buildWhatsAppUrl(candidate.phone) : null
  const summary = plainText(candidate?.profile_summary)

  const actions = [
    candidate?.phone && { label: 'Call', Icon: Phone, href: `tel:${candidate.phone.replace(/\s+/g, '')}` },
    wa && { label: 'WhatsApp', Icon: MessageCircle, href: wa },
    candidate?.email && { label: 'Email', Icon: Mail, href: `mailto:${candidate.email}` },
    candidate?.linkedin_url && { label: 'LinkedIn', Icon: Linkedin, href: ensureAbsoluteUrl(candidate.linkedin_url) },
  ].filter(Boolean) as { label: string; Icon: typeof Phone; href: string }[]

  return (
    <PhonePage>

      {/* Who */}
      <div className="mb-5 flex items-start gap-3.5">
        {isLoading ? <span className="gio-shimmer block h-14 w-14 rounded-full" /> : <Initials name={name} size={56} tone="ink" />}
        <div className="min-w-0 flex-1 pt-0.5">
          {isLoading ? (
            <div className="space-y-2"><span className="gio-shimmer block h-5 w-2/3 rounded" /><span className="gio-shimmer block h-3.5 w-1/2 rounded" /></div>
          ) : (
            <>
              <h1 className="font-poppins font-semibold text-[22px] leading-[1.2] tracking-[-0.03em] text-[#0d0d09] line-clamp-2">
                {name}<span className="text-[#D7C5FB]">.</span>
              </h1>
              {role && <p className="mt-1 font-inter text-[13.5px] text-[#1F2230] line-clamp-2">{role}</p>}
              {where && (
                <p className="mt-0.5 flex items-center gap-1 font-inter text-[12.5px] text-[#5A6072]">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{where}</span>
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reach them */}
      {actions.length > 0 && (
        <div className="mb-6 grid gap-2" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
          {actions.map(({ label, Icon, href }) => (
            <a
              key={label}
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="gio-pressable flex h-[60px] flex-col items-center justify-center gap-1 rounded-[12px] border border-[#E7E8EE] bg-white font-inter font-medium text-[12px] text-[#0d0d09]"
            >
              <Icon className="h-[18px] w-[18px] text-[#6F3FF5]" />
              {label}
            </a>
          ))}
        </div>
      )}

      {next.length > 0 && (
        <PhoneSection label="Next interview">
          <PhoneCard>{next.map((b, i) => <AgendaRow key={b.id} b={b} next={i === 0} />)}</PhoneCard>
        </PhoneSection>
      )}

      <PhoneSection label="Pipelines" count={assocLoading ? null : pipelines.length}>
        {assocLoading && pipelines.length === 0 ? (
          <PhoneCard><PhoneSkeletonRows rows={1} /></PhoneCard>
        ) : pipelines.length === 0 ? (
          <PhoneCard><PhoneEmpty>Not in any pipeline yet.</PhoneEmpty></PhoneCard>
        ) : (
          <div className="space-y-3">
            {pipelines.map(a => <PipelineCard key={a.id} a={a} />)}
          </div>
        )}
      </PhoneSection>

      {summary && (
        <PhoneSection label="Summary">
          <PhoneCard className="px-4 py-3">
            <p className="font-inter text-[13.5px] leading-[1.55] text-[#1F2230] line-clamp-6">{summary}</p>
          </PhoneCard>
        </PhoneSection>
      )}

      <p className="mt-2 flex items-center justify-center gap-1.5 font-inter text-[12px] text-[#6B7080]">
        <Monitor className="h-3.5 w-3.5" />
        Résumé, emails and editing are on the computer.
      </p>
    </PhonePage>
  )
}

/** One pipeline: the job, the stage, and the panel's verdicts. */
function PipelineCard({ a }: { a: CandidateJobAssociation }) {
  const { scorecards, loading } = useAssociationScorecards(a.id)
  const submitted = scorecards.filter(s => !s.is_ai_draft && coerceRating(s.rating))
  const counts = RATING_VALUES.map(v => ({ v, n: submitted.filter(s => coerceRating(s.rating) === v).length })).filter(x => x.n > 0)
  const avg = submitted.length ? submitted.reduce((s, x) => s + RATING_META[coerceRating(x.rating)!].numeric, 0) / submitted.length : null

  return (
    <PhoneCard>
      <Link to={`/jobs/${a.job_id}`} className="gio-pressable flex items-center gap-3 border-b border-[#F1F0EC] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-inter font-semibold text-[14px] text-[#0d0d09]">{a.job?.title ?? 'Job'}</div>
          <div className="truncate font-inter text-[12.5px] text-[#5A6072]">{a.job?.organization?.name ?? ''}</div>
        </div>
        <Pill tone={statusTone(a.status)}>{a.status === 'active' ? stageOf(a) : a.status === 'offer' ? 'Offer' : a.status === 'hired' ? 'Hired' : a.status === 'rejected' ? 'Rejected' : stageOf(a)}</Pill>
      </Link>

      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-inter font-semibold text-[12px] uppercase tracking-[0.06em] text-[#6B7080]">Scorecards</span>
          {avg !== null && (
            <span className="font-inter text-[12px] tabular-nums text-[#5A6072]">
              Avg <strong className="font-semibold text-[#0d0d09]">{avg.toFixed(1)}</strong> / 5 · {submitted.length}
            </span>
          )}
        </div>
        {loading && scorecards.length === 0 ? (
          <span aria-hidden className="gio-shimmer block h-3 w-1/2 rounded" />
        ) : submitted.length === 0 ? (
          <p className="font-inter text-[12.5px] text-[#6B7080]">No scorecards submitted yet.</p>
        ) : (
          <>
            {/* The verdict mix, strongest first */}
            <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-[#F1F0EC]" aria-hidden="true">
              {[...counts].reverse().map(({ v, n }) => (
                <span key={v} style={{ width: `${(n / submitted.length) * 100}%`, background: RATING_META[v].bg }} />
              ))}
            </div>
            <ul className="space-y-2.5">
              {submitted.slice(0, 4).map(s => {
                const meta = RATING_META[coerceRating(s.rating)!]
                const note = plainText(s.general_overview)
                return (
                  <li key={s.id}>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-[22px] items-center rounded-full px-2 font-inter font-semibold text-[11.5px]" style={{ background: meta.bg, color: meta.text }}>
                        {meta.label}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-inter text-[12.5px] text-[#1F2230]">
                        {s.author_name ?? 'Interviewer'}{s.stage_name ? ` · ${s.stage_name}` : ''}
                      </span>
                      <span className="shrink-0 font-inter text-[11.5px] tabular-nums text-[#6B7080]">{format(new Date(s.created_at), 'MMM d')}</span>
                    </div>
                    {note && <p className="mt-1 font-inter text-[12.5px] leading-[1.5] text-[#5A6072] line-clamp-3">{note}</p>}
                  </li>
                )
              })}
            </ul>
            {submitted.length > 4 && <p className="mt-2 font-inter text-[12px] text-[#6B7080]">{submitted.length - 4} more on the computer.</p>}
          </>
        )}
      </div>
    </PhoneCard>
  )
}
