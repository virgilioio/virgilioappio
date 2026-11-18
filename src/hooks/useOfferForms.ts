import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import type { OfferSection } from '@/lib/offerSections'

export interface OfferForm {
  id: string
  name: string
  description?: string
  organization_id?: string
  tenant_id?: string | null
  source: 'platform' | 'tenant'
  is_active: boolean
  /** The form's sections in order (offer_forms.sections). */
  sections?: OfferSection[]
  created_by?: string
  created_at: string
  updated_at: string
}

export type OfferFormsContext = 'platform-defaults' | 'organization'

export function useOfferForms(context: OfferFormsContext = 'organization') {
  const [forms, setForms] = useState<OfferForm[]>([])
  const [isLoading, setIsLoading] = useState(false)
  // A failed load shows Retry (LoadError) instead of reading as an empty list.
  const [loadError, setLoadError] = useState<unknown>(null)
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
      setLoadError(null)
    } catch (error) {
      console.error('Error fetching offer forms:', error)
      setLoadError(error)
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

  const updateForm = async (id: string, formData: Omit<Partial<OfferForm>, 'sections'>) => {
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

  /**
   * A copy of a form with its sections, fields and dropdown options, made in
   * one go by the database (offer_form_duplicate). It starts inactive and isn't
   * linked to any Gio Sign document. The caller says what happened.
   */
  const duplicateForm = async (id: string, name: string): Promise<string> => {
    const { data, error } = await supabase.rpc('offer_form_duplicate', { p_form_id: id, p_name: name })
    if (error) {
      console.error('Error duplicating offer form:', error)
      throw error
    }
    await fetchForms()
    return data
  }

  /** Active forms are offered when writing an offer. The caller says what happened. */
  const setFormActive = async (id: string, active: boolean) => {
    // Shown at once, put back if the save fails (§5).
    const flip = (to: boolean) => setForms((list) => list.map((f) => (f.id === id ? { ...f, is_active: to } : f)))
    flip(active)
    const { error } = await supabase.from('offer_forms').update({ is_active: active }).eq('id', id)
    if (error) {
      console.error('Error changing an offer form:', error)
      flip(!active)
      throw error
    }
  }

  /** `quiet`: the caller shows the error itself (the delete dialog does). */
  const deleteForm = async (id: string, opts: { quiet?: boolean } = {}) => {
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
      if (!opts.quiet) toast({ title: 'Error', description: 'Failed to delete offer form', variant: 'destructive' })
      throw error
    }
  }

  useEffect(() => {
    fetchForms()
  }, [])

  return {
    forms,
    isLoading,
    loadError,
    createForm,
    updateForm,
    duplicateForm,
    setFormActive,
    deleteForm,
    refetchForms: fetchForms
  }
}
