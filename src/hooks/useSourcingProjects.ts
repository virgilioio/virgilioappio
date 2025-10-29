import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { SourcingProject } from '@/types/sourcing'

export function useSourcingProjects() {
  return useQuery({
    queryKey: ['sourcing-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sourcing_projects')
        .select('*, jobs(id, title, status, organization_id)')
        .order('updated_at', { ascending: false })

      if (error) throw error
      return data as unknown as SourcingProject[]
    }
  })
}
