/**
 * Session-only store for candidate reference links.
 *
 * Tokens are persisted as hashes ONLY, so a link can never be read back from
 * the database. We therefore keep the URL we just minted for the lifetime of
 * this tab, which is what makes "Copy link" safe: it copies the link the
 * recruiter actually sent instead of silently invalidating it by rotating.
 */
import { useSyncExternalStore } from 'react'

const links = new Map<string, string>()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function rememberReferenceLink(requestId: string, link?: string | null) {
  if (!requestId || !link) return
  links.set(requestId, link)
  emit()
}

export function forgetReferenceLink(requestId: string) {
  if (links.delete(requestId)) emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The link minted in this session for this request, or null. */
export function useSessionReferenceLink(requestId?: string | null): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (requestId ? links.get(requestId) ?? null : null),
    () => null,
  )
}

/* ------------------------------------------------------------------ referees */

const refereeLinks = new Map<string, string>()

/** Same rule for referee questionnaire links, keyed by referee id. */
export function rememberRefereeLink(refereeId: string, link?: string | null) {
  if (!refereeId || !link) return
  refereeLinks.set(refereeId, link)
  emit()
}

export function useSessionRefereeLinks(): Record<string, string> {
  return useSyncExternalStore(
    subscribe,
    () => {
      const snapshot: Record<string, string> = {}
      refereeLinks.forEach((v, k) => {
        snapshot[k] = v
      })
      return snapshot
    },
    () => ({}),
  )
}
