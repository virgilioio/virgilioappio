/**
 * Mentions in candidate comments (2026-10-19). A tag is stored in the comment
 * as `@[Name](user:<uuid>)`; the database reads that form to notify the person
 * (tg_notify_mention) and refuses it on a private comment. While writing, the
 * composer shows plain "@Name" and keeps the people picked from the "@" menu;
 * `encodeMentions` turns the ones still in the text into the stored form.
 */

export interface MentionPerson {
  id: string
  name: string
}

export type CommentPart = { kind: 'text'; text: string } | { kind: 'mention'; name: string; id: string }

const STORED_SOURCE = /@\[([^\]\n]+)\]\(user:([0-9a-f-]{36})\)/.source

/** Split a stored comment into text and mentions, in order. */
export function parseComment(content: string): CommentPart[] {
  const parts: CommentPart[] = []
  let last = 0
  for (const m of content.matchAll(new RegExp(STORED_SOURCE, 'gi'))) {
    const at = m.index ?? 0
    if (at > last) parts.push({ kind: 'text', text: content.slice(last, at) })
    parts.push({ kind: 'mention', name: m[1], id: m[2].toLowerCase() })
    last = at + m[0].length
  }
  if (last < content.length) parts.push({ kind: 'text', text: content.slice(last) })
  return parts
}

/** "@Name" as written, not followed by more of a word ("@Ann" is not in "@Annabel"). */
function plainTag(name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`@${escaped}(?![\\p{L}\\p{N}])`, 'gu')
}

/** The picked people whose "@Name" is still in the draft. */
export function taggedIn(draft: string, picked: MentionPerson[]): MentionPerson[] {
  const seen = new Set<string>()
  return picked.filter((p) => {
    if (seen.has(p.id)) return false
    const found = plainTag(p.name).test(draft)
    if (found) seen.add(p.id)
    return found
  })
}

/** Whether the draft tags anyone: a picked "@Name" or a stored tag typed by hand. */
export function draftHasTag(draft: string, picked: MentionPerson[]): boolean {
  return taggedIn(draft, picked).length > 0 || new RegExp(STORED_SOURCE, 'i').test(draft)
}

/** The draft as stored: every picked "@Name" still in it becomes `@[Name](user:id)`. */
export function encodeMentions(draft: string, picked: MentionPerson[]): string {
  // Longest names first, so "@Ann Lee" is taken before "@Ann" could match inside it.
  const people = taggedIn(draft, picked).sort((a, b) => b.name.length - a.name.length)
  let out = draft
  for (const p of people) out = out.replace(plainTag(p.name), `@[${p.name}](user:${p.id})`)
  return out
}

/** The "@" being typed at the caret, if any: where it starts and what follows it. */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret)
  const m = before.match(/(?:^|[\s(])@([\p{L}\p{N}.'-]{0,30}(?: [\p{L}\p{N}.'-]{0,30})?)$/u)
  if (!m) return null
  return { start: caret - m[1].length - 1, query: m[1] }
}

/** People matching a query: names starting with it first, then any word or the email. */
export function matchPeople<T extends { name: string; email?: string | null }>(people: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return people
  const starts: T[] = []
  const words: T[] = []
  for (const p of people) {
    const name = p.name.toLowerCase()
    if (name.startsWith(q)) starts.push(p)
    else if (name.split(/\s+/).some((w) => w.startsWith(q)) || (p.email ?? '').toLowerCase().startsWith(q)) words.push(p)
  }
  return [...starts, ...words]
}
