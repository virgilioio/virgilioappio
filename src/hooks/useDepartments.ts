import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface Department {
  id: string
  name: string
  description?: string
  organization_id: string
  created_by?: string
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface CreateDepartmentData {
  name: string
  description?: string
  organization_id: string
}

export interface UpdateDepartmentData {
  name?: string
  description?: string
  is_active?: boolean
}

export function useDepartments(organizationId?: string) {
  return useQuery({
    queryKey: ['departments', organizationId],
    queryFn: async () => {
      let query = supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Department[]
    },
  })
}

export function useCreateDepartment() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (data: CreateDepartmentData) => {
      const { data: result, error } = await supabase
        .from('departments')
        .insert([{
          ...data,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single()

      if (error) throw error
      return result as Department
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast({
        title: 'Success',
        description: 'Department created successfully',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create department',
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateDepartmentData }) => {
      const { data: result, error } = await supabase
        .from('departments')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return result as Department
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast({
        title: 'Success',
        description: 'Department updated successfully',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update department',
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('departments')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast({
        title: 'Success',
        description: 'Department deleted successfully',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete department',
        variant: 'destructive',
      })
    },
  })
}