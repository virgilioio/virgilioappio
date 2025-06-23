
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useUserProfile } from './useUserProfile'
import { useActivityLogger } from './useActivityLogger'
import type { Database } from '@/integrations/supabase/types'

export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']
export type InvoiceUpdate = Database['public']['Tables']['invoices']['Update']

export type CreateInvoiceData = Omit<InvoiceInsert, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'organization_id'>

export type PaymentData = {
  payment_method?: string
  payment_reference?: string
  payment_notes?: string
}

export function useInvoices() {
  const { profile } = useUserProfile()

  const query = useQuery({
    queryKey: ['invoices', profile?.organization_id],
    queryFn: async () => {
      console.log('Fetching invoices for organization:', profile?.organization_id)
      
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching invoices:', error)
        throw error
      }

      console.log('Fetched invoices:', data)
      return data as Invoice[]
    },
    enabled: !!profile?.organization_id,
  })

  return {
    invoices: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    refreshInvoices: query.refetch,
  }
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { profile } = useUserProfile()
  const { logInvoiceCreated } = useActivityLogger()

  return useMutation({
    mutationFn: async (invoiceData: CreateInvoiceData) => {
      console.log('Creating invoice:', invoiceData)
      
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          ...invoiceData,
          created_by: profile?.user_id,
          organization_id: profile?.organization_id,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating invoice:', error)
        throw error
      }

      console.log('Created invoice:', data)
      
      // Log activity
      logInvoiceCreated(data.title, Number(data.amount), data.id)
      
      return data as Invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast({
        title: 'Success',
        description: 'Invoice created successfully',
      })
    },
    onError: (error) => {
      console.error('Error creating invoice:', error)
      toast({
        title: 'Error',
        description: 'Failed to create invoice',
        variant: 'destructive',
      })
    },
  })
}

export function useMarkInvoicePaid() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { logInvoicePaid } = useActivityLogger()

  return useMutation({
    mutationFn: async ({ invoiceId, paymentData }: { invoiceId: string; paymentData?: PaymentData }) => {
      console.log('Marking invoice as paid:', invoiceId)
      
      const updateData = {
        status: 'paid' as const,
        paid_at: new Date().toISOString(),
        ...paymentData,
      }

      const { data, error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId)
        .select()
        .single()

      if (error) {
        console.error('Error marking invoice as paid:', error)
        throw error
      }

      console.log('Marked invoice as paid:', data)
      
      // Log activity
      logInvoicePaid(data.title, Number(data.amount), data.id)
      
      return data as Invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast({
        title: 'Success',
        description: 'Invoice marked as paid',
      })
    },
    onError: (error) => {
      console.error('Error marking invoice as paid:', error)
      toast({
        title: 'Error',
        description: 'Failed to mark invoice as paid',
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (invoiceId: string, invoiceData: Partial<InvoiceUpdate>) => {
      console.log('Updating invoice:', invoiceId, invoiceData)
      
      const { data, error } = await supabase
        .from('invoices')
        .update(invoiceData)
        .eq('id', invoiceId)
        .select()
        .single()

      if (error) {
        console.error('Error updating invoice:', error)
        throw error
      }

      console.log('Updated invoice:', data)
      return data as Invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast({
        title: 'Success',
        description: 'Invoice updated successfully',
      })
    },
    onError: (error) => {
      console.error('Error updating invoice:', error)
      toast({
        title: 'Error',
        description: 'Failed to update invoice',
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      console.log('Deleting invoice:', invoiceId)
      
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId)

      if (error) {
        console.error('Error deleting invoice:', error)
        throw error
      }

      console.log('Deleted invoice:', invoiceId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast({
        title: 'Success',
        description: 'Invoice deleted successfully',
      })
    },
    onError: (error) => {
      console.error('Error deleting invoice:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete invoice',
        variant: 'destructive',
      })
    },
  })
}
