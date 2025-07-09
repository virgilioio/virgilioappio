import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'

interface SyncResult {
  synced_count: number
  skipped_count: number
  details: any
}

export function useCandidateSync() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const syncCandidates = async (): Promise<SyncResult | null> => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Starting candidate sync...')
      
      const { data, error: syncError } = await supabase
        .rpc('sync_job_candidates_to_independent')

      if (syncError) {
        console.error('Error syncing candidates:', syncError)
        throw syncError
      }

      console.log('Sync completed:', data)
      
      const result = data?.[0] || { synced_count: 0, skipped_count: 0, details: [] }
      
      toast({
        title: 'Sync Completed',
        description: `${result.synced_count} candidates synced, ${result.skipped_count} skipped`,
      })

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync candidates'
      console.error('Candidate sync error:', err)
      setError(errorMessage)
      toast({
        title: 'Sync Error',
        description: errorMessage,
        variant: 'destructive'
      })
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return {
    syncCandidates,
    isLoading,
    error
  }
}