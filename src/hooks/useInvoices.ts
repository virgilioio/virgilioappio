
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface Invoice {
  id: string
  organization_id: string
  title: string
  description?: string
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'overdue'
  invoice_url?: string
  issued_at: string
  due_date?: string
  created_at: string
  updated_at: string
  created_by?: string
  file_name?: string
}

export interface CreateInvoiceData {
  organization_id: string
  title: string
  description?: string
  amount: number
  currency: string
  due_date?: string
  issued_at?: string
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getInvoices = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching invoices for user:', user.id)
      const { data, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching invoices:', fetchError)
        throw fetchError
      }

      console.log('Fetched invoices:', data)
      setInvoices((data || []) as Invoice[])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch invoices'
      console.error('Invoices fetch error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createInvoice = async (data: CreateInvoiceData): Promise<Invoice> => {
    if (!user) throw new Error('User not authenticated')

    try {
      console.log('Creating invoice:', data)
      const invoiceData = {
        ...data,
        created_by: user.id,
        status: 'pending' as const,
        issued_at: data.issued_at || new Date().toISOString(),
      }

      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single()

      if (error) {
        console.error('Error creating invoice:', error)
        throw error
      }

      console.log('Created invoice:', invoice)
      await getInvoices() // Refresh the list
      
      toast({
        title: 'Success',
        description: 'Invoice created successfully'
      })

      return invoice as Invoice
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create invoice'
      console.error('Create invoice error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    }
  }

  const uploadInvoicePDF = async (invoiceId: string, organizationId: string, file: File): Promise<string> => {
    if (!user) throw new Error('User not authenticated')

    // Validate file
    if (file.type !== 'application/pdf') {
      throw new Error('Only PDF files are allowed')
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('File size must be less than 10MB')
    }

    try {
      console.log('Uploading PDF for invoice:', invoiceId)
      const filePath = `${organizationId}/${invoiceId}.pdf`
      
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, file, {
          upsert: true,
          contentType: 'application/pdf',
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }

      // Update invoice with file path and name
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ 
          invoice_url: filePath, 
          file_name: file.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId)

      if (updateError) {
        console.error('Error updating invoice:', updateError)
        throw updateError
      }

      // Get public URL
      const { data } = supabase.storage
        .from('invoices')
        .getPublicUrl(filePath)

      await getInvoices() // Refresh the list
      
      toast({
        title: 'Success',
        description: 'PDF uploaded successfully'
      })

      return data.publicUrl
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload PDF'
      console.error('Upload PDF error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    }
  }

  const markInvoiceAsPaid = async (invoiceId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated')

    try {
      console.log('Marking invoice as paid:', invoiceId)
      const { error } = await supabase
        .from('invoices')
        .update({ 
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId)

      if (error) {
        console.error('Error updating invoice status:', error)
        throw error
      }

      await getInvoices() // Refresh the list
      
      toast({
        title: 'Success',
        description: 'Invoice marked as paid'
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update invoice status'
      console.error('Mark as paid error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    }
  }

  const deleteInvoice = async (invoiceId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated')

    try {
      console.log('Deleting invoice:', invoiceId)
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId)

      if (error) {
        console.error('Error deleting invoice:', error)
        throw error
      }

      await getInvoices() // Refresh the list
      
      toast({
        title: 'Success',
        description: 'Invoice deleted successfully'
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete invoice'
      console.error('Delete invoice error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    }
  }

  const refreshInvoices = () => {
    getInvoices()
  }

  useEffect(() => {
    if (user) {
      getInvoices()
    }
  }, [user])

  return {
    invoices,
    isLoading,
    error,
    getInvoices,
    createInvoice,
    uploadInvoicePDF,
    markInvoiceAsPaid,
    deleteInvoice,
    refreshInvoices
  }
}
