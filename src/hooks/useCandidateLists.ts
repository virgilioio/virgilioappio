import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export type ListAccess = 'view' | 'comment' | 'comment_score'

export interface ReviewerDraft {
  user_id?: string | null
  invited_email?: string | null
  access: ListAccess
  notify_enabled: boolean
}

export interface CreateCandidateListInput {
  name: string
  description?: string
  expires_at?: string | null
  block_screenshots?: boolean
  notify_on_activity?: boolean
  candidate_ids: string[]
  reviewers: ReviewerDraft[]
  message?: string
}

async function getTenantId(organizationId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('tenant_id')
    .eq('id', organizationId)
    .maybeSingle()
  if (error || !data?.tenant_id) return null
  return data.tenant_id
}

export function useCreateCandidateList() {
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (input: CreateCandidateListInput) => {
      if (!organizationId) throw new Error('No organization context')
      const tenantId = await getTenantId(organizationId)
      if (!tenantId) throw new Error('Tenant not found')

      const { data, error } = await supabase.rpc('create_candidate_list_with_reviewers', {
        p_tenant_id: tenantId,
        p_name: input.name,
        p_description: input.description ?? null,
        p_expires_at: input.expires_at ?? null,
        p_block_screenshots: input.block_screenshots ?? false,
        p_notify_on_activity: input.notify_on_activity ?? true,
        p_candidate_ids: input.candidate_ids,
        p_reviewers: input.reviewers as any,
        p_message: input.message ?? null,
      })
      if (error) throw error
      return data as string
    },
  })
}

export function useCandidateList(listId: string | undefined) {
  return useQuery({
    queryKey: ['candidate-list', listId],
    enabled: !!listId,
    queryFn: async () => {
      if (!listId) return null
      const { data: list, error } = await supabase
        .from('candidate_lists')
        .select('*')
        .eq('id', listId)
        .maybeSingle()
      if (error) throw error
      if (!list) return null
      const [{ data: items }, { data: reviewers }, { data: messages }] = await Promise.all([
        supabase.from('candidate_list_items').select('*, candidates(id, candidate_name, candidate_email, current_company, current_role, photo_url)').eq('list_id', listId),
        supabase.from('candidate_list_reviewers').select('*').eq('list_id', listId),
        supabase.from('candidate_list_messages').select('*').eq('list_id', listId).order('sent_at', { ascending: true }),
      ])
      return { list, items: items ?? [], reviewers: reviewers ?? [], messages: messages ?? [] }
    },
  })
}

export function useTenantMembersForShare() {
  const { user, organizationId } = useAuth()
  return useQuery({
    queryKey: ['tenant-members-share', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      if (!organizationId) return []
      const tenantId = await getTenantId(organizationId)
      if (!tenantId) return []
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id')
        .eq('tenant_id', tenantId)
      const orgIds = (orgs ?? []).map(o => o.id)
      if (orgIds.length === 0) return []
      const { data: members } = await supabase
        .from('members')
        .select('user_id, system_role, user_status')
        .in('organization_id', orgIds)
        .eq('user_status', 'active')
      const userIds = Array.from(new Set((members ?? []).map(m => m.user_id))).filter(id => id !== user?.id)
      if (userIds.length === 0) return []
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, avatar_url')
        .in('user_id', userIds)
      return (profiles ?? []).map(p => ({
        user_id: p.user_id,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unknown',
        email: p.email ?? '',
        avatar_url: p.avatar_url ?? null,
        role: members?.find(m => m.user_id === p.user_id)?.system_role ?? null,
      }))
    },
  })
}
