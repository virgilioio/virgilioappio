
import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Upload, File, Download, Trash2, AlertCircle } from 'lucide-react'
import { useCandidateAttachments } from '@/hooks/useCandidateAttachments'
import { usePermissions } from '@/hooks/usePermissions'
import { toast } from '@/hooks/use-toast'
import { formatDistanceToNow } from 'date-fns'
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog'

interface CandidateAttachmentsProps {
  candidateId: string
}

export function CandidateAttachments({ candidateId }: CandidateAttachmentsProps) {
  const { attachments, isLoading, isUploading, uploadAttachment, deleteAttachment, downloadAttachment, setPrimaryResume } = useCandidateAttachments(candidateId)
  const { canManageCandidates } = usePermissions()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<typeof attachments[0] | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return File
    if (fileType.includes('pdf')) return File
    if (fileType.includes('image')) return File
    return File
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    
    // Validate file size (15MB limit)
    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'File size must be less than 15MB',
        variant: 'destructive'
      })
      return
    }

    try {
      await uploadAttachment(file)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (!canManageCandidates) return
    handleFileSelect(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (canManageCandidates) {
      setDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
    // Reset input value
    e.target.value = ''
  }

  const handleDelete = async (attachmentId: string, fileUrl: string) => {
    if (window.confirm('Are you sure you want to delete this attachment?')) {
      try {
        await deleteAttachment(attachmentId, fileUrl)
      } catch (error) {
        // Error handling is done in the hook
      }
    }
  }

  const handleAttachmentClick = (attachment: typeof attachments[0]) => {
    setPreviewAttachment(attachment)
    setIsPreviewOpen(true)
  }

  const handlePreviewClose = () => {
    setIsPreviewOpen(false)
    setPreviewAttachment(null)
  }

  if (isLoading) {
    return (
      <Card className="bg-surface-primary border-border">
        <AccordionTrigger className="px-6 py-4 hover:no-underline">
          <CardTitle className="text-lg">Attachments</CardTitle>
        </AccordionTrigger>
        <AccordionContent>
          <CardContent className="space-y-sm pt-0">
            <Skeleton className="h-[100px] rounded-brand" />
            <Skeleton className="h-[40px] rounded-brand" />
          </CardContent>
        </AccordionContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-surface-primary border-border">
        <AccordionTrigger className="px-6 py-4 hover:no-underline">
          <CardTitle className="text-lg">Attachments</CardTitle>
        </AccordionTrigger>
        <AccordionContent>
          <CardContent className="space-y-sm pt-0">
            {/* Upload Area */}
            {canManageCandidates && (
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragOver 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileInputChange}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.zip"
                />
                
                <Upload className="h-8 w-8 mx-auto text-text-secondary mb-2" />
                <p className="text-sm text-text-secondary mb-2">
                  Drag and drop files here, or click to browse
                </p>
                <p className="text-xs text-text-secondary mb-4">
                  PDF, DOC, DOCX, TXT, ZIP, images up to 15MB
                </p>
                
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="gap-sm"
                >
                  <Upload className="h-4 w-4" />
                  {isUploading ? 'Uploading...' : 'Choose Files'}
                </Button>
              </div>
            )}

            {/* Attachments List */}
            {attachments.length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                <File className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-[1.38rem] font-semibold mb-2 tracking-[-0.06em]">
                  <span>No attachments yet</span><span className="text-[#d7c5fb]">.</span>
                </p>
                {!canManageCandidates && (
                  <p className="text-xs mt-1">You don't have permission to upload attachments</p>
                )}
              </div>
            ) : (
              <div className="space-y-sm">
                {attachments.map((attachment) => {
                  const FileIcon = getFileIcon(attachment.file_type)
                  
                  return (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-3 border border-warning/20 bg-warning/10 rounded-lg hover:scale-105 transition-transform duration-200"
                    >
                      <div 
                        className="flex items-center gap-md flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleAttachmentClick(attachment)}
                      >
                        <FileIcon className="h-5 w-5 text-text-secondary flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {attachment.file_name}
                          </p>
                          <div className="flex items-center gap-sm text-xs text-text-secondary">
                            <span>{formatFileSize(attachment.file_size_bytes)}</span>
                            <span>•</span>
                            <span>
                              {formatDistanceToNow(new Date(attachment.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        {attachment.file_type && (
                          <Badge variant="secondary" className="text-xs">
                            {attachment.file_type.split('/')[1]?.toUpperCase() || 'FILE'}
                          </Badge>
                        )}
                        {attachment.is_resume && (
                          <Badge variant="default" className="text-xs ml-2">Resume</Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-sm">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadAttachment(attachment.id, attachment.file_name)}
                          className="gap-sm h-8 px-2"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        
                        {canManageCandidates && !attachment.is_resume && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPrimaryResume(attachment.id)}
                            className="gap-sm h-8 px-2"
                          >
                            Mark as Resume
                          </Button>
                        )}
                        {canManageCandidates && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(attachment.id, attachment.file_url)}
                            className="gap-sm h-8 px-2 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Info message */}
            {attachments.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Attachments are securely stored and only accessible to authorized team members.
                </p>
              </div>
            )}
          </CardContent>
        </AccordionContent>
      </Card>

      <AttachmentPreviewDialog
        attachment={previewAttachment}
        isOpen={isPreviewOpen}
        onClose={handlePreviewClose}
        onDownload={downloadAttachment}
      />
    </>
  )
}
