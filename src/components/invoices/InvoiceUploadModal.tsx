
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, FileText } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { uploadInvoicePdf } from '@/lib/invoiceStorage'
import { supabase } from '@/integrations/supabase/client'
import type { Invoice } from '@/hooks/useInvoices'

interface InvoiceUploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice
  onUploadComplete: () => void
}

export function InvoiceUploadModal({ open, onOpenChange, invoice, onUploadComplete }: InvoiceUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast({
          title: 'Invalid file type',
          description: 'Please select a PDF file.',
          variant: 'destructive'
        })
        return
      }
      setFile(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    try {
      const { filePath } = await uploadInvoicePdf(invoice.organization_id, invoice.id, file)
      
      // Update the invoice record with the file name
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ 
          file_name: file.name,
          invoice_url: filePath 
        })
        .eq('id', invoice.id)

      if (updateError) {
        throw updateError
      }

      toast({
        title: 'Success',
        description: 'Invoice document uploaded successfully.'
      })

      onUploadComplete()
      onOpenChange(false)
      setFile(null)
    } catch (error) {
      console.error('Upload failed:', error)
      toast({
        title: 'Upload failed',
        description: 'Failed to upload invoice document. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Invoice Document
          </DialogTitle>
          <DialogDescription>
            Upload a PDF document for invoice: {invoice.title}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-md">
          <div>
            <Label htmlFor="invoice-file">PDF Document</Label>
            <Input
              id="invoice-file"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>
          
          {file && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{file.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading ? 'Uploading...' : 'Upload PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
