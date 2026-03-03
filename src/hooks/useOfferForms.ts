import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'

export interface OfferForm {
  id: string
  name: string
  description?: string
  organization_id?: string
  tenant_id?: string | null
  source: 'platform' | 'tenant'
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export type OfferFormsContext = 'platform-defaults' | 'organization'

export function useOfferForms(context: OfferFormsContext = 'organization') {
  const [forms, setForms] = useState<OfferForm[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const fetchForms = async () => {
    try {
      setIsLoading(true)
      let query = supabase
        .from('offer_forms')
        .select('*')

      if (context === 'platform-defaults') {
        query = query.is('tenant_id', null)
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: memberData } = await supabase
          .from('members')
          .select('tenant_id')
          .eq('user_id', user?.id)
          .eq('user_status', 'active')
          .single()

        if (memberData?.tenant_id) {
          query = query.or(`tenant_id.is.null,tenant_id.eq.${memberData.tenant_id}`)
        } else {
          query = query.is('tenant_id', null)
        }
      }

      const { data, error } = await query
        .order('tenant_id', { ascending: true, nullsFirst: true })
        .order('name')

      if (error) throw error

      const formsWithSource = (data || []).map((form: any) => ({
        ...form,
        source: form.tenant_id ? 'tenant' as const : 'platform' as const
      }))

      setForms(formsWithSource)
    } catch (error) {
      console.error('Error fetching offer forms:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch offer forms',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createForm = async (formData: { name: string; description?: string }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: memberData } = await supabase
        .from('members')
        .select('tenant_id, user_type')
        .eq('user_id', user?.id)
        .eq('user_status', 'active')
        .single()

      let tenantId = null
      if (context === 'organization' && memberData?.user_type === 'workspace_owner') {
        tenantId = memberData.tenant_id
      }

      const { data, error } = await supabase
        .from('offer_forms')
        .insert({
          ...formData,
          tenant_id: tenantId,
          created_by: user?.id
        })
        .select()
        .single()

      if (error) throw error

      toast({ title: 'Success', description: 'Offer form created successfully' })
      await fetchForms()
      return data
    } catch (error) {
      console.error('Error creating offer form:', error)
      toast({ title: 'Error', description: 'Failed to create offer form', variant: 'destructive' })
      throw error
    }
  }

  const updateForm = async (id: string, formData: Partial<OfferForm>) => {
    try {
      const { error } = await supabase
        .from('offer_forms')
        .update(formData)
        .eq('id', id)

      if (error) throw error

      toast({ title: 'Success', description: 'Offer form updated successfully' })
      await fetchForms()
    } catch (error) {
      console.error('Error updating offer form:', error)
      toast({ title: 'Error', description: 'Failed to update offer form', variant: 'destructive' })
      throw error
    }
  }

  const deleteForm = async (id: string) => {
    try {
      const { error } = await supabase
        .from('offer_forms')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({ title: 'Success', description: 'Offer form deleted successfully' })
      await fetchForms()
    } catch (error) {
      console.error('Error deleting offer form:', error)
      toast({ title: 'Error', description: 'Failed to delete offer form', variant: 'destructive' })
      throw error
    }
  }

  useEffect(() => {
    fetchForms()
  }, [])

  return {
    forms,
    isLoading,
    createForm,
    updateForm,
    deleteForm,
    refetchForms: fetchForms
  }
}
