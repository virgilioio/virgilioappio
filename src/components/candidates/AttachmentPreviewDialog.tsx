
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

interface AttachmentPreviewDialogProps {
  attachment: {
    id: string
    file_name: string
    file_url: string
    file_type: string | null
    file_size_bytes: number | null
  } | null
  isOpen: boolean
  onClose: () => void
  onDownload: (fileUrl: string, fileName: string) => void
}

export function AttachmentPreviewDialog({ 
  attachment, 
  isOpen, 
  onClose, 
  onDownload 
}: AttachmentPreviewDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPreview = async () => {
    if (!attachment) return

    console.log('Loading preview for attachment:', attachment)
    setIsLoading(true)
    setError(null)

    try {
      console.log('Attempting to download file from storage:', attachment.file_url)
      
      const { data, error: downloadError } = await supabase.storage
        .from('candidate-attachments')
        .download(attachment.file_url)

      if (downloadError) {
        console.error('Storage download error:', downloadError)
        setError('Failed to load preview: ' + downloadError.message)
        return
      }

      console.log('File downloaded successfully, creating preview URL')
      const url = URL.createObjectURL(data)
      setPreviewUrl(url)
    } catch (err) {
      console.error('Preview error:', err)
      setError('Failed to load preview: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      setError(null)
    } else if (attachment && !previewUrl && !isLoading) {
      loadPreview()
    }
  }

  const canPreview = (fileType: string | null) => {
    if (!fileType) return false
    return (
      fileType.includes('pdf') ||
      fileType.includes('image') ||
      fileType.includes('text')
    )
  }

  const renderPreview = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading preview...</p>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button 
              onClick={() => attachment && onDownload(attachment.file_url, attachment.file_name)}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download to view
            </Button>
          </div>
        </div>
      )
    }

    if (!attachment || !previewUrl) return null

    const fileType = attachment.file_type

    if (fileType?.includes('pdf')) {
      return (
        <div className="h-96 w-full">
          <iframe
            src={previewUrl}
            className="w-full h-full border-0 rounded"
            title={`Preview of ${attachment.file_name}`}
            allow="fullscreen; clipboard-read; clipboard-write"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      )
    }

    if (fileType?.includes('image')) {
      return (
        <div className="flex justify-center">
          <img
            src={previewUrl}
            alt={attachment.file_name}
            className="max-h-96 max-w-full object-contain rounded"
          />
        </div>
      )
    }

    if (fileType?.includes('text')) {
      return (
        <div className="h-96 w-full">
          <iframe
            src={previewUrl}
            className="w-full h-full border border-border rounded"
            title={`Preview of ${attachment.file_name}`}
          />
        </div>
      )
    }

    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Preview not available for this file type
          </p>
          <Button 
            onClick={() => onDownload(attachment.file_url, attachment.file_name)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download to view
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate mr-4">{attachment?.file_name}</span>
            <div className="flex items-center gap-2">
              {attachment && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownload(attachment.file_url, attachment.file_name)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-auto">
          {attachment && canPreview(attachment.file_type) ? (
            renderPreview()
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Preview not available for this file type
                </p>
                {attachment && (
                  <Button 
                    onClick={() => onDownload(attachment.file_url, attachment.file_name)}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download to view
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
