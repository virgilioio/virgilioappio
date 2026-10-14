import { useMemo } from 'react'
import type { IndependentCandidate } from './useIndependentCandidates'
import { BooleanSyntaxError, compileBoolean, type SearchText } from '@/lib/candidateSearch'

/**
 * Boolean search over the same text as Everything (2026-10-14): AND, OR, NOT,
 * parentheses and "quoted phrases" on whole words; `engineer*` for words that
 * start with "engineer". A mistake leaves the list as it was and returns a
 * plain-words message saying what to fix.
 */
export function useCandidateBooleanFilter(
  candidates: IndependentCandidate[],
  expr: string,
  enabled: boolean,
  searchTexts?: Map<string, SearchText>,
) {
  return useMemo(() => {
    if (!enabled || !expr.trim()) return { matches: candidates, error: null as string | null }
    try {
      const test = compileBoolean(expr)
      if (!test) return { matches: candidates, error: null }
      const matches = candidates.filter((c) => {
        const text = searchTexts?.get(c.id)
        return !!text && test(text)
      })
      return { matches, error: null }
    } catch (e) {
      const message = e instanceof BooleanSyntaxError ? e.message : 'That search couldn’t be read. Check the operators and brackets.'
      return { matches: candidates, error: `${message} Nothing was filtered yet.` }
    }
  }, [candidates, expr, enabled, searchTexts])
}
