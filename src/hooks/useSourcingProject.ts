import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { SourcingProject } from '@/types/sourcing'

export function useSourcingProject(projectId: string) {
  return useQuery({
    queryKey: ['sourcing-project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sourcing_projects')
        .select('*, jobs(id, title, status, organization_id)')
        .eq('id', projectId)
        .single()

      if (error) throw error
      return data as unknown as SourcingProject
    },
    enabled: !!projectId
  })
}
