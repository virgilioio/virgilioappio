import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface WorkerContractTemplate {
  id: string
  country_id: string
  template_name: string
  template_content?: string
  version: number
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export function useWorkerContractTemplates(countryId?: string) {
  const [templates, setTemplates] = useState<WorkerContractTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      
      let query = supabase
        .from('worker_contract_templates')
        .select('*')
        .order('template_name')

      if (countryId) {
        query = query.eq('country_id', countryId)
      }

      const { data, error } = await query

      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error fetching worker contract templates:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch contract templates',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createTemplate = async (templateData: Omit<WorkerContractTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('worker_contract_templates')
        .insert({
          ...templateData,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single()

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Contract template created successfully'
      })

      await fetchTemplates()
      return data
    } catch (error) {
      console.error('Error creating contract template:', error)
      toast({
        title: 'Error',
        description: 'Failed to create contract template',
        variant: 'destructive'
      })
      throw error
    }
  }

  const updateTemplate = async (id: string, templateData: Partial<WorkerContractTemplate>) => {
    try {
      const { error } = await supabase
        .from('worker_contract_templates')
        .update(templateData)
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Contract template updated successfully'
      })

      await fetchTemplates()
    } catch (error) {
      console.error('Error updating contract template:', error)
      toast({
        title: 'Error',
        description: 'Failed to update contract template',
        variant: 'destructive'
      })
      throw error
    }
  }

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('worker_contract_templates')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Contract template deleted successfully'
      })

      await fetchTemplates()
    } catch (error) {
      console.error('Error deleting contract template:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete contract template',
        variant: 'destructive'
      })
      throw error
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [countryId])

  return {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetchTemplates: fetchTemplates
  }
}