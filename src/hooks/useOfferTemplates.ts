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
  source?: 'platform' | 'organization'
  organization_id?: string | null
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

export type OfferTemplatesContext = 'platform-defaults' | 'organization'

export function useOfferTemplates(context: OfferTemplatesContext = 'organization') {
  const [templates, setTemplates] = useState<OfferTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      let query = supabase
        .from('offer_templates')
        .select('*')

      // Filter based on context
      if (context === 'platform-defaults') {
        query = query.is('organization_id', null)
      } else {
        // For organization context, get both platform defaults and organization templates
        const { data: { user } } = await supabase.auth.getUser()
        const { data: memberData } = await supabase
          .from('members')
          .select('organization_id, user_type')
          .eq('user_id', user?.id)
          .eq('user_status', 'active')
          .single()

        if (memberData?.organization_id) {
          // Fetch both platform defaults (organization_id IS NULL) and organization-specific templates
          query = query.or(`organization_id.is.null,organization_id.eq.${memberData.organization_id}`)
        } else {
          // If no organization, show only platform defaults
          query = query.is('organization_id', null)
        }
      }

      const { data, error } = await query
        .order('organization_id', { ascending: true, nullsFirst: true }) // Platform defaults first
        .order('name')

      if (error) throw error
      
      // Add source identification
      const templatesWithSource = (data || []).map((template: any) => ({
        ...template,
        source: template.organization_id ? 'organization' as const : 'platform' as const
      }))
      
      setTemplates(templatesWithSource)
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
      const { data: { user } } = await supabase.auth.getUser()
      
      // Get user's organization for workspace owners
      const { data: memberData } = await supabase
        .from('members')
        .select('organization_id, user_type')
        .eq('user_id', user?.id)
        .eq('user_status', 'active')
        .single()

      let organizationId = null
      if (context === 'organization' && memberData?.user_type === 'workspace_owner') {
        organizationId = memberData.organization_id
      }
      // For platform-defaults context, organizationId stays null

      const enrichedTemplateData = {
        ...templateData,
        organization_id: organizationId,
        created_by: user?.id
      }

      const { data, error } = await supabase
        .from('offer_templates')
        .insert(enrichedTemplateData)
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