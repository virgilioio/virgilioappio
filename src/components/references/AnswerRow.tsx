import { EyeOff } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Answer } from '@/components/references/Answer'
import {
  candidateSelfScore,
  resolveAnswers,
  type ResolvedAnswer,
} from '@/lib/references/answers'
import type { RefQuestion } from '@/lib/references/templateModel'

/** Short answers sit inline with their label; prose and multi-part answers stack. */
const INLINE_TYPES = [
  'rating_1_5',
  'recommendation_score',
  'would_rehire',
  'yes_no',
  'single_select',
  'date',
  'date_range',
  'number',
  'short_text',
]

export function AnswerRow({
  q,
  a,
  candidateSelf = null,
  last = false,
}: {
  q: RefQuestion
  a: ResolvedAnswer | null
  candidateSelf?: number | null
  last?: boolean
}) {
  const inline = INLINE_TYPES.includes(q.type)

  const label = (
    <div className="flex items-center" style={{ gap: 6, ...(inline ? { flex: '1 1 0', minWidth: 0 } : { marginBottom: 5 }) }}>
      <span
        className="font-inter"
        style={{ fontSize: 11, color: '#8B8F9E', lineHeight: 1.4 }}
      >
        {q.label}
      </span>
      {q.internal && (
        <Badge tone="neutral" size="xs" icon={EyeOff}>
          Internal
        </Badge>
      )}
    </div>
  )

  return (
    <div
      style={{
        padding: '10px 0',
        borderBottom: last ? undefined : '1px solid #EDE4FF',
        ...(inline
          ? { display: 'flex', alignItems: 'center', gap: 14 }
          : { display: 'block' }),
      }}
    >
      {label}
      <div style={inline ? { flexShrink: 0 } : undefined}>
        <Answer q={q} a={a} candidateSelf={candidateSelf} />
      </div>
    </div>
  )
}

/** Section headers are a divider label, not an answer row. */
function SectionHeaderRow({ label }: { label: string }) {
  return (
    <p
      className="font-poppins uppercase"
      style={{
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: '#8B8F9E',
        padding: '16px 0 4px',
      }}
    >
      {label}
    </p>
  )
}

/**
 * All of a referee's answers, in the frozen template's question order. Keyed
 * from that referee's own record, so a peer never shows the manager's words.
 */
export function AnswerList({
  questions,
  answers,
  candidateSelf,
}: {
  questions: RefQuestion[]
  answers?: Record<string, unknown> | null
  candidateSelf?: Record<string, unknown> | null
}) {
  const rows = resolveAnswers(questions, answers)
  if (rows.length === 0) return null

  const lastIndex = rows.length - 1

  return (
    <div>
      {rows.map(({ question, answer }, i) =>
        question.type === 'section_header' ? (
          <SectionHeaderRow key={question.id} label={question.label} />
        ) : (
          <AnswerRow
            key={question.id}
            q={question}
            a={answer}
            candidateSelf={
              question.ask_candidate_too
                ? candidateSelfScore(candidateSelf, question.id)
                : null
            }
            last={i === lastIndex}
          />
        ),
      )}
    </div>
  )
}

export default AnswerRow
