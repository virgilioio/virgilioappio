import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'

interface EnrichResult {
  candidate_id: string
  apollo_id?: string
  email?: string
  phone?: string
  success: boolean
  error?: string
}

interface EnrichResponse {
  results: EnrichResult[]
  enriched_count: number
  credits_used: number
  credits_remaining: number
  already_enriched?: number
  missing_linkedin?: number
  error?: string
  error_code?: string
}

export function useEnrichCandidate() {
  const [isEnriching, setIsEnriching] = useState(false)
  const { toast } = useToast()

  const enrichByLinkedIn = async (candidateIds: string | string[]): Promise<EnrichResponse | null> => {
    const ids = Array.isArray(candidateIds) ? candidateIds : [candidateIds]
    
    if (ids.length === 0) {
      toast({
        title: 'No candidates selected',
        description: 'Please select candidates to enrich',
        variant: 'destructive'
      })
      return null
    }

    setIsEnriching(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase.functions.invoke('enrich-by-linkedin', {
        body: {
          candidate_ids: ids,
          user_id: user?.id
        }
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data.error) {
        if (data.error_code === 'CREDITS_EXHAUSTED') {
          toast({
            title: 'Credit limit reached',
            description: 'You have used all your monthly enrichment credits',
            variant: 'destructive'
          })
        } else {
          throw new Error(data.error)
        }
        return data
      }

      // Show success message
      if (data.enriched_count > 0) {
        toast({
          title: 'Enrichment complete',
          description: `Successfully enriched ${data.enriched_count} candidate${data.enriched_count > 1 ? 's' : ''} using ${data.credits_used} credit${data.credits_used > 1 ? 's' : ''}`
        })
      } else if (data.already_enriched > 0) {
        toast({
          title: 'Already enriched',
          description: `${data.already_enriched} candidate${data.already_enriched > 1 ? 's were' : ' was'} already enriched`
        })
      } else if (data.missing_linkedin > 0) {
        toast({
          title: 'Missing LinkedIn URL',
          description: 'Selected candidates do not have LinkedIn URLs',
          variant: 'destructive'
        })
      }

      return data

    } catch (err) {
      console.error('Enrichment error:', err)
      toast({
        title: 'Enrichment failed',
        description: err instanceof Error ? err.message : 'Failed to enrich candidate',
        variant: 'destructive'
      })
      return null
    } finally {
      setIsEnriching(false)
    }
  }

  const canEnrich = (candidate: {
    linkedin_url?: string | null
    apollo_collected_at?: string | null
    email?: string | null
    phone?: string | null
  }): boolean => {
    // Can enrich if has LinkedIn URL and either:
    // 1. Not already enriched (no apollo_collected_at)
    // 2. Missing email or phone (partial enrichment might help)
    if (!candidate.linkedin_url) return false
    if (!candidate.apollo_collected_at) return true
    return false // Already enriched
  }

  return {
    enrichByLinkedIn,
    canEnrich,
    isEnriching
  }
}
