import { describe, expect, it } from 'vitest'
import { fitMoves, fitMoveText } from '../fitQueueStatus'
import { CAUSE_LABEL, asCause, pointLabel } from '@/hooks/useFitScoreHistory'

const row = (id: string, score: number | null, previous: number | null, cause: string | null) =>
  ({ association_id: id, score, previous_score: previous, cause, moved_at: '2026-11-17T15:00:00Z' })

describe('fitMoves', () => {
  it('keeps real moves with a known cause', () => {
    const moves = fitMoves([row('a', 78, 70, 'scorecard'), row('b', 61, 70, 'job'), row('c', 70, 70, 'scorecard'), row('d', 50, 40, 'recipe'), row('e', null, 40, 'job'), row('f', 50, 40, null)])
    expect([...moves.keys()]).toEqual(['a', 'b'])
    expect(moves.get('a')).toMatchObject({ delta: 8, cause: 'scorecard' })
    expect(moves.get('b')).toMatchObject({ delta: -9, cause: 'job' })
    expect(fitMoves(null).size).toBe(0)
  })
  it('says which way, how far, why and when', () => {
    const moves = fitMoves([row('a', 78, 70, 'scorecard'), row('b', 61, 70, 'application')])
    expect(fitMoveText(moves.get('a')!)).toBe('up 8 after a scorecard on Nov 17')
    expect(fitMoveText(moves.get('b')!)).toBe('down 9 after their application answers on Nov 17')
  })
})

describe('history labels', () => {
  it('names the cause when the assessment recorded one, else how it started', () => {
    expect(pointLabel({ cause: 'scorecard', trigger: 'queue' })).toBe(CAUSE_LABEL.scorecard)
    expect(pointLabel({ cause: 'recipe', trigger: 'scorecard' })).toBe('Scoring update')
    expect(pointLabel({ cause: null, trigger: 'refresh' })).toBe('Refreshed by a recruiter')
    expect(asCause('application')).toBe('application')
    expect(asCause('nonsense')).toBeNull()
    expect(asCause(undefined)).toBeNull()
  })
})
