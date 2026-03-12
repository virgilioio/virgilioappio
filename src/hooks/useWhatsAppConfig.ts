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

export type WhatsAppSetupStatus =
  | 'not_started'
  | 'provisioning'
  | 'sender_pending'
  | 'sender_active'
  | 'templates_required'
  | 'ready'
  | 'error'

export interface WhatsAppSetupState {
  status: WhatsAppSetupStatus
  label: string
  description: string
  canMessage: boolean
}

const SETUP_STATES: Record<WhatsAppSetupStatus, Omit<WhatsAppSetupState, 'status'>> = {
  not_started: {
    label: 'Not set up',
    description: 'WhatsApp has not been configured for this workspace yet.',
    canMessage: false,
  },
  provisioning: {
    label: 'Provisioning',
    description: 'A WhatsApp number is being provisioned for your workspace.',
    canMessage: false,
  },
  sender_pending: {
    label: 'Sender pending',
    description: 'Your WhatsApp sender is registered but pending verification.',
    canMessage: false,
  },
  sender_active: {
    label: 'Sender active',
    description: 'Your WhatsApp sender is active. You need approved templates before messaging.',
    canMessage: false,
  },
  templates_required: {
    label: 'Templates needed',
    description: 'Your sender is ready but you need at least one approved template for first-contact messaging.',
    canMessage: false,
  },
  ready: {
    label: 'Ready to message',
    description: 'Your workspace WhatsApp is fully set up and ready to send messages.',
    canMessage: true,
  },
  error: {
    label: 'Action needed',
    description: 'There was an issue with your WhatsApp setup. Please check the details below.',
    canMessage: false,
  },
}

export function useWhatsAppConfig() {
  const { automation, isLoading, isSaving, save: baseSave, toggle } = useWorkspaceAutomation('whatsapp_config')
  const queryClient = useQueryClient()

  const config = automation?.config || {}

  const whatsappNumber = useMemo(
    () => (config.whatsapp_number as string) || '',
    [config]
  )

  const fromNumber = useMemo(
    () => (config.twilio_from_number as string) || '',
    [config]
  )

  const isProvisioned = useMemo(
    () => !!config.whatsapp_number,
    [config]
  )

  const isActive = automation?.is_active ?? false

  const lastError = useMemo(
    () => (config.last_error as string) || null,
    [config]
  )

  const provisionedAt = useMemo(
    () => (config.provisioned_at as string) || null,
    [config]
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

  const disableMessaging = useCallback(() => {
    return baseSave({
      is_active: false,
      config: { ...config, is_connected: false },
    } as any)
  }, [baseSave, config])

  return {
    isProvisioned,
    whatsappNumber,
    fromNumber,
    isLoading,
    isSaving,
    isActive,
    lastError,
    provisionedAt,
    config,
    saveNumber,
    toggle,
    provisionNumber,
    disableMessaging,
  }
}

/**
 * Computes the workspace WhatsApp setup status from config + templates.
 */
export function useWhatsAppSetupStatus(): WhatsAppSetupState & { isLoading: boolean } {
  const { isProvisioned, isActive, lastError, isLoading: configLoading } = useWhatsAppConfig()
  const { data: templates = [], isLoading: templatesLoading } = useWhatsAppTemplates()

  const isLoading = configLoading || templatesLoading

  const status = useMemo((): WhatsAppSetupStatus => {
    if (!isProvisioned) return 'not_started'
    if (lastError) return 'error'
    if (!isActive) return 'sender_active' // provisioned but disabled
    
    // Check for approved templates (ones with twilio_content_sid)
    const approvedTemplates = templates.filter(
      (t) => !!t.twilio_content_sid && t.approval_status === 'approved'
    )
    
    if (approvedTemplates.length === 0) return 'templates_required'
    return 'ready'
  }, [isProvisioned, isActive, lastError, templates])

  const stateInfo = SETUP_STATES[status]

  return {
    status,
    ...stateInfo,
    isLoading,
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

export function useSubmitWhatsAppTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-whatsapp-templates', {
        body: { action: 'submit', template_id: templateId },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] })
    },
  })
}

export function useCheckWhatsAppTemplateStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-whatsapp-templates', {
        body: { action: 'check-status', template_id: templateId },
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
