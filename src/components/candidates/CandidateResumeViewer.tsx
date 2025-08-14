import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useCandidateAttachments } from '@/hooks/useCandidateAttachments'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { convertDocumentToPdf } from '@/utils/documentToPdf'

interface CandidateResumeViewerProps {
  candidateId?: string
  jobCandidateId?: string // For backward compatibility  
  fallbackResumeUrl?: string | null
  className?: string
  height?: number // in vh, default 70
}

export function CandidateResumeViewer({ candidateId, jobCandidateId, fallbackResumeUrl, className, height = 70 }: CandidateResumeViewerProps) {
  // Use candidateId first, fallback to jobCandidateId for backward compatibility
  const effectiveCandidateId = candidateId || jobCandidateId || ''
  const { attachments } = useCandidateAttachments(effectiveCandidateId)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('resume')
  const [isConverting, setIsConverting] = useState(false)
  const [conversionError, setConversionError] = useState<string | null>(null)
  const resumeAttachment = useMemo(() => attachments.find(a => a.is_resume), [attachments])

  const effectiveUrl = resumeAttachment ? resumeAttachment.file_url : (fallbackResumeUrl || null)
  const fileType = resumeAttachment?.file_type || undefined

  useEffect(() => {
    let isMounted = true

    const createUrl = async () => {
      if (!effectiveUrl) {
        setSignedUrl(null)
        return
      }

      // If it's a storage path (no http/https), create a signed URL
      const isStoragePath = !/^https?:\/\//i.test(effectiveUrl)
      if (isStoragePath) {
        const { data, error } = await supabase.storage
          .from('candidate-attachments')
          .createSignedUrl(effectiveUrl, 300)
        if (!isMounted) return
        if (error || !data?.signedUrl) {
          setSignedUrl(null)
          return
        }
        setSignedUrl(data.signedUrl)
        setFileName(resumeAttachment?.file_name || 'resume')
      } else {
        setSignedUrl(effectiveUrl)
        setFileName('resume')
      }
    }

    createUrl()
    return () => { isMounted = false }
  }, [effectiveUrl, resumeAttachment?.file_name])

  const isPdf = useMemo(() => {
    if (fileType?.includes('pdf')) return true
    return (effectiveUrl || '').toLowerCase().endsWith('.pdf')
  }, [fileType, effectiveUrl])

  const isImage = useMemo(() => {
    if (fileType?.startsWith('image/')) return true
    const lower = (effectiveUrl || '').toLowerCase()
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => lower.endsWith(ext))
  }, [fileType, effectiveUrl])

  const isConvertibleDocument = useMemo(() => {
    if (fileType?.includes('wordprocessingml')) return true
    const lower = (effectiveUrl || '').toLowerCase()
    return ['.docx', '.doc'].some(ext => lower.endsWith(ext))
  }, [fileType, effectiveUrl])

  useEffect(() => {
    let createdUrl: string | null = null
    let active = true
    if (!signedUrl) {
      setPreviewUrl(null)
      return
    }
    if (isPdf) {
      ;(async () => {
        try {
          const res = await fetch(signedUrl)
          if (!res.ok) throw new Error('Failed to fetch file')
          const blob = await res.blob()
          if (!active) return
          const url = URL.createObjectURL(blob)
          createdUrl = url
          setPreviewUrl(url)
        } catch (e) {
          if (active) setPreviewUrl(signedUrl)
        }
      })()
    } else if (isConvertibleDocument) {
      ;(async () => {
        try {
          setIsConverting(true)
          setConversionError(null)
          
          const res = await fetch(signedUrl)
          if (!res.ok) throw new Error('Failed to fetch file')
          const blob = await res.blob()
          const file = new File([blob], fileName, { type: fileType || 'application/octet-stream' })
          
          if (!active) return
          
          const pdfBlob = await convertDocumentToPdf(file)
          if (!active) return
          
          const url = URL.createObjectURL(pdfBlob)
          createdUrl = url
          setPreviewUrl(url)
        } catch (e) {
          if (active) {
            setConversionError('Failed to convert document for preview')
            setPreviewUrl(null)
          }
        } finally {
          if (active) setIsConverting(false)
        }
      })()
    } else {
      setPreviewUrl(null)
    }
    return () => {
      active = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [signedUrl, isPdf, isConvertibleDocument, fileName, fileType])

  if (!effectiveUrl || !signedUrl) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-text-secondary">
          No resume available.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        <div className="w-full border border-border rounded-lg overflow-hidden bg-surface-secondary">
          {isConverting ? (
            <div className="p-6 text-center text-text-secondary text-sm">
              Converting document for preview...
            </div>
          ) : conversionError ? (
            <div className="p-6 text-center text-text-secondary text-sm">
              {conversionError}. You can download or open the original file in a new tab.
            </div>
          ) : (isPdf || (isConvertibleDocument && previewUrl)) ? (
            <iframe
              src={previewUrl || signedUrl}
              title="Resume preview"
              className="w-full"
              style={{ height: `${height}vh` }}
            />
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedUrl}
              alt="Candidate resume preview"
              className="w-full object-contain"
              style={{ maxHeight: `${height}vh` }}
              loading="lazy"
            />
          ) : (
            <div className="p-6 text-center text-text-secondary text-sm">
              This file type cannot be previewed inline. You can download or open it in a new tab.
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <a href={signedUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">Open in new tab</Button>
          </a>
          <a href={signedUrl} download={fileName}>
            <Button variant="secondary">Download</Button>
          </a>
        </div>
      </div>
    </div>
  )
}
