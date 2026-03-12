import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

export interface WhatsAppConversation {
  id: string
  tenant_id: string
  candidate_id: string
  job_id: string | null
  phone_number: string
  last_message_at: string
  last_message_preview: string | null
  unread_count: number
  created_at: string
}

export interface WhatsAppMessage {
  id: string
  conversation_id: string
  tenant_id: string
  candidate_id: string
  job_id: string | null
  sender_id: string | null
  to_phone: string
  from_phone: string
  body: string
  twilio_sid: string | null
  status: string
  direction: string
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
      } else {
        query = query.is('job_id', null)
      }

      const { data, error } = await query.maybeSingle()
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
    refetchInterval: 10000, // Poll every 10s for new messages
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
        candidates: { id: string; candidate_name: string; contact_phone: string | null }
      })[]
    },
    enabled: !!jobId,
  })
}

export function useSendWhatsAppMessage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      to: string
      body: string
      candidate_id: string
      job_id?: string
    }) => {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: params,
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation', variables.candidate_id] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-job-conversations'] })
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
      queryClient.invalidateQueries({ queryKey: ['pending-activities'] })
    },
  })
}
