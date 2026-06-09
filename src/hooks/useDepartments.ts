import { useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface Department {
  id: string
  tenant_id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  is_archived: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'department'
}

async function resolveTenantId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('members')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('user_status', 'active')
    .maybeSingle()
  return data?.tenant_id ?? null
}

/**
 * Lists departments for the current workspace tenant.
 * Returns active (non-archived) departments by default.
 */
export function useDepartments(opts: { includeArchived?: boolean } = {}) {
  const { user, organizationId } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['departments', organizationId, !!opts.includeArchived],
    queryFn: async (): Promise<Department[]> => {
      if (!user) return []
      const tenantId = await resolveTenantId(user.id)
      if (!tenantId) return []
      let q = supabase
        .from('departments')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('is_system', { ascending: false })
        .order('name', { ascending: true })
      if (!opts.includeArchived) q = q.eq('is_archived', false)
      const { data, error } = await q
      if (error) throw error
      return (data || []) as Department[]
    },
    enabled: !!user,
    staleTime: 60_000,
  })

  const createDepartment = useMutation({
    mutationFn: async (input: { name: string; description?: string | null; color?: string | null }) => {
      if (!user) throw new Error('Not authenticated')
      const tenantId = await resolveTenantId(user.id)
      if (!tenantId) throw new Error('No tenant context')
      const name = input.name.trim()
      if (!name) throw new Error('Name is required')
      const { data, error } = await supabase
        .from('departments')
        .insert({
          tenant_id: tenantId,
          name,
          slug: slugify(name),
          description: input.description ?? null,
          color: input.color ?? null,
          created_by: user.id,
        })
        .select()
        .single()
      if (error) throw error
      return data as Department
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast({ title: 'Department created' })
    },
    onError: (err: any) => {
      toast({ title: 'Failed to create department', description: err.message, variant: 'destructive' })
    },
  })

  const updateDepartment = useMutation({
    mutationFn: async (input: { id: string; name?: string; description?: string | null; color?: string | null; is_archived?: boolean }) => {
      const patch: Record<string, any> = {}
      if (input.name !== undefined) {
        patch.name = input.name.trim()
        patch.slug = slugify(input.name)
      }
      if (input.description !== undefined) patch.description = input.description
      if (input.color !== undefined) patch.color = input.color
      if (input.is_archived !== undefined) patch.is_archived = input.is_archived
      const { data, error } = await supabase
        .from('departments')
        .update(patch)
        .eq('id', input.id)
        .select()
        .single()
      if (error) throw error
      return data as Department
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast({ title: 'Department updated' })
    },
    onError: (err: any) => {
      toast({ title: 'Failed to update department', description: err.message, variant: 'destructive' })
    },
  })

  const deleteDepartment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('departments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast({ title: 'Department deleted' })
    },
    onError: (err: any) => {
      toast({ title: 'Failed to delete department', description: err.message, variant: 'destructive' })
    },
  })

  const getDefault = useCallback((): Department | undefined => {
    return (query.data || []).find((d) => d.is_system)
  }, [query.data])

  return {
    departments: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    getDefault,
    createDepartment,
    updateDepartment,
    deleteDepartment,
  }
}
