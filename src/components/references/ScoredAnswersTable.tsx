import { Scale } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { candidateSelfScore } from '@/lib/references/answers'
import type { RefQuestion } from '@/lib/references/templateModel'
import type { RefereeRowData } from '@/components/references/RefereeRow'

/** Only these question types have a comparable score. */
const SCORED = ['rating_1_5', 'recommendation_score', 'would_rehire'] as const

/** The self-assessment gap threshold — the SAME number the flag fires on. */
export const SELF_GAP_THRESHOLD = 2

const CELL_BORDER = '1px solid #F6F5F1'

function numeric(raw: unknown): number | null {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN
  return Number.isFinite(n) ? n : null
}

function scaleOf(type: string): 1 | 5 | 10 {
  if (type === 'recommendation_score') return 10
  if (type === 'rating_1_5') return 5
  return 1
}

function toneFor(type: string, value: number): string {
  const threshold = type === 'recommendation_score' ? 8 : 4
  return value < threshold ? '#B45309' : '#0B7A57'
}

function rehireTone(answer: string): 'green' | 'yellow' | 'red' {
  const v = answer.toLowerCase()
  if (v.startsWith('no')) return 'red'
  if (v.includes('reservation')) return 'yellow'
  return 'green'
}

const Dash = () => (
  <span className="font-inter" style={{ fontSize: 13, color: '#8B8F9E' }}>
    —
  </span>
)

/**
 * "Scored answers, side by side" — the evidence behind the self-assessment-gap
 * flag. Held referees keep their column (a column of em dashes): their absence
 * is information, not something to hide.
 */
export function ScoredAnswersTable({
  questions,
  referees,
  candidateSelf,
}: {
  questions: RefQuestion[]
  referees: RefereeRowData[]
  candidateSelf?: Record<string, unknown> | null
}) {
  const scored = (questions ?? []).filter((q) => (SCORED as readonly string[]).includes(q.type))
  if (scored.length === 0 || referees.length === 0) return null

  const grid = `minmax(0,1.5fr) 96px repeat(${referees.length}, minmax(0,1fr))`

  const valueFor = (r: RefereeRowData, q: RefQuestion): unknown => {
    const answers = (r.answers ?? {}) as Record<string, unknown>
    const raw = answers[q.id]
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in (raw as any)) {
      return (raw as any).value
    }
    return raw
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E7E8EE',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '13px 16px', borderBottom: '1px solid #F1F0EC' }}>
        <p
          className="font-poppins"
          style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em', color: '#1F2230' }}
        >
          Scored answers, side by side
        </p>
        <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E', marginTop: 3 }}>
          The Self column is the candidate's own rating, where the template asked them too.
        </p>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 460 }}>
          {/* Header */}
          <div className="grid" style={{ gridTemplateColumns: grid }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #F1F0EC' }} />
            <div
              style={{
                padding: '10px 12px',
                background: '#FAF8FF',
                borderLeft: CELL_BORDER,
                borderBottom: '1px solid #F1F0EC',
              }}
            >
              <p
                className="font-poppins"
                style={{ fontSize: 11.5, fontWeight: 600, color: '#5B21B6' }}
              >
                Self
              </p>
              <p className="font-inter" style={{ fontSize: 10.5, color: '#8B8F9E' }}>
                Candidate
              </p>
            </div>
            {referees.map((r) => {
              const held = r.on_hold === true || r.status === 'on_hold'
              return (
                <div
                  key={r.id}
                  style={{
                    padding: '10px 12px',
                    borderLeft: CELL_BORDER,
                    borderBottom: '1px solid #F1F0EC',
                  }}
                >
                  <p
                    className="font-poppins truncate"
                    style={{ fontSize: 11.5, fontWeight: 600, color: held ? '#8B8F9E' : '#1F2230' }}
                  >
                    {r.name}
                  </p>
                  <p className="font-inter truncate" style={{ fontSize: 10.5, color: '#8B8F9E' }}>
                    {held ? 'On hold' : (r.relationship ?? '—')}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Body */}
          {scored.map((q, rowIndex) => {
            const last = rowIndex === scored.length - 1
            const self = q.ask_candidate_too ? candidateSelfScore(candidateSelf, q.id) : null

            const refereeNumbers = referees
              .map((r) => numeric(valueFor(r, q)))
              .filter((n): n is number => n !== null)
            const mean =
              refereeNumbers.length > 0
                ? refereeNumbers.reduce((a, b) => a + b, 0) / refereeNumbers.length
                : null
            const gap = self !== null && mean !== null ? Math.abs(self - mean) : null
            const gapFires = gap !== null && gap >= SELF_GAP_THRESHOLD

            return (
              <div key={q.id} className="grid" style={{ gridTemplateColumns: grid }}>
                <div
                  className="flex items-center"
                  style={{
                    gap: 7,
                    padding: '12px 16px',
                    borderBottom: last ? undefined : CELL_BORDER,
                  }}
                >
                  <span className="font-inter" style={{ fontSize: 12, color: '#5A6072' }}>
                    {q.label}
                  </span>
                  {q.ask_candidate_too && (
                    <Scale size={11} color={gapFires ? '#B45309' : '#8B8F9E'} />
                  )}
                </div>

                <div
                  className="flex items-center"
                  style={{
                    gap: 6,
                    padding: 12,
                    borderLeft: CELL_BORDER,
                    borderBottom: last ? undefined : CELL_BORDER,
                    background: self !== null ? '#FAF8FF' : undefined,
                  }}
                >
                  {self === null ? (
                    <Dash />
                  ) : (
                    <>
                      <span
                        className="font-poppins tabular-nums"
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          letterSpacing: '-0.02em',
                          color: gapFires ? '#B45309' : '#5B21B6',
                        }}
                      >
                        {self}
                      </span>
                      {gapFires && mean !== null && (
                        <span
                          className="font-inter tabular-nums"
                          style={{ fontSize: 10.5, color: '#B45309' }}
                        >
                          vs {Number.isInteger(mean) ? mean : mean.toFixed(1)}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {referees.map((r) => {
                  const raw = valueFor(r, q)
                  const scale = scaleOf(q.type)
                  return (
                    <div
                      key={r.id}
                      className="flex items-center"
                      style={{
                        padding: 12,
                        borderLeft: CELL_BORDER,
                        borderBottom: last ? undefined : CELL_BORDER,
                      }}
                    >
                      {raw === undefined || raw === null || raw === '' ? (
                        <Dash />
                      ) : q.type === 'would_rehire' ? (
                        <Badge tone={rehireTone(String(raw))} size="xs">
                          {String(raw)}
                        </Badge>
                      ) : (
                        (() => {
                          const n = numeric(raw)
                          if (n === null) {
                            return (
                              <span
                                className="font-inter"
                                style={{ fontSize: 12, color: '#5A6072' }}
                              >
                                {String(raw)}
                              </span>
                            )
                          }
                          return (
                            <span
                              className="font-poppins tabular-nums"
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                letterSpacing: '-0.02em',
                                color: toneFor(q.type, n),
                              }}
                            >
                              {n}
                              <span style={{ fontSize: 10.5, color: '#8B8F9E', fontWeight: 500 }}>
                                /{scale}
                              </span>
                            </span>
                          )
                        })()
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ScoredAnswersTable
