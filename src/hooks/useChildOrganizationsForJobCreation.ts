import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export interface ChildOrgOption {
  id: string
  name: string
}

/** Gio ATS is used by Virgilio only; its clients are mirrored from Gio Sales. */
export const VIRGILIO_TENANT_ID = '5ba7b145-f251-4b18-8900-724cb06028ab'
export const GIO_SALES_COMPANIES_URL = 'https://sales.gogio.io/companies'

/**
 * Clients selectable for a job: active clients mirrored from Gio Sales, plus
 * the internal client (Virgilio's own hiring). `currentId` (the job's current
 * client) always stays selectable even if it no longer matches.
 */
export function useChildOrganizationsForJobCreation(currentId?: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['child-orgs-for-job-creation', currentId ?? null],
    queryFn: async (): Promise<ChildOrgOption[]> => {
      if (!user) return []
      const { data, error } = await (supabase as any)
        .from('organizations')
        .select('id, name')
        .eq('tenant_id', VIRGILIO_TENANT_ID)
        .eq('org_kind', 'client')
        .or('and(sales_company_id.not.is.null,status.eq.active),is_internal.eq.true')
        .order('name')
      if (error) throw error
      const rows: ChildOrgOption[] = data ?? []
      if (currentId && !rows.some((r) => r.id === currentId)) {
        const { data: cur } = await supabase.from('organizations').select('id, name').eq('id', currentId).maybeSingle()
        if (cur) rows.push(cur as ChildOrgOption)
      }
      return rows
    },
    enabled: !!user,
  })
}
