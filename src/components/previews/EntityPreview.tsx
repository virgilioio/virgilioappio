import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNowStrict } from 'date-fns'
import { Briefcase, MapPin, Mail, Users } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Loadable } from '@/components/ui/loadable'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Motion & Feel §10 hover previews on cross-entity links (a job named on a candidate's
 * page, a candidate named on a job's page). The HoverCard primitive carries the timing:
 * 500ms to open, neighbours instant, 150ms grace to move into the card. Mouse only:
 * keyboard focus and touch never open it (a tap follows the link). The summary is fetched
 * when the card opens and cached for a minute.
 *
 *   <JobPreview jobId={id}><Link to={`/jobs/${id}`}>{title}</Link></JobPreview>
 */

const META = 'flex min-w-0 items-center gap-1.5 font-inter text-[12px] text-[#5A6072]'

function PreviewShell({ trigger, children }: { trigger: React.ReactElement; children: (open: boolean) => React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      {/* preventDefault on focus stops Radix opening the card for keyboard focus. */}
      <HoverCardTrigger asChild onFocus={(e) => e.preventDefault()}>
        {trigger}
      </HoverCardTrigger>
      <HoverCardContent align="start" sideOffset={6} className="w-72 rounded-xl bg-white p-3.5">
        {children(open)}
      </HoverCardContent>
    </HoverCard>
  )
}

function PreviewSkeleton() {
  return (
    <div className="space-y-2.5">
      <Skeleton className="h-[18px] w-40 rounded-[4px]" />
      <Skeleton className="h-[14px] w-52 rounded-[4px]" />
      <Skeleton className="h-[14px] w-32 rounded-[4px]" />
    </div>
  )
}

function ago(iso?: string | null) {
  if (!iso) return null
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true })
  } catch {
    return null
  }
}

// ── Job ──────────────────────────────────────────────────────────────────────

function useJobPreview(jobId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['entity-preview', 'job', jobId],
    enabled: enabled && !!jobId,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: job, error }, { count }] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, title, status, location, department, created_at, organizations(name)')
          .eq('id', jobId)
          .maybeSingle(),
        supabase
          .from('job_candidate_associations')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId)
          .eq('status', 'active'),
      ])
      if (error) throw error
      return job ? { ...job, active: count ?? null } : null
    },
  })
}

export function JobPreview({ jobId, children }: { jobId: string; children: React.ReactElement }) {
  return <PreviewShell trigger={children}>{(open) => <JobPreviewBody jobId={jobId} open={open} />}</PreviewShell>
}

function JobPreviewBody({ jobId, open }: { jobId: string; open: boolean }) {
  const { data, isPending, isError } = useJobPreview(jobId, open)
  const org = (data?.organizations as { name?: string } | null)?.name
  return (
    <Loadable loading={isPending} skeleton={<PreviewSkeleton />}>
      {isError || !data ? (
        <p className="font-inter text-[12px] text-[#8B8F9E]">Couldn't load this job's summary.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <p className="line-clamp-2 font-poppins text-[13.5px] font-semibold tracking-[-0.01em] text-[#0d0d09]">{data.title}</p>
            <span className="shrink-0 font-inter text-[11px] capitalize text-[#8B8F9E]">{data.status}</span>
          </div>
          {(org || data.department) && (
            <p className={META}>
              <Briefcase size={12} strokeWidth={2} className="shrink-0" />
              <span className="truncate">{[org, data.department].filter(Boolean).join(' · ')}</span>
            </p>
          )}
          {data.location && (
            <p className={META}>
              <MapPin size={12} strokeWidth={2} className="shrink-0" />
              <span className="truncate">{data.location}</span>
            </p>
          )}
          <p className={META}>
            <Users size={12} strokeWidth={2} className="shrink-0" />
            <span className="tabular-nums">
              {data.active == null ? '—' : `${data.active} active candidate${data.active === 1 ? '' : 's'}`}
            </span>
            {ago(data.created_at) && <span className="text-[#8B8F9E]">· opened {ago(data.created_at)}</span>}
          </p>
        </div>
      )}
    </Loadable>
  )
}

// ── Candidate ────────────────────────────────────────────────────────────────

function useCandidatePreview(candidateId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['entity-preview', 'candidate', candidateId],
    enabled: enabled && !!candidateId,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: candidate, error }, { count }] = await Promise.all([
        supabase
          .from('candidates')
          .select('id, candidate_name, current_job_title, company_current, location_city, location_country, email')
          .eq('id', candidateId)
          .maybeSingle(),
        supabase
          .from('job_candidate_associations')
          .select('id', { count: 'exact', head: true })
          .eq('candidate_id', candidateId)
          .eq('status', 'active'),
      ])
      if (error) throw error
      return candidate ? { ...candidate, jobs: count ?? null } : null
    },
  })
}

export function CandidatePreview({ candidateId, children }: { candidateId: string; children: React.ReactElement }) {
  return (
    <PreviewShell trigger={children}>{(open) => <CandidatePreviewBody candidateId={candidateId} open={open} />}</PreviewShell>
  )
}

function CandidatePreviewBody({ candidateId, open }: { candidateId: string; open: boolean }) {
  const { data, isPending, isError } = useCandidatePreview(candidateId, open)
  const role = [data?.current_job_title, data?.company_current].filter(Boolean).join(' @ ')
  const place = [data?.location_city, data?.location_country].filter(Boolean).join(', ')
  return (
    <Loadable loading={isPending} skeleton={<PreviewSkeleton />}>
      {isError || !data ? (
        <p className="font-inter text-[12px] text-[#8B8F9E]">Couldn't load this candidate's summary.</p>
      ) : (
        <div className="space-y-2">
          <p className="truncate font-poppins text-[13.5px] font-semibold tracking-[-0.01em] text-[#0d0d09]">
            {data.candidate_name?.trim() || 'Unnamed candidate'}
          </p>
          {role && (
            <p className={META}>
              <Briefcase size={12} strokeWidth={2} className="shrink-0" />
              <span className="truncate">{role}</span>
            </p>
          )}
          {place && (
            <p className={META}>
              <MapPin size={12} strokeWidth={2} className="shrink-0" />
              <span className="truncate">{place}</span>
            </p>
          )}
          {data.email && (
            <p className={META}>
              <Mail size={12} strokeWidth={2} className="shrink-0" />
              <span className="truncate">{data.email}</span>
            </p>
          )}
          <p className={META}>
            <Users size={12} strokeWidth={2} className="shrink-0" />
            <span className="tabular-nums">
              {data.jobs == null ? '—' : `In ${data.jobs} active job${data.jobs === 1 ? '' : 's'}`}
            </span>
          </p>
        </div>
      )}
    </Loadable>
  )
}
