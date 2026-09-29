import { Eye } from 'lucide-react'
import { pipelinePublicUrl, useJobPipelineShare } from '@/hooks/useJobPipelineShare'
import { useJobClientSectionCounts, useJobStageCounts } from './ClientViewSection'
import { NON_RECRUITING_STAGE_TYPES } from '@/hooks/useJobPipelineShare'

export function ClientViewStrip({ jobId }: { jobId: string }) {
  const { share } = useJobPipelineShare(jobId)
  const stages = useJobStageCounts(jobId)
  const counts = useJobClientSectionCounts(jobId, stages)
  if (!share?.is_public) return null
  const recruiting = stages.filter((s) => !NON_RECRUITING_STAGE_TYPES.has(s.type))
  const selected = new Set(share.visible_stage_ids?.length ? share.visible_stage_ids : recruiting.map((s) => s.id))
  const visible = recruiting.filter((s) => selected.has(s.id))
  const extras = [share.share_application && 'Application review', share.share_offers && 'Job offers', share.share_hired && 'Hired', share.share_rejected && 'Rejected'].filter(Boolean) as string[]
  const total = visible.reduce((n, s) => n + s.count, 0) + (share.share_application ? counts.application : 0) + (share.share_offers ? counts.offers : 0) + (share.share_hired ? counts.hired : 0) + (share.share_rejected ? counts.rejected : 0)
  return <div className="font-inter flex items-center flex-wrap" style={{ padding: '10px 28px 0', fontSize: 11.5, color: '#5A6072', gap: 6 }}>
    <span style={{ width: 6, height: 6, borderRadius: 9, background: '#12B886' }} />
    <span>Client view is live for <strong>{visible.map((s) => s.name).join(', ') || 'Recruiting process'}</strong>{extras.length ? ` + ${extras.join(', ')}` : ''} · {total} candidate{total === 1 ? '' : 's'} visible · marked</span>
    <Eye size={12} color="#6F3FF5" /><span>are shared</span>
    <button type="button" onClick={() => window.open(pipelinePublicUrl(share.token), '_blank', 'noopener')} style={{ color: '#6F3FF5', fontWeight: 600, marginLeft: 4 }}>Preview</button>
  </div>
}
