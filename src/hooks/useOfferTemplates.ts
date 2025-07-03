import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface OfferTemplate {
  id: string
  name: string
  description?: string
  content: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface OfferTemplateField {
  id: string
  template_id: string
  field_name: string
  field_label: string
  field_type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'file' | 'email' | 'tel' | 'url'
  is_required: boolean
  display_order: number
  placeholder_text?: string
  help_text?: string
  accepted_file_types?: string
  max_file_size_mb?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export function useOfferTemplates() {
  const [templates, setTemplates] = useState<OfferTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('offer_templates')
        .select('*')
        .order('name')

      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error fetching offer templates:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch offer templates',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createTemplate = async (templateData: Omit<OfferTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('offer_templates')
        .insert(templateData)
        .select()
        .single()

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Offer template created successfully'
      })

      await fetchTemplates()
      return data
    } catch (error) {
      console.error('Error creating offer template:', error)
      toast({
        title: 'Error',
        description: 'Failed to create offer template',
        variant: 'destructive'
      })
      throw error
    }
  }

  const updateTemplate = async (id: string, templateData: Partial<OfferTemplate>) => {
    try {
      const { error } = await supabase
        .from('offer_templates')
        .update(templateData)
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Offer template updated successfully'
      })

      await fetchTemplates()
    } catch (error) {
      console.error('Error updating offer template:', error)
      toast({
        title: 'Error',
        description: 'Failed to update offer template',
        variant: 'destructive'
      })
      throw error
    }
  }

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('offer_templates')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Offer template deleted successfully'
      })

      await fetchTemplates()
    } catch (error) {
      console.error('Error deleting offer template:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete offer template',
        variant: 'destructive'
      })
      throw error
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  return {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetchTemplates: fetchTemplates
  }
}