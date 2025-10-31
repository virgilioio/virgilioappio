import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useCandidateAttachments } from '@/hooks/useCandidateAttachments'
import { useCandidateResolver } from '@/hooks/useCandidateResolver'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RotateCcw, ExternalLink, Download, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface CandidateResumeViewerProps {
  candidateId?: string
  jobCandidateId?: string // For backward compatibility  
  fallbackResumeUrl?: string | null
  className?: string
  height?: number // in vh, default 70
}

export function CandidateResumeViewer({ candidateId, jobCandidateId, fallbackResumeUrl, className, height = 70 }: CandidateResumeViewerProps) {
  // Use candidateId first, fallback to jobCandidateId for backward compatibility
  const inputCandidateId = candidateId || jobCandidateId || null
  
  // Resolve job candidate ID to independent candidate ID if needed
  const { independentCandidateId } = useCandidateResolver(inputCandidateId)
  const { attachments, refetch } = useCandidateAttachments(independentCandidateId || '')
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('resume')
  const [isLoading, setIsLoading] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [iframeError, setIframeError] = useState(false)

  const resumeAttachment = useMemo(() => attachments.find(a => a.is_resume), [attachments])

  const effectiveUrl = resumeAttachment ? resumeAttachment.file_url : (fallbackResumeUrl || null)
  const fileType = resumeAttachment?.file_type || undefined
  const convertedPdfUrl = resumeAttachment?.converted_pdf_url || null
  const conversionStatus = resumeAttachment?.conversion_status || 'pending'
  const conversionError = resumeAttachment?.conversion_error || null

  // File type detection
  const isPdf = useMemo(() => {
    // If we have a converted PDF, treat it as PDF
    if (convertedPdfUrl && conversionStatus === 'completed') {
      return true
    }
    // Otherwise check original file type
    if (fileType?.includes('pdf')) return true
    return (effectiveUrl || '').toLowerCase().endsWith('.pdf')
  }, [fileType, effectiveUrl, convertedPdfUrl, conversionStatus])

  const isImage = useMemo(() => {
    if (fileType?.startsWith('image/')) return true
    const lower = (effectiveUrl || '').toLowerCase()
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => lower.endsWith(ext))
  }, [fileType, effectiveUrl])

  const needsConversion = useMemo(() => {
    if (fileType?.includes('wordprocessingml')) return true
    const lower = (effectiveUrl || '').toLowerCase()
    return ['.docx', '.doc'].some(ext => lower.endsWith(ext))
  }, [fileType, effectiveUrl])

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    setError(null)
    setIframeError(false)

    const createUrl = async () => {
      console.log('🔍 CandidateResumeViewer - Creating URL:', {
        effectiveUrl,
        convertedPdfUrl,
        conversionStatus,
        isPdf
      })

      if (!effectiveUrl) {
        setSignedUrl(null)
        setIsLoading(false)
        return
      }

      try {
        // If we have a converted PDF and it's ready, use that
        if (convertedPdfUrl && conversionStatus === 'completed') {
          console.log('✅ Using converted PDF:', convertedPdfUrl)
          setSignedUrl(convertedPdfUrl)
          setPreviewUrl(convertedPdfUrl)
          setFileName(resumeAttachment?.file_name?.replace(/\.[^/.]+$/, '') + '.pdf' || 'resume.pdf')
          setIsLoading(false)
          return
        }

        // For PDF files or when no conversion is needed
        const isStoragePath = !/^https?:\/\//i.test(effectiveUrl)
        if (isStoragePath) {
          console.log('📡 Creating signed URL for storage path:', effectiveUrl)
          const { data, error } = await supabase.storage
            .from('candidate-attachments')
            .createSignedUrl(effectiveUrl, 3600)
          
          if (!isMounted) return
          
          if (error || !data?.signedUrl) {
            console.error('❌ Error creating signed URL:', error)
            setError(`Failed to load resume: ${error?.message || 'Unknown error'}`)
            
            // Try to construct direct URL as fallback
            const publicUrl = supabase.storage.from('candidate-attachments').getPublicUrl(effectiveUrl).data.publicUrl
            console.log('🔄 Trying direct URL as fallback:', publicUrl)
            setSignedUrl(publicUrl)
            setPreviewUrl(publicUrl)
            setFileName(resumeAttachment?.file_name || 'resume')
            setIsLoading(false)
            return
          }
          
          console.log('✅ Signed URL created successfully')
          setSignedUrl(data.signedUrl)
          setPreviewUrl(data.signedUrl)
          setFileName(resumeAttachment?.file_name || 'resume')
        } else {
          console.log('✅ Using direct URL:', effectiveUrl)
          if (!isMounted) return
          setSignedUrl(effectiveUrl)
          setPreviewUrl(effectiveUrl)
          setFileName('resume')
        }

        setIsLoading(false)
      } catch (error) {
        console.error('❌ Error creating URL:', error)
        if (isMounted) {
          setError('An unexpected error occurred while loading the resume')
          setSignedUrl(null)
          setIsLoading(false)
        }
      }
    }

    createUrl()
    return () => { isMounted = false }
  }, [effectiveUrl, resumeAttachment?.file_name, convertedPdfUrl, conversionStatus, isPdf])

  // Retry conversion function
  const retryConversion = async () => {
    if (!resumeAttachment?.id) return
    
    setIsRetrying(true)
    try {
      const { error } = await supabase.functions.invoke('convert-document-to-pdf', {
        body: {
          attachment_id: resumeAttachment.id,
          file_url: resumeAttachment.file_url,
          file_type: resumeAttachment.file_type
        }
      })
      
      if (error) {
        console.error('Error retrying conversion:', error)
      } else {
        // Refetch attachments after a short delay
        setTimeout(() => refetch(), 2000)
      }
    } catch (error) {
      console.error('Error retrying conversion:', error)
    } finally {
      setIsRetrying(false)
    }
  }

  if (!effectiveUrl) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-text-secondary">
          No resume available.
        </CardContent>
      </Card>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className={className}>
        <div className="space-y-3">
          <div className="w-full border border-border rounded-lg overflow-hidden bg-surface-secondary p-4">
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        <div className="w-full border border-border rounded-lg overflow-hidden bg-surface-secondary">
          {/* Show conversion status for documents that need conversion */}
          {needsConversion && conversionStatus !== 'completed' && (
            <div className="bg-muted/50 border-b p-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {conversionStatus === 'processing' && (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                      <span>Converting to PDF...</span>
                    </>
                  )}
                  {conversionStatus === 'failed' && (
                    <>
                      <span className="text-destructive">Conversion failed</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={retryConversion}
                        disabled={isRetrying}
                        className="h-6 px-2 ml-2"
                      >
                        <RotateCcw className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
                        Retry
                      </Button>
                    </>
                  )}
                  {conversionStatus === 'pending' && (
                    <span className="text-muted-foreground">Conversion pending...</span>
                  )}
                </div>
              </div>
              {conversionError && (
                <div className="text-xs text-destructive mt-1">{conversionError}</div>
              )}
            </div>
          )}

          {/* Document content */}
      {isPdf && previewUrl && !iframeError ? (
        <iframe
          src={previewUrl}
          title="Resume preview"
          className="w-full"
          style={{ height: `${height}vh` }}
          onError={(e) => {
            console.error('❌ Iframe failed to load PDF:', e)
            setIframeError(true)
            setError('Failed to load PDF preview. The file may be corrupt or the storage bucket may have CORS restrictions.')
          }}
        />
      ) : isPdf && iframeError ? (
        <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-border rounded-lg" style={{ height: `${height}vh` }}>
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-2">
            Direct preview unavailable
          </p>
          <p className="text-xs text-muted-foreground">
            Use the buttons below to view or download the PDF
          </p>
        </div>
      ) : isImage && signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedUrl}
              alt="Candidate resume preview"
              className="w-full object-contain"
              style={{ maxHeight: `${height}vh` }}
              loading="lazy"
            />
          ) : needsConversion && conversionStatus !== 'completed' ? (
            <div className="p-6 text-center text-text-secondary" style={{ height: `${height}vh` }}>
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-sm mb-2">
                    {conversionStatus === 'processing' 
                      ? 'Document is being converted to PDF for preview...'
                      : conversionStatus === 'failed'
                      ? 'Preview unavailable - conversion failed'
                      : 'Document will be converted to PDF for preview'
                    }
                  </div>
                  <div className="text-xs text-text-tertiary">
                    You can still download the original file below
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-text-secondary" style={{ height: `${height}vh` }}>
              <div className="flex items-center justify-center h-full">
                <div className="text-sm">
                  This file type cannot be previewed inline. You can download or open it in a new tab.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-3 text-sm text-destructive">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const url = previewUrl || signedUrl
              if (!url) {
                toast.error('No resume URL available')
                return
              }
              console.log('🔗 Opening URL in new tab:', url)
              const newWindow = window.open(url, '_blank')
              if (!newWindow) {
                toast.error('Popup blocked. Please allow popups for this site.')
              }
            }}
            disabled={!previewUrl && !signedUrl}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open in new tab
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const url = signedUrl
              if (!url) {
                toast.error('No resume URL available')
                return
              }
              
              try {
                console.log('⬇️ Downloading from URL:', url)
                
                // Try fetch + blob approach for better reliability
                const response = await fetch(url)
                if (!response.ok) throw new Error('Download failed')
                
                const blob = await response.blob()
                const blobUrl = window.URL.createObjectURL(blob)
                
                const link = document.createElement('a')
                link.href = blobUrl
                link.download = fileName
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                
                window.URL.revokeObjectURL(blobUrl)
                toast.success('Resume downloaded successfully')
              } catch (err) {
                console.error('❌ Download error:', err)
                
                // Fallback to simple link download
                const link = document.createElement('a')
                link.href = url
                link.download = fileName
                link.target = '_blank'
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              }
            }}
            disabled={!signedUrl}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download {needsConversion ? 'Original' : ''}
          </Button>
          {convertedPdfUrl && conversionStatus === 'completed' && needsConversion && (
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const response = await fetch(convertedPdfUrl)
                  if (!response.ok) throw new Error('Download failed')
                  
                  const blob = await response.blob()
                  const blobUrl = window.URL.createObjectURL(blob)
                  
                  const link = document.createElement('a')
                  link.href = blobUrl
                  link.download = fileName.replace(/\.[^/.]+$/, '') + '.pdf'
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                  
                  window.URL.revokeObjectURL(blobUrl)
                  toast.success('PDF downloaded successfully')
                } catch (err) {
                  console.error('❌ Download error:', err)
                  const link = document.createElement('a')
                  link.href = convertedPdfUrl
                  link.download = fileName.replace(/\.[^/.]+$/, '') + '.pdf'
                  link.target = '_blank'
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                }
              }}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          )}
          {error && (
            <Button
              variant="outline"
              onClick={() => {
                setError(null)
                setIframeError(false)
                refetch()
              }}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
