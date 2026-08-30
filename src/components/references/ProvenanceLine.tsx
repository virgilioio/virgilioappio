import type { CSSProperties, ReactNode } from 'react'
import { Briefcase, Building2 } from 'lucide-react'

/**
 * Why a check is (or is not) still relevant: the job, client, stage, recruiter
 * and the date it was collected. Shown on every surface where a check appears
 * out of its original context.
 */
export function ProvenanceLine({
  job,
  client,
  stage,
  recruiter,
  collectedAt,
  style,
}: {
  job?: string | null
  client?: string | null
  stage?: string | null
  recruiter?: string | null
  collectedAt?: string | null
  style?: CSSProperties
}) {
  const items: ReactNode[] = []

  if (job) {
    items.push(
      <span key="job" className="inline-flex items-center" style={{ gap: 5 }}>
        <Briefcase size={11} color="#8B8F9E" />
        {job}
      </span>,
    )
  }
  if (client) {
    items.push(
      <span key="client" className="inline-flex items-center" style={{ gap: 5 }}>
        <Building2 size={11} color="#8B8F9E" />
        {client}
      </span>,
    )
  }
  if (stage) items.push(<span key="stage">{stage}</span>)
  if (recruiter) items.push(<span key="recruiter">{recruiter}</span>)
  if (collectedAt) {
    items.push(
      <span key="date" style={{ color: '#8B8F9E' }}>
        Collected{' '}
        {new Date(collectedAt).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </span>,
    )
  }

  if (items.length === 0) return null

  return (
    <div
      className="flex items-center font-inter"
      style={{ gap: 10, flexWrap: 'wrap', fontSize: 11, color: '#5A6072', ...style }}
    >
      {items.map((node, i) => (
        <span key={i} className="inline-flex items-center" style={{ gap: 10 }}>
          {i > 0 && (
            <span
              aria-hidden
              style={{ width: 3, height: 3, borderRadius: 999, background: '#D1D0CB' }}
            />
          )}
          {node}
        </span>
      ))}
    </div>
  )
}

export default ProvenanceLine
