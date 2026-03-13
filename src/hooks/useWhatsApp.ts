import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface WhatsAppConversation {
  id: string
  tenant_id: string
  candidate_id: string | null
  job_id: string | null
  phone_number: string
  display_name: string | null
  provider_chat_id: string | null
  is_manually_linked: boolean
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
  sync_status: string
  created_at: string
}

export interface WhatsAppMessage {
  id: string
  conversation_id: string
  tenant_id: string
  candidate_id: string | null
  job_id: string | null
  sender_id: string | null
  sender_name: string | null
  to_phone: string
  from_phone: string
  body: string
  provider_message_id: string | null
  status: string
  direction: string
  media_type: string | null
  media_url: string | null
  provider_timestamp: string | null
  created_at: string
}

export function useWhatsAppConversation(candidateId: string | undefined, jobId: string | undefined) {
  return useQuery({
    queryKey: ['whatsapp-conversation', candidateId, jobId],
    queryFn: async () => {
      if (!candidateId) return null

      let query = supabase
        .from('whatsapp_conversations' as any)
        .select('*')
        .eq('candidate_id', candidateId)

      if (jobId) {
        query = query.eq('job_id', jobId)
      }

      const { data, error } = await query.order('last_message_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw error
      return data as unknown as WhatsAppConversation | null
    },
    enabled: !!candidateId,
  })
}

export function useWhatsAppMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['whatsapp-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return []

      const { data, error } = await supabase
        .from('whatsapp_messages' as any)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as unknown as WhatsAppMessage[]
    },
    enabled: !!conversationId,
    refetchInterval: 10000,
  })
}

export function useWhatsAppJobConversations(jobId: string | undefined) {
  return useQuery({
    queryKey: ['whatsapp-job-conversations', jobId],
    queryFn: async () => {
      if (!jobId) return []

      const { data, error } = await supabase
        .from('whatsapp_conversations' as any)
        .select(`
          *,
          candidates(id, candidate_name, contact_phone)
        `)
        .eq('job_id', jobId)
        .order('last_message_at', { ascending: false })

      if (error) throw error
      return (data || []) as unknown as (WhatsAppConversation & {
        candidates: { id: string; candidate_name: string; contact_phone: string | null } | null
      })[]
    },
    enabled: !!jobId,
  })
}

/**
 * Fetch all conversations for the current tenant (inbox view).
 * Includes candidate join for display names.
 */
export function useWhatsAppAllConversations() {
  return useQuery({
    queryKey: ['whatsapp-all-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_conversations' as any)
        .select(`
          *,
          candidates(id, candidate_name, contact_phone)
        `)
        .order('last_message_at', { ascending: false })

      if (error) throw error
      return (data || []) as unknown as (WhatsAppConversation & {
        candidates: { id: string; candidate_name: string; contact_phone: string | null } | null
      })[]
    },
  })
}

export function useMarkWhatsAppRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('whatsapp_conversations' as any)
        .update({ unread_count: 0 })
        .eq('id', conversationId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-job-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-all-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['pending-activities'] })
    },
  })
}

/**
 * Link/unlink/create candidate for a WhatsApp conversation
 * via the whatsapp-link-candidate edge function.
 */
export function useWhatsAppCandidateLinking() {
  const queryClient = useQueryClient()

  const linkMutation = useMutation({
    mutationFn: async (params: {
      action: 'link' | 'unlink' | 'create' | 'match'
      conversation_id?: string
      candidate_id?: string
      candidate_name?: string
      job_id?: string
      phone_number?: string
    }) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-link-candidate', {
        body: params,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-job-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-all-conversations'] })
    },
  })

  return {
    linkCandidate: (conversationId: string, candidateId: string, jobId?: string) =>
      linkMutation.mutateAsync({ action: 'link', conversation_id: conversationId, candidate_id: candidateId, job_id: jobId }),
    unlinkCandidate: (conversationId: string) =>
      linkMutation.mutateAsync({ action: 'unlink', conversation_id: conversationId }),
    createCandidate: (conversationId: string, candidateName: string) =>
      linkMutation.mutateAsync({ action: 'create', conversation_id: conversationId, candidate_name: candidateName }),
    findMatches: (phoneNumber: string) =>
      linkMutation.mutateAsync({ action: 'match', phone_number: phoneNumber }),
    isLoading: linkMutation.isPending,
  }
}
