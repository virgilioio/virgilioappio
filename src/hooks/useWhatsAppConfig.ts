import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'
import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface WhatsAppTemplate {
  id: string
  tenant_id: string | null
  name: string
  category: string
  language: string
  body_template: string
  variable_mapping: Record<string, string>
  twilio_content_sid: string | null
  approval_status: string
  created_at: string
}

export function useWhatsAppConfig() {
  const { automation, isLoading, isSaving, save: baseSave, toggle } = useWorkspaceAutomation('whatsapp_config')
  const queryClient = useQueryClient()

  const isConfigured = useMemo(
    () => !!automation?.is_active && !!automation?.config?.whatsapp_number,
    [automation]
  )

  const whatsappNumber = useMemo(
    () => (automation?.config?.whatsapp_number as string) || '',
    [automation]
  )

  const fromNumber = useMemo(
    () => (automation?.config?.twilio_from_number as string) || '',
    [automation]
  )

  const isProvisioned = useMemo(
    () => !!automation?.config?.whatsapp_number,
    [automation]
  )

  const provisionNumber = useMutation({
    mutationFn: async (countryCode?: string) => {
      const { data, error } = await supabase.functions.invoke('provision-whatsapp-number', {
        body: { country_code: countryCode || 'US' },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-automation', 'whatsapp_config'] })
    },
  })

  const saveNumber = useCallback(
    (number: string) => {
      return baseSave({
        config: { twilio_from_number: `whatsapp:${number}`, whatsapp_number: number, is_connected: true },
      })
    },
    [baseSave]
  )

  return {
    isConfigured,
    isProvisioned,
    whatsappNumber,
    fromNumber,
    isLoading,
    isSaving,
    isActive: automation?.is_active ?? false,
    saveNumber,
    toggle,
    provisionNumber,
  }
}

export function useWhatsAppTemplates() {
  return useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-whatsapp-templates', {
        body: { action: 'list' },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return (data?.templates || []) as WhatsAppTemplate[]
    },
  })
}

export function useCreateWhatsAppTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      name: string
      category?: string
      language?: string
      body_template: string
      variable_mapping?: Record<string, string>
    }) => {
      const { data, error } = await supabase.functions.invoke('manage-whatsapp-templates', {
        body: { action: 'create', ...params },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data.template as WhatsAppTemplate
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] })
    },
  })
}
