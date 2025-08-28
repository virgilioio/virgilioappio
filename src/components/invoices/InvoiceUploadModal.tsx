
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, FileText, AlertTriangle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { uploadInvoicePdf } from '@/lib/invoiceStorage'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
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
  const { user, session, userType, memberRole, isAuthenticated } = useAuth()

  // Authentication check with detailed logging
  const checkAuthentication = async () => {
    console.log('=== Authentication Check ===')
    console.log('User:', user?.id)
    console.log('Session:', !!session)
    console.log('User Type:', userType)
    console.log('Member Role:', memberRole)
    console.log('Is Authenticated:', isAuthenticated)
    
    if (!user || !session) {
      console.error('User not authenticated - missing user or session')
      return false
    }
    
    if (!userType || userType === 'guest') {
      console.error('User type not properly set:', userType)
      return false
    }
    
    // Check if user has permission to upload invoices
    const canUpload = userType === 'platform_admin' || 
                     (userType === 'workspace_owner' && memberRole === 'admin') ||
                     (memberRole === 'admin')
    
    console.log('Can upload:', canUpload)
    return canUpload
  }

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

    // Pre-upload authentication check
    const isAuthValid = await checkAuthentication()
    if (!isAuthValid) {
      toast({
        title: 'Authentication Error',
        description: 'You are not properly authenticated. Please log out and log back in.',
        variant: 'destructive'
      })
      return
    }

    setIsUploading(true)
    try {
      console.log('=== Starting Upload ===')
      console.log('File:', file.name, 'Size:', file.size)
      console.log('Invoice ID:', invoice.id)
      console.log('Organization ID:', invoice.organization_id)
      
      // Validate session before upload
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        throw new Error('Session expired. Please log in again.')
      }
      
      const { filePath } = await uploadInvoicePdf(invoice.organization_id, invoice.id, file)
      console.log('Upload successful via edge function, file path:', filePath)
      toast({
        title: 'Success',
        description: 'Invoice document uploaded successfully.'
      })

      onUploadComplete()
      onOpenChange(false)
      setFile(null)
    } catch (error: any) {
      console.error('=== Upload Error ===')
      console.error('Error type:', typeof error)
      console.error('Error:', error)
      console.error('Error message:', error?.message)
      console.error('Error details:', error?.details)
      
      // Check if error is HTML (indicating auth/permission issue)
      const errorMessage = error?.message || String(error)
      const isHtmlError = errorMessage.includes('<html>') || errorMessage.includes('<!DOCTYPE')
      const isAuthError = errorMessage.includes('JWT') || 
                         errorMessage.includes('unauthorized') || 
                         errorMessage.includes('authentication') ||
                         isHtmlError
      
      if (isAuthError) {
        toast({
          title: 'Authentication Error',
          description: 'Authentication failed. Please log out and log back in to refresh your session.',
          variant: 'destructive'
        })
      } else if (errorMessage.includes('Session expired')) {
        toast({
          title: 'Session Expired',
          description: 'Your session has expired. Please log in again.',
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Upload failed',
          description: `Failed to upload invoice document: ${errorMessage}`,
          variant: 'destructive'
        })
      }
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
          {(!isAuthenticated || !userType || userType === 'guest') && (
            <div className="flex items-center gap-2 p-2 text-sm text-destructive bg-destructive/10 rounded-md">
              <AlertTriangle className="h-4 w-4" />
              Authentication issue detected. Please refresh your session.
            </div>
          )}
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
          <Button 
            onClick={handleUpload} 
            disabled={!file || isUploading || !isAuthenticated || !userType || userType === 'guest'}
          >
            {isUploading ? 'Uploading...' : 'Upload PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
