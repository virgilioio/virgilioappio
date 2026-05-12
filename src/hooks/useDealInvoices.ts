import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface DealInvoice {
  id: string
  deal_id: string
  tenant_id: string
  uploaded_by: string | null
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  created_at: string
}

async function getTenantId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('members')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('user_status', 'active')
    .maybeSingle()
  return data?.tenant_id ?? null
}

export function useDealInvoices(dealId: string | null | undefined) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const list = useQuery({
    queryKey: ['deal-invoices', dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<DealInvoice[]> => {
      const { data, error } = await supabase
        .from('deal_invoices')
        .select('*')
        .eq('deal_id', dealId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as DealInvoice[]
    },
  })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id || !dealId) throw new Error('Missing context')
      const tenant_id = await getTenantId(user.id)
      if (!tenant_id) throw new Error('No workspace')
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${tenant_id}/${dealId}/${Date.now()}-${safeName}`
      const up = await supabase.storage.from('deal-invoices').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })
      if (up.error) throw up.error
      const { error } = await supabase.from('deal_invoices').insert({
        deal_id: dealId,
        tenant_id,
        uploaded_by: user.id,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
      })
      if (error) {
        await supabase.storage.from('deal-invoices').remove([path])
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-invoices', dealId] })
      toast({ title: 'File uploaded' })
    },
    onError: (e: any) => toast({ title: 'Upload failed', description: e.message, variant: 'destructive' }),
  })

  const remove = useMutation({
    mutationFn: async (invoice: DealInvoice) => {
      await supabase.storage.from('deal-invoices').remove([invoice.file_path])
      const { error } = await supabase.from('deal_invoices').delete().eq('id', invoice.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-invoices', dealId] })
      queryClient.invalidateQueries({ queryKey: ['deal-payments', dealId] })
    },
    onError: (e: any) => toast({ title: 'Could not delete', description: e.message, variant: 'destructive' }),
  })

  const getDownloadUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage.from('deal-invoices').createSignedUrl(path, 60)
    if (error) return null
    return data?.signedUrl ?? null
  }

  return { ...list, upload, remove, getDownloadUrl }
}
