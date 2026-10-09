import { useEffect, useState } from 'react'
import { IconSwap } from '@/components/ui/icon-swap'
import { Check, Kanban } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { copyToClipboardSilent } from '@/utils/clipboard'
import { NON_RECRUITING_STAGE_TYPES, pipelinePublicUrl, useJobPipelineShare } from '@/hooks/useJobPipelineShare'

/** "Also in the client pipeline" — shown when this candidate's stage is on the shared board. */
export function PipelineAlsoRow({ jobId, candidateId, firstName }: { jobId: string; candidateId: string; firstName: string }) {
  const { share } = useJobPipelineShare(jobId)
  const [shared, setShared] = useState(false)
  const [client, setClient] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!share?.is_public) { setShared(false); return }
    let active = true
    ;(async () => {
      const [{ data: assoc }, { data: stages }, { data: job }] = await Promise.all([
        supabase.from('job_candidate_associations').select('current_stage_id, status').eq('job_id', jobId).eq('candidate_id', candidateId).maybeSingle(),
        supabase.from('job_hiring_stages').select('id, position, job_stages(stage_type)').eq('job_id', jobId).order('position'),
        supabase.from('jobs').select('organization_id, organizations(name)').eq('id', jobId).maybeSingle(),
      ])
      const recruiting = (stages ?? []).filter((s: any) => !NON_RECRUITING_STAGE_TYPES.has(String(s.job_stages?.stage_type ?? '')))
      const start = Math.max(0, recruiting.findIndex((s: any) => s.id === share.from_stage_id))
      const idx = recruiting.findIndex((s: any) => s.id === assoc?.current_stage_id)
      if (!active) return
      setShared(idx >= start && idx >= 0 && !['rejected', 'withdrawn', 'hired'].includes(String(assoc?.status ?? '')))
      setClient((job as any)?.organizations?.name ?? null)
    })()
    return () => { active = false }
  }, [share, jobId, candidateId])

  if (!share?.is_public || !shared) return null
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyToClipboardSilent(pipelinePublicUrl(share.token))) { setCopied(true); setTimeout(() => setCopied(false), 1600) }
      }}
      className="w-full flex items-center text-left rounded-lg hover:bg-[#F1F0EC]"
      style={{ gap: 10, padding: '8px 10px', marginTop: 4 }}
    >
      <span className="inline-flex items-center justify-center shrink-0" style={{ width: 26, height: 26, borderRadius: 7, background: '#F1F0EC', color: '#5A6072' }}>
        <IconSwap swapped={copied} from={<Kanban size={13} />} to={<Check size={13} />} />
      </span>
      <span className="min-w-0 font-inter">
        <span className="block" style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}>{copied ? 'Copied to clipboard' : 'Also in the client pipeline'}</span>
        <span className="block" style={{ fontSize: 11, color: '#8B8F9E' }}>{client ?? 'The client'} sees {firstName} on the shared board · copy the pipeline link</span>
      </span>
    </button>
  )
}
