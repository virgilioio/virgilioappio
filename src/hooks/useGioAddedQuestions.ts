import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface GioAddedQuestion {
  id: string
  source_point_index: number
  question: string
  answer: string
}

function uuid() {
  return (globalThis.crypto?.randomUUID?.() ??
    `gio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`) as string
}

function normalize(raw: unknown): GioAddedQuestion[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map(r => ({
      id: (r.id as string) || uuid(),
      source_point_index: typeof r.source_point_index === 'number' ? r.source_point_index : -1,
      question: typeof r.question === 'string' ? r.question : '',
      answer: typeof r.answer === 'string' ? r.answer : '',
    }))
    .filter(q => q.question.trim().length > 0)
}

/** Local-only state mirror for the Gio "Added from scorecard" questions on a single scorecard. */
export function useGioAddedQuestions(initial?: unknown) {
  const [items, setItems] = useState<GioAddedQuestion[]>(() => normalize(initial))

  // Re-hydrate when the existing scorecard data loads later.
  useEffect(() => {
    if (initial !== undefined) setItems(normalize(initial))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initial ?? null)])

  const add = useCallback((q: Omit<GioAddedQuestion, 'id' | 'answer'> & { answer?: string }) => {
    setItems(prev => {
      if (prev.some(p => p.source_point_index === q.source_point_index)) return prev
      return [...prev, { id: uuid(), answer: '', ...q }]
    })
  }, [])

  const remove = useCallback((sourcePointIndex: number) => {
    setItems(prev => prev.filter(p => p.source_point_index !== sourcePointIndex))
  }, [])

  const setAnswer = useCallback((id: string, answer: string) => {
    setItems(prev => prev.map(p => (p.id === id ? { ...p, answer } : p)))
  }, [])

  const persist = useCallback(async (scorecardId: string) => {
    const { error } = await (supabase as any)
      .from('job_stage_scorecards')
      .update({ gio_added_questions: items })
      .eq('id', scorecardId)
    if (error) throw error
  }, [items])

  return { items, add, remove, setAnswer, persist }
}
