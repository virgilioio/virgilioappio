import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { DuplicateContext } from './types'

export function useDuplicateContext(
  existingCandidateId: string | null,
  incoming: Record<string, any> | null,
  enabled: boolean,
) {
  const [context, setContext] = useState<DuplicateContext | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !existingCandidateId) return
    let cancelled = false

    const run = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-duplicate-context', {
          body: { existing_candidate_id: existingCandidateId, incoming: incoming ?? {} },
        })
        if (fnError) {
          const details =
            fnError instanceof FunctionsHttpError ? await fnError.context.text() : fnError.message
          throw new Error(details)
        }
        if (!cancelled) setContext(data as DuplicateContext)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the record')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, existingCandidateId])

  return { context, isLoading, error }
}
