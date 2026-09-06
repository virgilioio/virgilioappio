import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useCandidateAttachments } from '@/hooks/useCandidateAttachments'
import { useCandidateResolver } from '@/hooks/useCandidateResolver'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RotateCcw, ExternalLink, Download, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { PDFResumeViewer } from './PDFResumeViewer'
import { DOCXResumeViewer } from './DOCXResumeViewer'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftPaper } from '@/components/ui/EmptyIllustrations'

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

  const resumeAttachment = useMemo(() => {
    if (!attachments.length) return undefined
    const flagged = attachments.find(a => a.is_resume)
    return flagged ?? attachments[0]
  }, [attachments])

  const effectiveUrl = resumeAttachment?.file_url ?? fallbackResumeUrl ?? null
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

      const resolveStorageUrl = async (path: string) => {
        console.log('📡 Creating signed URL for storage path:', path)
        const { data, error } = await supabase.storage
          .from('candidate-attachments')
          .createSignedUrl(path, 3600)

        if (!isMounted) return null

        if (error || !data?.signedUrl) {
          console.error('❌ Error creating signed URL:', error)

          const { data: publicData } = supabase.storage
            .from('candidate-attachments')
            .getPublicUrl(path)

          if (publicData?.publicUrl) {
            console.log('🔄 Using public URL fallback for storage path:', publicData.publicUrl)
            return publicData.publicUrl
          }

          setError(`Failed to load resume: ${error?.message || 'Unknown error'}`)
          return null
        }

        console.log('✅ Signed URL created successfully')
        return data.signedUrl
      }

      const resolveUrl = async (url: string) => {
        const isStoragePath = !/^https?:\/\//i.test(url)
        if (!isStoragePath) {
          console.log('✅ Using direct URL:', url)
          return url
        }

        return resolveStorageUrl(url)
      }

      try {
        if (convertedPdfUrl && conversionStatus === 'completed') {
          const resolved = await resolveUrl(convertedPdfUrl)
          if (!isMounted) return

          if (!resolved) {
            setSignedUrl(null)
            setPreviewUrl(null)
            setIsLoading(false)
            return
          }

          setSignedUrl(resolved)
          setPreviewUrl(resolved)
          setFileName(resumeAttachment?.file_name?.replace(/\.[^/.]+$/, '') + '.pdf' || 'resume.pdf')
          setIsLoading(false)
          return
        }

        const resolved = await resolveUrl(effectiveUrl)
        if (!isMounted) return

        if (!resolved) {
          setSignedUrl(null)
          setPreviewUrl(null)
          setIsLoading(false)
          return
        }

        setSignedUrl(resolved)
        setPreviewUrl(resolved)
        setFileName(resumeAttachment?.file_name || 'resume')
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
      <EmptyState
        size="card"
        illustration={<SoftPaper />}
        title="No resume yet"
        body="Upload a resume to view it here."
        className={className}
      />
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

  const pillClass =
    'inline-flex h-7 items-center gap-2 rounded-[7px] border border-[#E7E8EE] bg-white px-2.5 font-inter text-[11.5px] text-[#1F2230] transition-colors hover:bg-[#FAFAF7] disabled:opacity-50 disabled:pointer-events-none'
  const iconPillClass =
    'inline-flex h-7 w-7 items-center justify-center rounded-[7px] border border-[#E7E8EE] bg-white text-[#1F2230] transition-colors hover:bg-[#FAFAF7] disabled:opacity-50 disabled:pointer-events-none'

  const openInNewTab = () => {
    const url = previewUrl || signedUrl
    if (!url) {
      toast.error('No resume URL available')
      return
    }
    const newWindow = window.open(url, '_blank')
    if (!newWindow) toast.error('Popup blocked. Please allow popups for this site.')
  }

  const downloadOriginal = async () => {
    const url = signedUrl
    if (!url) {
      toast.error('No resume URL available')
      return
    }
    try {
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
    } catch {
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const downloadConverted = async () => {
    if (!convertedPdfUrl) return
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
    } catch {
      const link = document.createElement('a')
      link.href = convertedPdfUrl
      link.download = fileName.replace(/\.[^/.]+$/, '') + '.pdf'
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return (
    <div className={className}>
      {/* Toolbar strip */}
      <div className="flex items-center gap-2 border-b border-[#F1F0EC] bg-[#FAFAF7] px-3.5 py-2.5">
        <span className={pillClass}>
          <FileText className="h-[11px] w-[11px] text-[#8B8F9E]" strokeWidth={2} />
          <span className="truncate max-w-[220px]">{fileName}</span>
        </span>

        {needsConversion && conversionStatus !== 'completed' && (
          <span className={pillClass}>
            {conversionStatus === 'processing' && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#6F3FF5] border-t-transparent" />
            )}
            <span className="text-[#5A6072]">
              {conversionStatus === 'processing'
                ? 'Converting to PDF'
                : conversionStatus === 'failed'
                  ? 'Conversion failed'
                  : 'Conversion pending'}
            </span>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {conversionStatus === 'failed' && (
            <button type="button" className={pillClass} onClick={retryConversion} disabled={isRetrying}>
              <RotateCcw className={`h-[11px] w-[11px] ${isRetrying ? 'animate-spin' : ''}`} strokeWidth={2} />
              Retry
            </button>
          )}
          {error && (
            <button
              type="button"
              className={pillClass}
              onClick={() => {
                setError(null)
                setIframeError(false)
                refetch()
              }}
            >
              <RotateCcw className="h-[11px] w-[11px]" strokeWidth={2} />
              Retry
            </button>
          )}
          <button
            type="button"
            className={pillClass}
            onClick={openInNewTab}
            disabled={!previewUrl && !signedUrl}
          >
            <ExternalLink className="h-[11px] w-[11px]" strokeWidth={2} />
            Open in new tab
          </button>
          {convertedPdfUrl && conversionStatus === 'completed' && needsConversion && (
            <button type="button" className={pillClass} onClick={downloadConverted}>
              <Download className="h-[11px] w-[11px]" strokeWidth={2} />
              PDF
            </button>
          )}
          <button
            type="button"
            className={iconPillClass}
            onClick={downloadOriginal}
            disabled={!signedUrl}
            aria-label="Download resume"
            title="Download"
          >
            <Download className="h-[13px] w-[13px]" strokeWidth={2} />
          </button>
        </div>
      </div>

      {conversionError && (
        <div className="border-b border-[#F1F0EC] bg-[#FAFAF7] px-3.5 py-2 font-inter text-[11px] text-destructive">
          {conversionError}
        </div>
      )}
      {error && (
        <div className="border-b border-[#F1F0EC] bg-[#FAFAF7] px-3.5 py-2 font-inter text-[11.5px] text-destructive">
          {error}
        </div>
      )}

      {/* Document */}
      <div className="bg-[#F6F5F1] px-5 py-6">
        <div className="mx-auto max-w-[860px] overflow-hidden rounded-[10px] border border-[#E7E8EE] bg-white shadow-[0_2px_12px_rgba(13,13,9,0.07)]">
          {isPdf && previewUrl ? (
            <PDFResumeViewer url={previewUrl} height={height} />
          ) : isImage && signedUrl ? (
            <img
              src={signedUrl}
              alt="Candidate resume preview"
              className="w-full object-contain"
              style={{ maxHeight: `${height}vh` }}
              loading="lazy"
            />
          ) : needsConversion && signedUrl ? (
            <DOCXResumeViewer url={signedUrl} height={height} />
          ) : (
            <div className="p-6 text-center" style={{ height: `${height}vh` }}>
              <div className="flex h-full items-center justify-center">
                <div className="font-inter text-[12px] text-[#5A6072]">
                  This file type cannot be previewed inline. You can download or open it in a new tab.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

