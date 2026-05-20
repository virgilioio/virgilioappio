import { useMemo } from 'react'
import type { IndependentCandidate } from './useIndependentCandidates'

/**
 * Tiny boolean search parser.
 * Supports: AND, OR, NOT, parentheses, "quoted phrases".
 * Falls back to plain substring search on parse error.
 *
 * Returns { matches, error } so callers can show an inline error chip.
 */

type Token =
  | { type: 'op'; value: 'AND' | 'OR' | 'NOT' }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'term'; value: string }

function tokenize(input: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue }
    if (ch === '(') { out.push({ type: 'paren', value: '(' }); i++; continue }
    if (ch === ')') { out.push({ type: 'paren', value: ')' }); i++; continue }
    if (ch === '"') {
      let j = i + 1
      while (j < input.length && input[j] !== '"') j++
      out.push({ type: 'term', value: input.slice(i + 1, j) })
      i = j + 1
      continue
    }
    let j = i
    while (j < input.length && !/[\s()"]/.test(input[j])) j++
    const word = input.slice(i, j)
    const upper = word.toUpperCase()
    if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
      out.push({ type: 'op', value: upper })
    } else {
      out.push({ type: 'term', value: word })
    }
    i = j
  }
  return out
}

type Node =
  | { kind: 'term'; value: string }
  | { kind: 'not'; child: Node }
  | { kind: 'and'; left: Node; right: Node }
  | { kind: 'or'; left: Node; right: Node }

class Parser {
  pos = 0
  constructor(public tokens: Token[]) {}
  peek() { return this.tokens[this.pos] }
  eat() { return this.tokens[this.pos++] }
  parseExpr(): Node { return this.parseOr() }
  parseOr(): Node {
    let left = this.parseAnd()
    while (this.peek()?.type === 'op' && (this.peek() as any).value === 'OR') {
      this.eat()
      left = { kind: 'or', left, right: this.parseAnd() }
    }
    return left
  }
  parseAnd(): Node {
    let left = this.parseUnary()
    while (this.peek() && !(this.peek()?.type === 'op' && (this.peek() as any).value === 'OR') && !(this.peek()?.type === 'paren' && (this.peek() as any).value === ')')) {
      // implicit AND
      const next = this.peek()
      if (next.type === 'op' && next.value === 'AND') this.eat()
      const right = this.parseUnary()
      left = { kind: 'and', left, right }
    }
    return left
  }
  parseUnary(): Node {
    const t = this.peek()
    if (t?.type === 'op' && t.value === 'NOT') {
      this.eat()
      return { kind: 'not', child: this.parseUnary() }
    }
    return this.parseAtom()
  }
  parseAtom(): Node {
    const t = this.eat()
    if (!t) throw new Error('Unexpected end of expression')
    if (t.type === 'paren' && t.value === '(') {
      const inner = this.parseExpr()
      const close = this.eat()
      if (!close || close.type !== 'paren' || close.value !== ')') throw new Error('Missing closing parenthesis')
      return inner
    }
    if (t.type === 'term') return { kind: 'term', value: t.value }
    throw new Error(`Unexpected token: ${(t as any).value}`)
  }
}

function evaluate(node: Node, haystack: string): boolean {
  switch (node.kind) {
    case 'term': return haystack.includes(node.value.toLowerCase())
    case 'not': return !evaluate(node.child, haystack)
    case 'and': return evaluate(node.left, haystack) && evaluate(node.right, haystack)
    case 'or': return evaluate(node.left, haystack) || evaluate(node.right, haystack)
  }
}

function buildHaystack(c: IndependentCandidate): string {
  const skills = c.standardized_skills?.length ? c.standardized_skills : c.skills
  return [
    c.candidate_name,
    c.email ?? '',
    c.company_current ?? '',
    c.current_job_title ?? '',
    (skills ?? []).join(' '),
    c.location_city ?? '',
    c.location_country ?? '',
  ].join(' ').toLowerCase()
}

export function useCandidateBooleanFilter(candidates: IndependentCandidate[], expr: string, enabled: boolean) {
  return useMemo(() => {
    if (!enabled || !expr.trim()) return { matches: candidates, error: null as string | null }
    try {
      const tokens = tokenize(expr)
      if (tokens.length === 0) return { matches: candidates, error: null }
      const parser = new Parser(tokens)
      const ast = parser.parseExpr()
      const matches = candidates.filter(c => evaluate(ast, buildHaystack(c)))
      return { matches, error: null }
    } catch (e: any) {
      // Fallback to plain text
      const term = expr.toLowerCase()
      return {
        matches: candidates.filter(c => buildHaystack(c).includes(term)),
        error: e?.message ?? 'Could not parse boolean expression',
      }
    }
  }, [candidates, expr, enabled])
}
