import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'

export interface OfferLetter {
  id: string
  candidate_id: string
  job_id: string
  template_id?: string | null
  form_id?: string | null
  organization_id: string
  title: string
  content?: string | null
  field_values: Record<string, any>
  status: 'draft' | 'pending_approval' | 'approved' | 'finalized' | 'sent' | 'accepted' | 'declined'
  created_by?: string
  created_at: string
  updated_at: string
}

export function useOfferLetters(candidateId?: string) {
  const [offerLetters, setOfferLetters] = useState<OfferLetter[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const fetchOfferLetters = async () => {
    if (!candidateId) {
      setOfferLetters([])
      return
    }

    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('offer_letters')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setOfferLetters((data || []).map(item => ({
        ...item,
        field_values: typeof item.field_values === 'string' 
          ? JSON.parse(item.field_values) 
          : item.field_values || {},
        status: item.status as OfferLetter['status'],
        created_by: item.created_by || undefined
      })))
    } catch (error) {
      console.error('Error fetching offer letters:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch offer letters',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createOfferLetter = async (offerLetterData: Omit<OfferLetter, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('offer_letters')
        .insert(offerLetterData)
        .select()
        .single()

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Offer letter created successfully'
      })

      await fetchOfferLetters()
      return data
    } catch (error) {
      console.error('Error creating offer letter:', error)
      toast({
        title: 'Error',
        description: 'Failed to create offer letter',
        variant: 'destructive'
      })
      throw error
    }
  }

  const updateOfferLetter = async (id: string, updates: Partial<OfferLetter>) => {
    try {
      const { error } = await supabase
        .from('offer_letters')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Offer letter updated successfully'
      })

      await fetchOfferLetters()
    } catch (error) {
      console.error('Error updating offer letter:', error)
      toast({
        title: 'Error',
        description: 'Failed to update offer letter',
        variant: 'destructive'
      })
      throw error
    }
  }

  const deleteOfferLetter = async (id: string) => {
    try {
      const { error } = await supabase
        .from('offer_letters')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Offer letter deleted successfully'
      })

      await fetchOfferLetters()
    } catch (error) {
      console.error('Error deleting offer letter:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete offer letter',
        variant: 'destructive'
      })
      throw error
    }
  }

  useEffect(() => {
    fetchOfferLetters()
  }, [candidateId])

  // Listen for cross-component refetch events
  useEffect(() => {
    const handler = () => fetchOfferLetters()
    window.addEventListener('refetch-offer-letters', handler)
    return () => window.removeEventListener('refetch-offer-letters', handler)
  }, [candidateId])

  return {
    offerLetters,
    isLoading,
    createOfferLetter,
    updateOfferLetter,
    deleteOfferLetter,
    refetchOfferLetters: fetchOfferLetters
  }
}