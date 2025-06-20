import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { detectOverdueInvoices } from '@/utils/invoiceUtils'

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
  // New payment tracking fields
  paid_at?: string
  payment_method?: string
  payment_reference?: string
  payment_notes?: string
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

export interface PaymentData {
  paid_at: string
  payment_method: string
  payment_reference?: string
  payment_notes?: string
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user, organizationId, userType } = useAuth()

  const getInvoices = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('=== INVOICE FETCH DEBUG ===')
      console.log('Fetching invoices for user:', user.id, 'userType:', userType, 'organizationId:', organizationId)
      
      let query = supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })

      // Filter invoices based on user type and organization context
      if (userType === 'platform_admin') {
        // Platform admins can see all invoices (they manage/send invoices)
        console.log('Platform admin - fetching all invoices')
      } else if (organizationId) {
        // Workspace owners and other members see invoices for their organization
        // These are invoices they need to pay (where their org is the recipient)
        console.log('Filtering invoices for organization:', organizationId)
        query = query.eq('organization_id', organizationId)
      } else {
        // Users without organization context see no invoices
        console.log('No organization context - no invoices')
        setInvoices([])
        setIsLoading(false)
        return
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        console.error('Error fetching invoices:', fetchError)
        throw fetchError
      }

      console.log('=== RAW INVOICE DATA ===')
      console.log('Total invoices fetched:', data?.length || 0)
      console.log('Sample invoice data:', data?.[0])
      console.log('All invoices:', data)
      
      // Auto-detect and update overdue invoices
      const processedInvoices = detectOverdueInvoices((data || []) as Invoice[])
      console.log('=== OVERDUE DETECTION ===')
      console.log('Invoices after overdue detection:', processedInvoices.length)
      
      // Find invoices that were auto-updated to overdue status
      const autoUpdatedOverdue = processedInvoices.filter((processed, index) => {
        const original = data?.[index]
        return original?.status === 'pending' && processed.status === 'overdue'
      })
      
      if (autoUpdatedOverdue.length > 0) {
        console.log('Auto-updating overdue invoices in database:', autoUpdatedOverdue.length)
        
        // Update overdue invoices in the database
        for (const invoice of autoUpdatedOverdue) {
          try {
            await supabase
              .from('invoices')
              .update({ 
                status: 'overdue',
                updated_at: new Date().toISOString()
              })
              .eq('id', invoice.id)
            
            console.log(`Updated invoice ${invoice.id} to overdue status`)
          } catch (updateError) {
            console.error(`Failed to update invoice ${invoice.id}:`, updateError)
          }
        }
      }
      
      // Additional debug logging for workspace owners
      if (userType !== 'platform_admin' && organizationId) {
        const relevantInvoices = processedInvoices.filter(invoice => invoice.organization_id === organizationId)
        console.log('=== WORKSPACE OWNER DEBUG ===')
        console.log('Organization ID:', organizationId)
        console.log('Filtered invoices for org:', relevantInvoices.length)
        console.log('Filtered invoice details:', relevantInvoices)
        
        const pendingInvoices = relevantInvoices.filter(inv => inv.status === 'pending')
        const overdueInvoices = relevantInvoices.filter(inv => inv.status === 'overdue')
        const totalPending = pendingInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
        const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
        
        console.log('Pending invoices:', pendingInvoices.length, 'Total amount:', totalPending)
        console.log('Overdue invoices:', overdueInvoices.length, 'Total amount:', totalOverdue)
      }

      setInvoices(processedInvoices)
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

  const updateInvoice = async (invoiceId: string, data: Partial<CreateInvoiceData & { status: 'pending' | 'paid' | 'overdue' }>): Promise<Invoice> => {
    if (!user) throw new Error('User not authenticated')

    try {
      console.log('Updating invoice:', invoiceId, data)
      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      }

      const { data: invoice, error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId)
        .select()
        .single()

      if (error) {
        console.error('Error updating invoice:', error)
        throw error
      }

      console.log('Updated invoice:', invoice)
      await getInvoices() // Refresh the list
      
      toast({
        title: 'Success',
        description: 'Invoice updated successfully'
      })

      return invoice as Invoice
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update invoice'
      console.error('Update invoice error:', err)
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

  const markInvoiceAsPaid = async (invoiceId: string, paymentData: PaymentData): Promise<void> => {
    if (!user) throw new Error('User not authenticated')

    try {
      console.log('Marking invoice as paid:', invoiceId, paymentData)
      const { error } = await supabase
        .from('invoices')
        .update({ 
          status: 'paid',
          paid_at: paymentData.paid_at,
          payment_method: paymentData.payment_method,
          payment_reference: paymentData.payment_reference || null,
          payment_notes: paymentData.payment_notes || null,
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

  const updateInvoiceStatus = async (invoiceId: string, status: 'pending' | 'paid' | 'overdue'): Promise<void> => {
    if (!user) throw new Error('User not authenticated')

    try {
      console.log('Updating invoice status:', invoiceId, status)
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      }

      // If marking as not paid, clear payment fields
      if (status !== 'paid') {
        updateData.paid_at = null
        updateData.payment_method = null
        updateData.payment_reference = null
        updateData.payment_notes = null
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId)

      if (error) {
        console.error('Error updating invoice status:', error)
        throw error
      }

      await getInvoices() // Refresh the list
      
      toast({
        title: 'Success',
        description: `Invoice status updated to ${status}`
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update invoice status'
      console.error('Update status error:', err)
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
  }, [user, organizationId, userType])

  return {
    invoices,
    isLoading,
    error,
    getInvoices,
    createInvoice,
    updateInvoice,
    uploadInvoicePDF,
    markInvoiceAsPaid,
    updateInvoiceStatus,
    deleteInvoice,
    refreshInvoices
  }
}
