
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface CandidateUrl {
  id: string
  candidate_id: string
  label: string
  url: string
  icon_name: string
  created_at: string
  updated_at: string
  created_by: string | null
}

export function useCandidateUrls(candidateId: string) {
  const [urls, setUrls] = useState<CandidateUrl[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const { user } = useAuth()

  const getUrls = async () => {
    if (!candidateId) return

    setIsLoading(true)
    try {
      console.log('Fetching URLs for candidate:', candidateId)
      
      const { data, error } = await supabase
        .from('candidate_urls')
        .select('id, candidate_id, label, url, icon_name, created_at, updated_at, created_by')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Error fetching URLs:', error)
        throw error
      }

      console.log('Fetched URLs:', data)
      setUrls(data || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch URLs'
      console.error('URLs fetch error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addUrl = async (label: string, url: string, iconName: string) => {
    if (!user || !candidateId) {
      throw new Error('User not authenticated or candidate ID missing')
    }

    setIsAdding(true)
    try {
      console.log('Adding URL:', { label, url, iconName, candidateId })
      
      const { error } = await supabase
        .from('candidate_urls')
        .insert({
          candidate_id: candidateId,
          label,
          url,
          icon_name: iconName,
          created_by: user.id
        })

      if (error) {
        console.error('Database insert error:', error)
        throw error
      }

      console.log('URL added successfully')

      toast({
        title: 'Success',
        description: 'URL added successfully'
      })

      await getUrls()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add URL'
      console.error('Add URL error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsAdding(false)
    }
  }

  const deleteUrl = async (urlId: string) => {
    setIsLoading(true)
    try {
      console.log('Deleting URL:', urlId)
      
      const { error } = await supabase
        .from('candidate_urls')
        .delete()
        .eq('id', urlId)

      if (error) {
        console.error('Database delete error:', error)
        throw error
      }

      toast({
        title: 'Success',
        description: 'URL deleted successfully'
      })

      await getUrls()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete URL'
      console.error('Delete URL error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (candidateId) {
      getUrls()
    }
  }, [candidateId])

  return {
    urls,
    isLoading,
    isAdding,
    addUrl,
    deleteUrl,
    getUrls
  }
}
