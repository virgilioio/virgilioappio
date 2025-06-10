
import { supabase } from '@/integrations/supabase/client'

export const uploadInvoicePdf = async (orgId: string, invoiceId: string, file: File) => {
  const filePath = `${orgId}/${invoiceId}.pdf`
  
  console.log('Uploading invoice PDF:', filePath)
  
  const { error } = await supabase.storage
    .from('invoices')
    .upload(filePath, file, {
      upsert: true,
      contentType: 'application/pdf',
    })
  
  if (error) {
    console.error('Upload error:', error)
    throw error
  }
  
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
