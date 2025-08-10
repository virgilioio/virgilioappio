import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useCandidateAttachments } from '@/hooks/useCandidateAttachments'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface CandidateResumeViewerProps {
  jobCandidateId?: string
  fallbackResumeUrl?: string | null
  className?: string
  height?: number // in vh, default 70
}

export function CandidateResumeViewer({ jobCandidateId, fallbackResumeUrl, className, height = 70 }: CandidateResumeViewerProps) {
  const { attachments } = useCandidateAttachments(jobCandidateId || '')
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('resume')
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
    } else {
      setPreviewUrl(null)
    }
    return () => {
      active = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [signedUrl, isPdf])

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
          {isPdf ? (
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
