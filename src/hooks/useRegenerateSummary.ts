import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

/**
 * Runs the existing AI profile-generation job (enrich-candidate-profile)
 * for a candidate. Same job the resume parse uses — no second path.
 */
export function useRegenerateSummary(candidateId?: string | null, candidateName?: string | null) {
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const regenerate = useCallback(
    async (onDone?: () => void) => {
      if (!candidateId || isRegenerating) return
      setIsRegenerating(true)
      setError(null)
      try {
        const { error: fnError } = await supabase.functions.invoke('enrich-candidate-profile', {
          body: { candidateId, candidateName: candidateName || undefined, force: true },
        })
        if (fnError) throw fnError
        onDone?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gio could not regenerate the summary. Please try again.')
      } finally {
        setIsRegenerating(false)
      }
    },
    [candidateId, candidateName, isRegenerating],
  )

  return { isRegenerating, error, regenerate }
}
