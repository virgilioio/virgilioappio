
import { supabase } from '@/integrations/supabase/client'

export const uploadInvoicePdf = async (orgId: string, invoiceId: string, file: File) => {
  console.log('=== uploadInvoicePdf via Edge Function ===')
  console.log('Uploading invoice PDF for org:', orgId, 'invoice:', invoiceId)
  console.log('File size:', file.size, 'bytes')
  console.log('File type:', file.type)
  
  // Check authentication status before upload
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.error('No active session found')
    throw new Error('Authentication required. Please log in again.')
  }
  
  console.log('Session valid, converting file to base64...')
  
  // Convert file to base64
  const fileBuffer = await file.arrayBuffer()
  const fileData = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)))
  
  console.log('File converted, calling edge function...')
  
  // Call the edge function
  const { data, error } = await supabase.functions.invoke('upload-invoice-document', {
    body: {
      orgId,
      invoiceId,
      fileName: file.name,
      fileData
    }
  })
  
  if (error) {
    console.error('Edge function error:', error)
    throw new Error(`Upload failed: ${error.message}`)
  }
  
  if (!data.success) {
    console.error('Edge function returned error:', data)
    throw new Error(`Upload failed: ${data.error || 'Unknown error'}`)
  }
  
  console.log('Upload completed successfully via edge function')
  return { filePath: data.filePath }
}

export const getInvoicePdfUrl = (filePath: string) => {
  return supabase.storage.from('invoices').getPublicUrl(filePath).data.publicUrl
}

export const deleteInvoicePdf = async (filePath: string) => {
  const { error } = await supabase.storage
    .from('invoices')
    .remove([filePath])
  
  if (error) {
    console.error('Delete error:', error)
    throw error
  }
}
