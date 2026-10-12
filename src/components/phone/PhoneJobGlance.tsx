import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Monitor } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { usePermissions } from '@/hooks/usePermissions'
import { useScheduledBookings } from '@/hooks/useScheduledBookings'
import { AgendaRow } from './PhoneAgenda'
import { Initials, PhoneCard, PhoneEmpty, PhonePage, PhoneRow, PhoneSection, PhoneSkeletonRows, Pill } from './PhoneUI'

/**
 * A job at a glance on a phone (2026-10-12): the job, how many people sit
 * in each stage, upcoming interviews for it, and who's in the pipeline.
 * Moving people, editing the job and the board stay on the computer.
 */

interface StageRow { id: string; position: number; custom_stage_name: string | null; stage: { stage_name: string | null } | null }
interface PersonRow {
  id: string
  status: string | null
  entered_stage_at: string | null
  candidate_id: string
  current_stage_id: string | null
  candidates: { id: string; candidate_name: string | null; current_job_title: string | null; company_current: string | null } | null
}

const stageName = (s: StageRow) => s.custom_stage_name || s.stage?.stage_name || 'Stage'
const daysSince = (iso: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : null)

export default function PhoneJobGlance() {
  const params = useParams()
  const jobId = params.jobId ?? params.id ?? ''
  const permissions = usePermissions()

  const job = useQuery({
    queryKey: ['phone-job', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, status, location, organization:organizations(name)')
        .eq('id', jobId)
        .maybeSingle()
      if (error) throw error
      return data as unknown as { id: string; title: string; status: string; location: string | null; organization: { name: string } | null } | null
    },
  })
  const stages = useQuery({
    queryKey: ['phone-job-stages', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_hiring_stages')
        .select('id, position, custom_stage_name, stage:job_stages(stage_name)')
        .eq('job_id', jobId)
        .order('position', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as StageRow[]
    },
  })
  const people = useQuery({
    queryKey: ['phone-job-people', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select('id, status, entered_stage_at, candidate_id, current_stage_id, candidates(id, candidate_name, current_job_title, company_current)')
        .eq('job_id', jobId)
        .in('status', ['active', 'offer'])
      if (error) throw error
      return (data ?? []) as unknown as PersonRow[]
    },
  })
  const { bookings } = useScheduledBookings('upcoming', permissions)
  const upcoming = useMemo(() => (bookings ?? []).filter(b => b.job_id === jobId && b.status !== 'cancelled').slice(0, 3), [bookings, jobId])

  const byStage = useMemo(() => {
    const list = stages.data ?? []
    const rows = people.data ?? []
    return list.map(s => ({
      stage: s,
      people: rows.filter(p => p.current_stage_id === s.id)
        .sort((a, b) => (a.entered_stage_at ?? '').localeCompare(b.entered_stage_at ?? '')),
    }))
  }, [stages.data, people.data])
  const total = people.data?.length ?? 0
  const max = Math.max(1, ...byStage.map(s => s.people.length))

  if (job.isFetched && !job.data) {
    return (
      <PhonePage>
        <PhoneCard><PhoneEmpty>This job doesn’t exist or you don’t have access.</PhoneEmpty></PhoneCard>
      </PhonePage>
    )
  }

  return (
    <PhonePage>
      <div className="mb-5">
        {job.isLoading ? (
          <div className="space-y-2"><span className="gio-shimmer block h-6 w-3/4 rounded" /><span className="gio-shimmer block h-3.5 w-1/2 rounded" /></div>
        ) : (
          <>
            <div className="mb-1 flex items-center gap-2">
              <Pill tone={job.data?.status === 'open' ? 'green' : 'neutral'}>{job.data?.status === 'open' ? 'Open' : job.data?.status === 'draft' ? 'Draft' : 'Closed'}</Pill>
              <span className="font-inter text-[12.5px] tabular-nums text-[#5A6072]">{total} active</span>
            </div>
            <h1 className="font-poppins font-semibold text-[24px] leading-[1.2] tracking-[-0.03em] text-[#0d0d09] line-clamp-3">
              {job.data?.title}<span className="text-[#D7C5FB]">.</span>
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 font-inter text-[13px] text-[#5A6072]">
              {job.data?.organization?.name && <span>{job.data.organization.name}</span>}
              {job.data?.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.data.location}</span>}
            </p>
          </>
        )}
      </div>

      {/* Funnel at a glance */}
      <PhoneSection label="Stages">
        <PhoneCard className="px-4 py-3">
          {stages.isLoading ? <span aria-hidden className="gio-shimmer block h-24 w-full rounded" /> : byStage.length === 0 ? (
            <p className="font-inter text-[13px] text-[#6B7080]">No stages set up.</p>
          ) : (
            <ul className="space-y-2">
              {byStage.map(({ stage, people: ps }) => (
                <li key={stage.id} className="flex items-center gap-3">
                  <span className="w-[38%] truncate font-inter text-[12.5px] text-[#1F2230]">{stageName(stage)}</span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-[#F1F0EC]">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-[#6F3FF5]" style={{ width: `${(ps.length / max) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right font-poppins font-semibold text-[13px] tabular-nums text-[#0d0d09]">{ps.length}</span>
                </li>
              ))}
            </ul>
          )}
        </PhoneCard>
      </PhoneSection>

      {upcoming.length > 0 && (
        <PhoneSection label="Upcoming interviews" count={upcoming.length}>
          <PhoneCard>{upcoming.map((b, i) => <AgendaRow key={b.id} b={b} next={i === 0} />)}</PhoneCard>
        </PhoneSection>
      )}

      <PhoneSection label="Pipeline" count={people.isLoading ? null : total}>
        {people.isLoading ? <PhoneCard><PhoneSkeletonRows rows={3} /></PhoneCard> : total === 0 ? (
          <PhoneCard><PhoneEmpty>No one in this pipeline yet.</PhoneEmpty></PhoneCard>
        ) : (
          <div className="space-y-4">
            {byStage.filter(s => s.people.length > 0).map(({ stage, people: ps }) => (
              <div key={stage.id}>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <span className="font-inter font-semibold text-[12.5px] text-[#0d0d09]">{stageName(stage)}</span>
                  <span className="font-inter text-[11.5px] tabular-nums text-[#6B7080]">{ps.length}</span>
                </div>
                <PhoneCard>
                  {ps.map(p => {
                    const d = daysSince(p.entered_stage_at)
                    const name = p.candidates?.candidate_name || 'Unnamed candidate'
                    return (
                      <PhoneRow
                        key={p.id}
                        to={`/jobs/${jobId}/candidates/${p.candidate_id}`}
                        leading={<Initials name={name} />}
                        title={name}
                        meta={[p.candidates?.current_job_title, p.candidates?.company_current].filter(Boolean).join(' · ') || undefined}
                        trailing={d !== null ? <Pill tone={d >= 21 ? 'red' : d >= 14 ? 'amber' : 'neutral'}>{d}d</Pill> : undefined}
                        chevron={false}
                      />
                    )
                  })}
                </PhoneCard>
              </div>
            ))}
          </div>
        )}
      </PhoneSection>

      <p className="mt-2 flex items-center justify-center gap-1.5 font-inter text-[12px] text-[#6B7080]">
        <Monitor className="h-3.5 w-3.5" />
        Moving people and editing the job are on the computer.
      </p>
    </PhonePage>
  )
}
