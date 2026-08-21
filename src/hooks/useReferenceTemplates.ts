import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { useToast } from '@/hooks/use-toast'
import {
  defaultCandidateEmail,
  defaultRefereeEmail,
  defaultReminders,
  newTemplateDraft,
  type ReferenceTemplate,
} from '@/lib/references/templateModel'

const TABLE = 'reference_templates' as const

/** Rows store jsonb — normalise into the typed model the UI works with. */
function hydrate(row: any): ReferenceTemplate {
  return {
    ...row,
    relationship_rules: Array.isArray(row.relationship_rules) ? row.relationship_rules : [],
    referee_fields: Array.isArray(row.referee_fields) ? row.referee_fields : [],
    questions: Array.isArray(row.questions) ? row.questions : [],
    candidate_email: row.candidate_email ?? defaultCandidateEmail(),
    referee_email: row.referee_email ?? defaultRefereeEmail(),
    reminders: row.reminders ?? defaultReminders(),
  }
}

export function useReferenceTemplates() {
  const { tenant } = useTenant()
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const tenantId = tenant?.id

  const query = useQuery({
    queryKey: ['reference-templates', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<ReferenceTemplate[]> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data || []).map(hydrate)
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['reference-templates', tenantId] })

  const createTemplate = useMutation({
    mutationFn: async (overrides?: Partial<ReferenceTemplate>) => {
      if (!tenantId) throw new Error('No tenant')
      const draft = { ...newTemplateDraft(tenantId), ...overrides }
      if (draft.privacy_notice_id === '') draft.privacy_notice_id = null
      const { data, error } = await supabase
        .from(TABLE)
        .insert({ ...(draft as any), updated_by: user?.id ?? null })
        .select('*')
        .single()
      if (error) throw error
      return hydrate(data)
    },
    onSuccess: () => invalidate(),
    onError: (e: any) =>
      toast({ title: 'Could not create template', description: e.message, variant: 'destructive' }),
  })

  const updateTemplate = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ReferenceTemplate> }) => {
      const { tenant_id, created_at, updated_at, times_used, ...rest } = patch as any
      const { data, error } = await supabase
        .from(TABLE)
        .update({ ...rest, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return hydrate(data)
    },
    onSuccess: () => invalidate(),
    onError: (e: any) =>
      toast({ title: 'Could not save template', description: e.message, variant: 'destructive' }),
  })

  const duplicateTemplate = useMutation({
    mutationFn: async (source: ReferenceTemplate) => {
      if (!tenantId) throw new Error('No tenant')
      const {
        id, created_at, updated_at, updated_by, times_used, ...rest
      } = source
      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          ...(rest as any),
          tenant_id: tenantId,
          name: `${source.name} (copy)`,
          is_live: false,
          updated_by: user?.id ?? null,
        })
        .select('*')
        .single()
      if (error) throw error
      return hydrate(data)
    },
    onSuccess: () => invalidate(),
    onError: (e: any) =>
      toast({ title: 'Could not duplicate template', description: e.message, variant: 'destructive' }),
  })

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    tenantId,
    createTemplate,
    updateTemplate,
    duplicateTemplate,
  }
}

export function useReferenceTemplate(id: string | null) {
  const { templates, isLoading } = useReferenceTemplates()
  return { template: templates.find((t) => t.id === id) ?? null, isLoading }
}
