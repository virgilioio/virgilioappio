/**
 * Candidate text search (2026-10-14). One searchable text per candidate, shared
 * by the "Everything" and "Boolean" modes so they look at the same fields:
 * name, emails, phones, LinkedIn, title, company, seniority, function,
 * specialization, location, skills, summary and tags. Matching ignores case
 * and accents ("jose" finds "José").
 *
 * Everything: every word has to appear somewhere (in any field), so
 * "SDR Mexico" finds an SDR in Mexico. Plurals are forgiven ("account
 * executives" finds "Account Executive"); "quoted phrases" stay together; a
 * number with 5+ digits is matched against phone numbers digit by digit.
 *
 * Boolean: AND, OR, NOT, parentheses and "quoted phrases", on whole words.
 * `java` doesn't match "JavaScript"; `engineer*` matches engineer, engineering…
 * Plurals are forgiven here too (`engineer` matches "engineers").
 */

export interface SearchableCandidate {
  id: string
  candidate_name?: string | null
  email?: string | null
  phone?: string | null
  contact_emails?: unknown
  contact_phones?: unknown
  linkedin_url?: string | null
  current_job_title?: string | null
  standardized_title?: string | null
  company_current?: string | null
  seniority_level?: string | null
  functional_area?: string | null
  specialization?: string | null
  location_city?: string | null
  location_state?: string | null
  location_country?: string | null
  skills?: string[] | null
  standardized_skills?: string[] | null
  profile_summary?: string | null
}

export interface SearchText {
  /** Lowercased, accent-free text of every searchable field, " | " between fields. */
  text: string
  /** Every phone number's digits, space-separated. */
  digits: string
}

/** Lowercase and strip accents: "José Peña" → "jose pena". */
export function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function listValues(raw: unknown, key: 'email' | 'number'): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => (typeof item === 'string' ? item : item && typeof item === 'object' ? (item as Record<string, unknown>)[key] : null))
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
}

export function buildSearchText(c: SearchableCandidate, tagNames: string[] = []): SearchText {
  const phones = [c.phone ?? '', ...listValues(c.contact_phones, 'number')]
  const parts: (string | null | undefined)[] = [
    c.candidate_name,
    c.email,
    ...listValues(c.contact_emails, 'email'),
    ...phones,
    c.linkedin_url,
    c.current_job_title,
    c.standardized_title,
    c.company_current,
    c.seniority_level,
    c.functional_area,
    c.specialization,
    c.location_city,
    c.location_state,
    c.location_country,
    ...(c.skills ?? []),
    ...(c.standardized_skills ?? []),
    c.profile_summary,
    ...tagNames,
  ]
  return {
    text: fold(parts.filter((p): p is string => !!p && p.trim().length > 0).join(' | ')),
    digits: phones.map((p) => p.replace(/\D/g, '')).filter((d) => d.length >= 5).join(' '),
  }
}

/* ── Everything ─────────────────────────────────────────────────────────── */

/** Words and "quoted phrases" of a query, folded. */
export function queryWords(query: string): string[] {
  const out: string[] = []
  const re = /"([^"]*)"?|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(query))) {
    const word = fold((m[1] ?? m[2] ?? '').trim())
    if (word) out.push(word)
  }
  return out
}

/** "executives" also tries "executive"; "searches" also "search". */
function singulars(word: string): string[] {
  const forms = [word]
  if (word.length > 4 && word.endsWith('es')) forms.push(word.slice(0, -2))
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) forms.push(word.slice(0, -1))
  return forms
}

export function matchesEverything(s: SearchText, words: string[]): boolean {
  return words.every((word) => {
    const digits = word.replace(/[\s()+.-]/g, '')
    if (/^\d{5,}$/.test(digits)) return s.digits.includes(digits)
    return singulars(word).some((form) => s.text.includes(form))
  })
}

/* ── Boolean ────────────────────────────────────────────────────────────── */

type Token =
  | { type: 'op'; value: 'AND' | 'OR' | 'NOT' }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'term'; value: string; phrase: boolean }

export class BooleanSyntaxError extends Error {}

function tokenize(input: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (/\s/.test(ch)) { i++; continue }
    if (ch === '(' || ch === ')') { out.push({ type: 'paren', value: ch }); i++; continue }
    if (ch === '"') {
      const close = input.indexOf('"', i + 1)
      if (close === -1) throw new BooleanSyntaxError('A quote isn’t closed. Add the second ".')
      const phrase = input.slice(i + 1, close).trim()
      if (phrase) out.push({ type: 'term', value: phrase, phrase: true })
      i = close + 1
      continue
    }
    let j = i
    while (j < input.length && !/[\s()"]/.test(input[j])) j++
    const word = input.slice(i, j)
    const upper = word.toUpperCase()
    if (upper === 'AND' || upper === 'OR' || upper === 'NOT') out.push({ type: 'op', value: upper })
    else out.push({ type: 'term', value: word, phrase: false })
    i = j
  }
  return out
}

type Node =
  | { kind: 'term'; test: (text: string) => boolean }
  | { kind: 'not'; child: Node }
  | { kind: 'and'; left: Node; right: Node }
  | { kind: 'or'; left: Node; right: Node }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A whole-word test for one term: `java`, `engineer*`, `"design systems"`. */
function termTest(raw: string, phrase: boolean): (text: string) => boolean {
  // Stray punctuation around a word ("react," or "(sales") isn't part of it.
  let word = fold(raw).replace(/^[^\p{L}\p{N}#+.]+|[^\p{L}\p{N}#+*]+$/gu, '')
  if (!word) return () => true
  const prefix = !phrase && word.endsWith('*') && word.length > 1
  if (prefix) word = word.replace(/\*+$/, '')
  // A plural in the search finds the singular too ("executives" → executive).
  const body = phrase
    ? word.split(/\s+/).map(escapeRe).join('\\s+')
    : prefix
      ? escapeRe(word)
      : `(?:${singulars(word).map(escapeRe).join('|')})`
  // Whole word: nothing alphanumeric right before; after it either the end of
  // the word, or (for prefixes) anything. Plural endings are allowed.
  const re = new RegExp(`(^|[^a-z0-9])${body}${prefix ? '' : '(s|es)?(?![a-z0-9])'}`)
  return (text) => re.test(text)
}

class Parser {
  pos = 0
  constructor(private tokens: Token[]) {}
  private peek() { return this.tokens[this.pos] }
  private eat() { return this.tokens[this.pos++] }
  parse(): Node {
    const node = this.parseOr()
    const extra = this.peek()
    if (extra) {
      if (extra.type === 'paren') throw new BooleanSyntaxError('There’s a “)” without a matching “(”.')
      throw new BooleanSyntaxError(`${extra.value} needs a word on each side.`)
    }
    return node
  }
  private parseOr(): Node {
    let left = this.parseAnd()
    while (this.peek()?.type === 'op' && this.peek()!.value === 'OR') {
      this.eat()
      left = { kind: 'or', left, right: this.parseAnd() }
    }
    return left
  }
  private parseAnd(): Node {
    let left = this.parseUnary()
    for (;;) {
      const next = this.peek()
      if (!next) break
      if (next.type === 'op' && next.value === 'OR') break
      if (next.type === 'paren' && next.value === ')') break
      if (next.type === 'op' && next.value === 'AND') this.eat()
      left = { kind: 'and', left, right: this.parseUnary() }
    }
    return left
  }
  private parseUnary(): Node {
    const t = this.peek()
    if (t?.type === 'op' && t.value === 'NOT') {
      this.eat()
      return { kind: 'not', child: this.parseUnary() }
    }
    return this.parseAtom()
  }
  private parseAtom(): Node {
    const t = this.eat()
    if (!t) throw new BooleanSyntaxError('The search ends with AND, OR or NOT. Add a word after it.')
    if (t.type === 'paren' && t.value === '(') {
      const inner = this.parseOr()
      const close = this.eat()
      if (!close || close.type !== 'paren' || close.value !== ')') throw new BooleanSyntaxError('One “(” isn’t closed. Add a “)”.')
      return inner
    }
    if (t.type === 'paren') throw new BooleanSyntaxError('There’s a “)” without a matching “(”.')
    if (t.type === 'op') throw new BooleanSyntaxError(`${t.value} needs a word on each side.`)
    return { kind: 'term', test: termTest(t.value, t.phrase) }
  }
}

function evaluate(node: Node, text: string): boolean {
  switch (node.kind) {
    case 'term': return node.test(text)
    case 'not': return !evaluate(node.child, text)
    case 'and': return evaluate(node.left, text) && evaluate(node.right, text)
    case 'or': return evaluate(node.left, text) || evaluate(node.right, text)
  }
}

/** Compiles a Boolean search. Throws BooleanSyntaxError with a plain-words message. */
export function compileBoolean(expr: string): ((s: SearchText) => boolean) | null {
  const tokens = tokenize(expr)
  if (tokens.length === 0) return null
  const ast = new Parser(tokens).parse()
  return (s) => evaluate(ast, s.text)
}
