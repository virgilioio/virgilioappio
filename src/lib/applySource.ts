import { useEffect } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import {
  appliedViaText,
  isOwnHost,
  normalHost,
  type ApplySourceDetail,
  type RawApplySource,
} from '../../supabase/functions/_shared/applySource.ts'

export {
  CHANNELS,
  appliedViaText,
  channelLabel,
  channelOf,
  resolveApplySource,
  type ApplySourceDetail,
  type RawApplySource,
} from '../../supabase/functions/_shared/applySource.ts'

/**
 * The careers pages remember where a visitor came from (job exposure, Phase 1,
 * 2026-11-12): the link's tags (`?src=`, `?source=`, `?utm_*`, `?by=`) and the host of
 * the page that sent them, kept for the visit so browsing the careers page before
 * applying doesn't lose it. A later link with something to say replaces it; a visit
 * with nothing to say never does. The application sends it as `source_tags`, and
 * public-submit-application decides the channel (the browser never names it).
 */

const KEY = 'gio:apply-source'

export function readTags(search: string, referrer: string): RawApplySource {
  const p = new URLSearchParams(search)
  const pick = (k: string) => {
    const v = p.get(k)
    return v && v.trim() ? v.trim().slice(0, 80) : null
  }
  let host: string | null = null
  try {
    host = referrer ? normalHost(new URL(referrer).host) : null
  } catch {
    host = null
  }
  return {
    src: pick('src'),
    source: pick('source'),
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
    by: pick('by'),
    referrer_host: host && !isOwnHost(host) ? host : null,
  }
}

function hasSomething(t: RawApplySource): boolean {
  return Object.values(t).some((v) => typeof v === 'string' && v.length > 0)
}

export function captureApplySource(search: string, referrer: string): void {
  const tags = readTags(search, referrer)
  try {
    const existing = sessionStorage.getItem(KEY)
    if (hasSomething(tags) || !existing) sessionStorage.setItem(KEY, JSON.stringify(tags))
  } catch {
    /* private window or blocked storage: the application still goes, as "Direct or unknown" */
  }
}

/** What to send with the application: the remembered tags, else this page's own. */
export function applySourceTags(): RawApplySource {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as RawApplySource
  } catch {
    /* fall through */
  }
  return typeof window === 'undefined' ? {} : readTags(window.location.search, document.referrer)
}

/** Mounted once by each careers page. */
export function useCaptureApplySource(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return
    captureApplySource(window.location.search, document.referrer)
  }, [])
}

/**
 * "LinkedIn · shared by Ana" for an application, or null when it wasn't tracked
 * (before 2026-11-12, or added by the team).
 */
export async function appliedViaFor(associationId: string): Promise<string | null> {
  // The columns are newer than the generated types until the next regeneration.
  const db = supabase as unknown as SupabaseClient
  const { data } = await db
    .from('job_candidate_associations')
    .select('applied_via, applied_via_detail')
    .eq('id', associationId)
    .maybeSingle()
  const key = (data?.applied_via as string | null) ?? null
  if (!key) return null
  const detail = ((data?.applied_via_detail ?? {}) as ApplySourceDetail & { shared_by?: string })
  let sharedByName: string | null = null
  if (typeof detail.shared_by === 'string') {
    const { data: p } = await db.from('profiles').select('first_name, last_name').eq('id', detail.shared_by).maybeSingle()
    sharedByName = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || null
  }
  return appliedViaText(key, { ...detail, shared_by_name: sharedByName })
}
