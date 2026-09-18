/**
 * The share row for one candidate–job pair.
 *
 * Created lazily the first time the share menu opens — never backfilled, because
 * most associations are never shared and a table of unused tokens is a liability.
 * `is_public` starts false: creating the row publishes nothing.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface DossierShare {
  id: string
  token: string
  isPublic: boolean
  deactivatedAt: string | null
  deactivatedReason: 'candidate_rejected' | 'job_closed' | 'manual' | null
  viewCount: number
  lastViewedAt: string | null
}

interface Row {
  id: string
  token: string
  is_public: boolean
  deactivated_at: string | null
  deactivated_reason: string | null
  view_count: number
  last_viewed_at: string | null
}

const map = (row: Row): DossierShare => ({
  id: row.id,
  token: row.token,
  isPublic: row.is_public,
  deactivatedAt: row.deactivated_at,
  deactivatedReason: (row.deactivated_reason as DossierShare['deactivatedReason']) ?? null,
  viewCount: row.view_count ?? 0,
  lastViewedAt: row.last_viewed_at,
})

const COLUMNS = 'id, token, is_public, deactivated_at, deactivated_reason, view_count, last_viewed_at'

export function useDossierShare(associationId: string | null, enabled: boolean) {
  const [share, setShare] = useState<DossierShare | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ensure = useCallback(async () => {
    if (!associationId) return
    setIsLoading(true)
    setError(null)
    try {
      const existing = await supabase
        .from('dossier_shares')
        .select(COLUMNS)
        .eq('association_id', associationId)
        .maybeSingle()
      if (existing.error) throw existing.error
      if (existing.data) {
        setShare(map(existing.data as Row))
        return
      }
      const { data: auth } = await supabase.auth.getUser()
      const created = await supabase
        .from('dossier_shares')
        .insert({ association_id: associationId, created_by: auth?.user?.id ?? null })
        .select(COLUMNS)
        .single()
      if (created.error) throw created.error
      setShare(map(created.data as Row))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The share link could not be prepared.')
    } finally {
      setIsLoading(false)
    }
  }, [associationId])

  useEffect(() => {
    if (enabled && associationId && !share && !isLoading) void ensure()
  }, [enabled, associationId, share, isLoading, ensure])

  /** Publishing or unpublishing. The reason and timestamp are stamped by the database. */
  const setPublic = useCallback(async (next: boolean) => {
    if (!share) return
    const previous = share
    setShare({ ...share, isPublic: next })
    const { data, error: updateError } = await supabase
      .from('dossier_shares')
      .update({ is_public: next })
      .eq('id', share.id)
      .select(COLUMNS)
      .single()
    if (updateError) {
      setShare(previous)
      setError(updateError.message)
      return
    }
    setShare(map(data as Row))
  }, [share])

  return { share, isLoading, error, setPublic, refresh: ensure }
}

export function dossierPublicUrl(token: string) {
  return `${window.location.origin}/d/${token}`
}
