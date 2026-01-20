import { supabase } from '@/lib/supabaseClient'

/**
 * Triggers background AI enrichment for a candidate profile.
 * This runs asynchronously and updates the candidate record when complete.
 * The function returns immediately (fire-and-forget pattern).
 */
export async function triggerBackgroundEnrichment(
  candidateId: string,
  resumeText: string,
  candidateName?: string
): Promise<void> {
  try {
    console.log(`[Background Enrichment] Triggering for candidate ${candidateId}`)
    
    // Fire and forget - we don't await the result
    supabase.functions.invoke('enrich-candidate-profile', {
      body: {
        candidateId,
        resumeText,
        candidateName,
      },
    }).then(({ error }) => {
      if (error) {
        console.error('[Background Enrichment] Error:', error)
      } else {
        console.log(`[Background Enrichment] Queued for candidate ${candidateId}`)
      }
    }).catch((err) => {
      console.error('[Background Enrichment] Failed to invoke:', err)
    })
  } catch (err) {
    console.error('[Background Enrichment] Error triggering enrichment:', err)
  }
}

/**
 * Hook for candidate enrichment operations
 */
export function useCandidateEnrichment() {
  return {
    triggerBackgroundEnrichment,
  }
}
