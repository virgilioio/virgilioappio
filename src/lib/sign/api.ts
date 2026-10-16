import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Database } from '@/integrations/supabase/types'

export type SignStatus = Database['public']['Enums']['sign_status']
export type SignKind = Database['public']['Enums']['sign_kind']

/** Envelope counts by status, for the Envelopes header. Admin drafts that were removed don't count. */
export function useEnvelopeCounts() {
  return useQuery({
    queryKey: ['sign', 'envelope-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sign_envelopes')
        .select('status')
        .is('deleted_at', null)
      if (error) throw error
      const counts = {} as Partial<Record<SignStatus, number>>
      for (const row of data ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1
      return { total: data?.length ?? 0, counts }
    },
    staleTime: 30_000,
  })
}

/** Template counts by app (Gio Sales or ATS), live templates only. */
export function useTemplateCounts() {
  return useQuery({
    queryKey: ['sign', 'template-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sign_templates')
        .select('app')
        .is('archived_at', null)
      if (error) throw error
      const sales = (data ?? []).filter((t) => t.app === 'sales').length
      return { total: data?.length ?? 0, sales, ats: (data?.length ?? 0) - sales }
    },
    staleTime: 30_000,
  })
}
