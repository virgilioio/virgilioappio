/** Job Setup › Client view. Every control saves immediately. */
import { Fragment, useEffect, useMemo, useState } from 'react'
import { makeSwapIcon } from '@/components/ui/icon-swap'
import { formatDistanceToNowStrict } from 'date-fns'
import { Check, ChevronRight, Copy, Eye, EyeOff, Globe, Link2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { supabase } from '@/integrations/supabase/client'
import { copyToClipboardSilent } from '@/utils/clipboard'
import { toast } from '@/hooks/use-toast'
import { PASTELS } from '@/lib/pastels'
import { stageColor } from './pipelineVisuals'
import {
  NON_RECRUITING_STAGE_TYPES, pipelinePublicUrl, useJobPipelineShare, type PipelineShareSettings,
} from '@/hooks/useJobPipelineShare'

// §7 copy chips: Copy shrinks out, Check grows in.
const CopyCheckIcon = makeSwapIcon(Copy, Check)

interface StageRow { id: string; name: string; type: string; count: number }
export type ClientSectionKey = 'application' | 'recruiting' | 'offers' | 'hired' | 'rejected'
export type ClientSectionCounts = Record<ClientSectionKey, number>

export function useJobStageCounts(jobId: string) {
  const [stages, setStages] = useState<StageRow[]>([])
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: rows } = await supabase
        .from('job_hiring_stages')
        .select('id, position, custom_stage_name, job_stages(stage_name, stage_type)')
        .eq('job_id', jobId)
        .order('position', { ascending: true })
      const { data: assocs } = await supabase
        .from('job_candidate_associations')
        .select('current_stage_id, status')
        .eq('job_id', jobId)
      const counts = new Map<string, number>()
      for (const a of assocs ?? []) {
        if (['rejected', 'withdrawn', 'hired'].includes(String(a.status ?? ''))) continue
        if (a.current_stage_id) counts.set(a.current_stage_id, (counts.get(a.current_stage_id) ?? 0) + 1)
      }
      if (!active) return
      setStages((rows ?? []).map((r: any) => ({
        id: r.id,
        name: r.custom_stage_name || r.job_stages?.stage_name || 'Stage',
        type: String(r.job_stages?.stage_type ?? ''),
        count: counts.get(r.id) ?? 0,
      })))
    })()
    return () => { active = false }
  }, [jobId])
  return stages
}

export function useJobClientSectionCounts(jobId: string, stages: StageRow[]): ClientSectionCounts {
  const [counts, setCounts] = useState<ClientSectionCounts>({ application: 0, recruiting: 0, offers: 0, hired: 0, rejected: 0 })
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.from('job_candidate_associations').select('status, current_stage_id').eq('job_id', jobId)
      if (!active) return
      const byId = new Map(stages.map((s) => [s.id, s.type]))
      const next: ClientSectionCounts = { application: 0, recruiting: 0, offers: 0, hired: 0, rejected: 0 }
      for (const row of data ?? []) {
        const status = String(row.status ?? '').toLowerCase()
        const type = row.current_stage_id ? byId.get(row.current_stage_id) : undefined
        if (status === 'rejected' || status === 'withdrawn') next.rejected += 1
        else if (status === 'hired') next.hired += 1
        else if (status === 'offer' || status === 'offered' || type === 'offer') next.offers += 1
        else if (type === 'application' || type === 'application_review') next.application += 1
        else if (type && !NON_RECRUITING_STAGE_TYPES.has(type)) next.recruiting += 1
      }
      setCounts(next)
    })()
    return () => { active = false }
  }, [jobId, stages])
  return counts
}

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)} className="relative shrink-0 disabled:opacity-50"
      style={{ width: 36, height: 20, borderRadius: 999, background: checked ? '#6F3FF5' : '#D1D0CB', transition: 'background 140ms' }}>
      <span style={{ position: 'absolute', top: 3, left: checked ? 19 : 3, width: 14, height: 14, borderRadius: 999, background: '#fff', transition: 'left 140ms' }} />
    </button>
  )
}

function FormSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E7E8EE', borderRadius: 12, padding: 18 }}>
      <div className="font-poppins" style={{ fontSize: 13.5, fontWeight: 600, color: '#1F2230' }}>{title}</div>
      {subtitle && <p className="font-inter" style={{ fontSize: 12, color: '#8B8F9E', marginTop: 3, lineHeight: 1.5 }}>{subtitle}</p>}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  )
}

function Toggle({ title, description, checked, onChange, disabled }: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center font-inter" style={{ gap: 12, padding: '10px 0', borderTop: '1px solid #F6F5F1' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#8B8F9E', marginTop: 2 }}>{description}</div>
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={title} />
    </div>
  )
}

const EXCLUDED = ['Contact details', 'Links & files', 'Offer terms', 'Source & referrer', 'Tags', 'Activity', 'Emails', 'Comments', 'Suggested']
const SECTION_DEFS: Array<{ key: ClientSectionKey; label: string; tone: keyof typeof PASTELS; field?: keyof PipelineShareSettings }> = [
  { key: 'application', label: 'Application review', tone: 'purple', field: 'share_application' },
  { key: 'recruiting', label: 'Recruiting process', tone: 'yellow' },
  { key: 'offers', label: 'Job offers', tone: 'blue', field: 'share_offers' },
  { key: 'hired', label: 'Hired', tone: 'green', field: 'share_hired' },
  { key: 'rejected', label: 'Rejected', tone: 'neutral', field: 'share_rejected' },
]

export function ClientViewSection({ jobId, readOnly, recruiterName }: { jobId: string; readOnly: boolean; recruiterName?: string }) {
  const { share, update, resetToken } = useJobPipelineShare(jobId, !readOnly)
  const stages = useJobStageCounts(jobId)
  const sectionCounts = useJobClientSectionCounts(jobId, stages)
  const [copied, setCopied] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const recruiting = useMemo(() => stages.filter((s) => !NON_RECRUITING_STAGE_TYPES.has(s.type)), [stages])
  const selectedIds = useMemo(() => new Set(share?.visible_stage_ids ?? []), [share?.visible_stage_ids])
  const visible = useMemo(() => recruiting.filter((s) => selectedIds.has(s.id)), [recruiting, selectedIds])
  const set = (patch: PipelineShareSettings) => { if (!readOnly) void update(patch) }
  const on = !!share?.is_public
  const url = share ? pipelinePublicUrl(share.token) : ''
  const sectionOn = (key: ClientSectionKey) => key === 'recruiting' || !!share?.[`share_${key}` as keyof typeof share]
  const sharedSections = SECTION_DEFS.filter((s) => sectionOn(s.key))
  const visibleRecruitingCount = visible.reduce((n, s) => n + s.count, 0)
  const totalVisible = sharedSections.reduce((n, s) => n + (s.key === 'recruiting' ? visibleRecruitingCount : sectionCounts[s.key]), 0)

  const toggleStage = (s: StageRow) => {
    if (readOnly || !share) return
    const next = new Set(selectedIds)
    if (next.has(s.id)) {
      if (next.size === 1) {
        toast({ title: 'At least one stage must be visible', description: 'Turn the client view off instead if you want to hide everything.' })
        return
      }
      next.delete(s.id)
    } else next.add(s.id)
    set({ visible_stage_ids: recruiting.filter((r) => next.has(r.id)).map((r) => r.id) })
  }

  const applyPreset = (preset: 'shortlist' | 'active' | 'everything') => {
    if (!share || readOnly || recruiting.length === 0) return
    const all = recruiting.map((r) => r.id)
    const shortlistStart = Math.min(2, recruiting.length - 1)
    set({
      share_application: preset !== 'shortlist',
      share_offers: preset === 'everything',
      share_hired: preset === 'everything',
      share_rejected: preset === 'everything',
      visible_stage_ids: preset === 'shortlist' ? all.slice(shortlistStart) : all,
    })
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center" style={{ gap: 10 }}>
        <h2 className="font-poppins" style={{ fontSize: 18, fontWeight: 600, color: '#1F2230' }}>Client view<span style={{ color: '#D7C5FB' }}>.</span></h2>
        <span style={{ marginLeft: 'auto' }}>{on ? <Badge tone="green" size="sm" dot>{`Live · ${sharedSections.length} section${sharedSections.length === 1 ? '' : 's'}`}</Badge> : <Badge tone="neutral" size="sm">Off</Badge>}</span>
      </div>

      <FormSection title="Public pipeline" subtitle="A read-only, real-time view of this pipeline for the client. No Gio account needed.">
        <div className="flex items-center font-inter" style={{ gap: 12 }}>
          <span className="inline-flex items-center justify-center shrink-0" style={{ width: 32, height: 32, borderRadius: 8, background: on ? '#EDE4FF' : '#F1F0EC', color: on ? '#5B21B6' : '#8B8F9E' }}><Globe size={15} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1F2230' }}>Share this pipeline with the client</div>
            <div style={{ fontSize: 11.5, color: '#8B8F9E', marginTop: 2 }}>{on ? 'Anyone with the link can view — no Gio account needed. Moves, new candidates and feedback show up as they happen.' : 'Off. The link shows an unavailable page until you turn it back on.'}</div>
          </div>
          <Switch checked={on} disabled={readOnly || !share} label="Share this pipeline with the client" onChange={(v) => set({ is_public: v, ...(v && !(share?.visible_stage_ids?.length) && recruiting.length ? { visible_stage_ids: recruiting.map((r) => r.id) } : {}) })} />
        </div>
        {on && share && <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F1F0EC' }}>
          <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
            <span className="truncate" style={{ flex: '1 1 220px', minWidth: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#5A6072', background: '#FBFAF7', border: '1px solid #EFEEE8', borderRadius: 7, padding: '7px 10px' }}>{url}</span>
            <Button variant="secondary" size="sm" icon={CopyCheckIcon} data-swapped={copied || undefined} onClick={async () => { if (await copyToClipboardSilent(url)) { setCopied(true); setTimeout(() => setCopied(false), 1600) } }}>{copied ? 'Copied' : 'Copy link'}</Button>
            {!readOnly && <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => setConfirmReset(true)}>Reset link</Button>}
            <Button variant="primary" size="sm" icon={Eye} onClick={() => window.open(url, '_blank', 'noopener')}>Preview as client</Button>
          </div>
          <div className="font-inter flex items-center" style={{ gap: 6, marginTop: 10, fontSize: 11, color: '#8B8F9E' }}><Eye size={12} />Opened {share.view_count} time{share.view_count === 1 ? '' : 's'}{share.last_viewed_at && ` · last ${formatDistanceToNowStrict(new Date(share.last_viewed_at), { addSuffix: true })}`} · Expires automatically when the job closes</div>
        </div>}
      </FormSection>

      {on && share && <>
        <FormSection title="What the client sees" subtitle="Pick the sections the client can open, then choose each recruiting stage you want to share. Earlier or private stages stay hidden.">
          <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
            <span className="font-inter" style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#8B8F9E' }}>SECTIONS</span>
            {([['shortlist', 'Shortlist only'], ['active', 'Active process'], ['everything', 'Everything']] as const).map(([key, label]) => <Button key={key} variant="secondary" size="xs" disabled={readOnly} onClick={() => applyPreset(key)}>{label}</Button>)}
          </div>
          <TooltipProvider>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 6, marginTop: 8 }}>
              {SECTION_DEFS.map((section) => {
                const enabled = sectionOn(section.key)
                const pastel = PASTELS[section.tone]
                const count = section.key === 'recruiting' ? visibleRecruitingCount : sectionCounts[section.key]
                const tile = <button type="button" disabled={readOnly || section.key === 'recruiting'} aria-pressed={enabled} onClick={() => section.field && set({ [section.field]: !enabled })}
                  className="font-inter flex items-center text-left disabled:opacity-100" style={{ minWidth: 0, padding: '10px 12px', gap: 8, borderRadius: 9, background: enabled ? pastel.bg : '#fff', color: enabled ? pastel.fg : '#5A6072', border: `1px ${enabled ? 'solid' : 'dashed'} ${enabled ? pastel.bg : '#E0DDD3'}`, cursor: section.key === 'recruiting' ? 'default' : 'pointer' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="font-poppins truncate" style={{ display: 'block', fontSize: 12.5, fontWeight: enabled ? 600 : 500 }}>{section.label}</span>
                    <span className="truncate" style={{ display: 'block', marginTop: 2, fontSize: 10.5, opacity: 0.85 }}>{section.key === 'recruiting' ? `${count} shared · always on` : enabled ? `${count} shared` : 'Not shared'}</span>
                  </span>
                  {enabled ? <Eye size={13} /> : <EyeOff size={13} style={{ opacity: 0.6 }} />}
                </button>
                return section.key === 'recruiting' ? <Tooltip key={section.key}><TooltipTrigger asChild>{tile}</TooltipTrigger><TooltipContent>Always shared — choose the individual stages below</TooltipContent></Tooltip> : <Fragment key={section.key}>{tile}</Fragment>
              })}
            </div>
          </TooltipProvider>
          <div className="font-inter" style={{ marginTop: 16, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#8B8F9E' }}>RECRUITING STAGES</div>
          <div className="flex flex-wrap items-center" style={{ gap: 6, marginTop: 8 }}>
            {recruiting.map((s, i) => {
              const isVisible = selectedIds.has(s.id)
              return <Fragment key={s.id}>
                {i > 0 && <ChevronRight size={12} color="#D1D0CB" />}
                <button type="button" disabled={readOnly} onClick={() => toggleStage(s)} aria-pressed={isVisible} className="font-inter inline-flex items-center" style={{ height: 34, padding: '0 11px', gap: 7, borderRadius: 8, fontSize: 12, background: isVisible ? '#F4EFFE' : '#fff', color: isVisible ? '#4B1FA8' : '#5A6072', fontWeight: isVisible ? 600 : 500, border: `1px solid ${isVisible ? '#E6DAFB' : '#E7E8EE'}` }}>
                  <span style={{ width: 7, height: 7, borderRadius: 9, background: isVisible ? stageColor(s.type, i) : '#D1D0CB' }} />{s.name}<span style={{ fontSize: 11, opacity: 0.75 }}>{s.count}</span>{isVisible ? <Eye size={12} color="#6F3FF5" /> : <EyeOff size={12} color="#B9B7AC" />}
                </button>
              </Fragment>
            })}
          </div>
          {visible.length > 0 && <div className="font-inter flex items-start" style={{ gap: 8, marginTop: 12, background: '#FAF8FF', border: '1px solid #EDE4FF', borderRadius: 9, padding: '9px 12px', fontSize: 12, color: '#1F2230' }}>
            <Eye size={13} color="#6F3FF5" style={{ marginTop: 2 }} />
            <span>The client sees <strong>{totalVisible} candidate{totalVisible === 1 ? '' : 's'}</strong> across {sharedSections.length === 1 ? 'one section' : `${sharedSections.length} sections`}: {sharedSections.map((s) => s.key === 'recruiting' ? `Recruiting process (${visible.map((v) => v.name).join(', ')})` : s.label).join(', ')}.{sharedSections.length > 1 ? ' They switch between them with tabs, like yours.' : ''}</span>
          </div>}
        </FormSection>

        <FormSection title="On candidate cards">
          <Toggle title="Gio Fit score" description="The client-ready score only — weights and scoring mechanics stay internal." checked={share.show_fit_score} onChange={(v) => set({ show_fit_score: v })} disabled={readOnly} />
          <Toggle title="Time in stage" description="Days since the candidate entered their current recruiting stage." checked={share.show_days} onChange={(v) => set({ show_days: v })} disabled={readOnly} />
          <Toggle title="Client status" description={'Client-ready progress labels, without internal workflow details.'} checked={share.show_client_status} onChange={(v) => set({ show_client_status: v })} disabled={readOnly} />
          <Toggle title="Current employer" description="Turn off when a candidate's search is confidential to their employer." checked={share.show_employer} onChange={(v) => set({ show_employer: v })} disabled={readOnly} />
          <Toggle title="Initials instead of names" description={'Blind review — “L. P.” on cards and in the dossier.'} checked={share.initials_only} onChange={(v) => set({ initials_only: v })} disabled={readOnly} />
          {share.share_rejected && <Toggle title="Rejection reasons" description={'A short, client-safe reason on Rejected rows — “Skills gap”, “Withdrew”. Internal notes are never included.'} checked={share.show_reject_reason} onChange={(v) => set({ show_reject_reason: v })} disabled={readOnly} />}
        </FormSection>

        <FormSection title="Candidate dossier" subtitle="Cards and rows open each candidate's client-ready dossier — the same page as their individual dossier link.">
          <Toggle title="Let the client respond" description={`Request interview and Not a fit on dossiers awaiting review. Decisions reach ${recruiterName || 'the recruiter'} and show on both the board and the dossier link.`} checked={share.client_can_respond} onChange={(v) => set({ client_can_respond: v })} disabled={readOnly} />
          <Toggle title="Interview scorecards" description="Interviewers' written takeaways and verdicts, as in the dossier's client-ready view." checked={share.show_scorecards} onChange={(v) => set({ show_scorecards: v })} disabled={readOnly} />
          <div className="font-inter flex items-start" style={{ gap: 8, marginTop: 10, background: '#FAFAF7', border: '1px solid #EFEEE8', borderRadius: 9, padding: '9px 12px', fontSize: 11.5, color: '#5A6072' }}><Link2 size={13} style={{ marginTop: 1 }} /><span>Sharing a single candidate still works on its own, from <strong>Gio Fit › Share with client</strong>. Both links open the same dossier.</span></div>
        </FormSection>

        <FormSection title="Not part of the client view" subtitle="Internal-only, whatever the settings above."><div className="flex flex-wrap" style={{ gap: 6 }}>{EXCLUDED.map((l) => <span key={l} className="font-inter inline-flex items-center" style={{ height: 26, padding: '0 10px', borderRadius: 7, background: '#FAFAF7', border: '1px solid #EFEEE8', fontSize: 11.5, color: '#5A6072' }}>{l}</span>)}</div></FormSection>
      </>}

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reset the link?</AlertDialogTitle><AlertDialogDescription>Anyone using the current link will lose access.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void resetToken()}>Reset link</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </section>
  )
}
