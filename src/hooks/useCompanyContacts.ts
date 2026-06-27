import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'

export interface CompanyContact {
  id: string
  company_id: string
  full_name: string
  role_title: string | null
  email: string
  phone: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface CompanyContactInput {
  full_name: string
  role_title?: string | null
  email: string
  phone?: string | null
  is_primary?: boolean
}

const QK = (companyId?: string | null) => ['company_contacts', companyId ?? 'none']

export function useCompanyContacts(companyId?: string | null) {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: QK(companyId),
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_contacts' as any)
        .select('*')
        .eq('company_id', companyId!)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as CompanyContact[]
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: QK(companyId) })

  const addContact = useMutation({
    mutationFn: async (input: CompanyContactInput & { company_id: string }) => {
      const { data: u } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('company_contacts' as any)
        .insert({
          company_id: input.company_id,
          full_name: input.full_name.trim(),
          role_title: input.role_title?.trim() || null,
          email: input.email.trim().toLowerCase(),
          phone: input.phone?.trim() || null,
          is_primary: !!input.is_primary,
          created_by: u.user?.id ?? null,
          tenant_id: null as any, // populated by trigger
        } as any)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidate()
      toast({ title: 'Contact added' })
    },
    onError: (e: any) => toast({ title: 'Could not add contact', description: e?.message, variant: 'destructive' }),
  })

  const updateContact = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CompanyContactInput> & { id: string }) => {
      const update: Record<string, any> = {}
      if (patch.full_name !== undefined) update.full_name = patch.full_name.trim()
      if (patch.role_title !== undefined) update.role_title = patch.role_title?.trim() || null
      if (patch.email !== undefined) update.email = patch.email.trim().toLowerCase()
      if (patch.phone !== undefined) update.phone = patch.phone?.trim() || null
      if (patch.is_primary !== undefined) update.is_primary = patch.is_primary
      const { data, error } = await supabase
        .from('company_contacts' as any)
        .update(update)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidate()
    },
    onError: (e: any) => toast({ title: 'Could not update contact', description: e?.message, variant: 'destructive' }),
  })

  const setPrimary = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('company_contacts' as any)
        .update({ is_primary: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast({ title: 'Primary contact updated' })
    },
  })

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('company_contacts' as any).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast({ title: 'Contact removed' })
    },
  })

  return {
    contacts: query.data ?? [],
    isLoading: query.isLoading,
    addContact,
    updateContact,
    setPrimary,
    deleteContact,
    refetch: query.refetch,
  }
}
