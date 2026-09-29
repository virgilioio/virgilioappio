import { Eye } from 'lucide-react'
import { pipelinePublicUrl, useJobPipelineShare } from '@/hooks/useJobPipelineShare'
import { useJobStageCounts } from './ClientViewSection'
import { NON_RECRUITING_STAGE_TYPES } from '@/hooks/useJobPipelineShare'

/** "Client view is live" strip above the recruiting board. Absent when off. */
export function ClientViewStrip({ jobId }: { jobId: string }) {
  const { share } = useJobPipelineShare(jobId)
  const stages = useJobStageCounts(jobId)
  if (!share?.is_public) return null
  const recruiting = stages.filter((s) => !NON_RECRUITING_STAGE_TYPES.has(s.type))
  const start = Math.max(0, recruiting.findIndex((s) => s.id === share.from_stage_id))
  const from = recruiting[start]
  const n = recruiting.slice(start).reduce((t, s) => t + s.count, 0)
  return (
    <div className="font-inter flex items-center flex-wrap" style={{ padding: '10px 28px 0', fontSize: 11.5, color: '#5A6072', gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: 9, background: '#12B886' }} />
      <span>
        Client view is live from <strong>{from?.name ?? '—'}</strong> · {n} candidate{n === 1 ? '' : 's'} visible · stages marked
      </span>
      <Eye size={12} color="#6F3FF5" />
      <span>are shared</span>
      <button type="button" onClick={() => window.open(pipelinePublicUrl(share.token), '_blank', 'noopener')}
        style={{ color: '#6F3FF5', fontWeight: 600, marginLeft: 4 }}>
        Preview
      </button>
    </div>
  )
}
