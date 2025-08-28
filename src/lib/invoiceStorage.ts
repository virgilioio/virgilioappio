
import { supabase } from '@/integrations/supabase/client'

export const uploadInvoicePdf = async (orgId: string, invoiceId: string, file: File) => {
  const filePath = `${orgId}/${invoiceId}.pdf`
  
  console.log('=== uploadInvoicePdf ===')
  console.log('Uploading invoice PDF:', filePath)
  console.log('File size:', file.size, 'bytes')
  console.log('File type:', file.type)
  
  // Check authentication status before upload
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.error('No active session found')
    throw new Error('Authentication required. Please log in again.')
  }
  
  console.log('Session valid, proceeding with upload...')
  
  const { error } = await supabase.storage
    .from('invoices')
    .upload(filePath, file, {
      upsert: true,
      contentType: 'application/pdf',
    })
  
  if (error) {
    console.error('Storage upload error:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    throw error
  }
  
  console.log('Upload completed successfully')
  return { filePath }
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
