
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { removeOldResumes, currentResumeIds } from '@/lib/removeOldResumes'
import { contentTypeFor } from '@/lib/candidateFiles'
import { triggerBackgroundEnrichment } from '@/hooks/useCandidateEnrichment'

export interface CandidateAttachment {
  id: string
  candidate_id: string
  file_name: string
  file_url: string
  file_size_bytes: number | null
  file_type: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
  is_resume: boolean
  converted_pdf_url?: string | null
  conversion_status?: string | null
  conversion_error?: string | null
  converted_at?: string | null
}

async function fetchAttachments(candidateId: string): Promise<CandidateAttachment[]> {
  const { data, error } = await supabase
    .from('candidate_attachments')
    .select(`
      *,
      converted_pdf_url,
      conversion_status,
      conversion_error,
      converted_at
    `)
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Error fetching attachments:', error)
    throw error
  }
  return (data || []) as CandidateAttachment[]
}

/**
 * A candidate's files. One shared list per candidate (2026-10-17): the profile,
 * its sidebar and the resume viewer each kept their own copy, so a replaced
 * resume stayed on screen in the viewer until the page was reopened.
 */
export function useCandidateAttachments(candidateId: string) {
  const queryClient = useQueryClient()
  const queryKey = ['candidate-attachments', candidateId] as const
  const query = useQuery({
    queryKey,
    queryFn: () => fetchAttachments(candidateId),
    enabled: !!candidateId,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
  const attachments = query.data ?? []
  const [isBusy, setIsLoading] = useState(false)
  const isLoading = (query.isLoading && !!candidateId) || isBusy
  const [isUploading, setIsUploading] = useState(false)
  const { user } = useAuth()

  // A failed load says so, as before (once per failure).
  useEffect(() => {
    if (!query.error) return
    toast({
      title: 'Error',
      description: query.error instanceof Error ? query.error.message : 'Failed to fetch attachments',
      variant: 'destructive',
    })
  }, [query.error])

  const getAttachments = async () => {
    if (!candidateId) return
    await queryClient.invalidateQueries({ queryKey: ['candidate-attachments', candidateId] })
  }

  const uploadAttachment = async (file: File, isResume: boolean = false) => {
    if (!user || !candidateId) {
      throw new Error('User not authenticated or candidate ID missing')
    }

    setIsUploading(true)
    try {
      console.log('Uploading file:', file.name, 'for candidate:', candidateId)
      
      // Generate simple file path: {candidate_id}/{timestamp}-{random}.{ext}
      const fileExt = file.name.split('.').pop()
      const fileName = `${candidateId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

      console.log('Generated file path:', fileName)

      // Upload file to storage
      const { error: storageError } = await supabase.storage
        .from('candidate-attachments')
        .upload(fileName, file, { contentType: contentTypeFor(file) })

      if (storageError) {
        console.error('Storage upload error:', storageError)
        throw storageError
      }

      console.log('File uploaded to storage successfully')

      const previousResumeIds = isResume ? await currentResumeIds(candidateId) : []

      // Create database record
      const { error: dbError } = await supabase
        .from('candidate_attachments')
        .insert({
          candidate_id: candidateId,
          file_name: file.name,
          file_url: fileName, // Store the storage path
          file_size_bytes: file.size,
          file_type: contentTypeFor(file),
          uploaded_by: user.id,
          is_resume: isResume
        })

      if (dbError) {
        console.error('Database insert error:', dbError)
        // Clean up storage if database insert fails
        await supabase.storage
          .from('candidate-attachments')
          .remove([fileName])
        throw dbError
      }

      console.log('Database record created successfully')

      // A new resume is the new truth: re-read it and re-score Gio Fit on
      // every active job this candidate is in.
      if (isResume) {
        await removeOldResumes(candidateId, previousResumeIds)
        void triggerBackgroundEnrichment(candidateId, undefined, undefined, { rescoreAllJobs: true })
      }

      toast({
        title: isResume ? 'Resume uploaded' : 'File uploaded',
        description: isResume
          ? `${file.name} ${previousResumeIds.length ? 'replaces the old resume' : 'is saved'}. Gio is reading it now; the profile shows when it's done.`
          : file.name,
      })

      await getAttachments()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload attachment'
      console.error('Upload error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsUploading(false)
    }
  }

  const fileLabel = (id: string) => {
    const name = attachments.find((a) => a.id === id)?.file_name?.trim()
    return name ? `\u201c${name}\u201d` : 'the file'
  }

  const deleteAttachment = async (attachmentId: string, fileUrl: string) => {
    setIsLoading(true)
    try {
      console.log('Deleting attachment:', attachmentId, 'with file:', fileUrl)
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('candidate_attachments')
        .delete()
        .eq('id', attachmentId)

      if (dbError) {
        console.error('Database delete error:', dbError)
        throw dbError
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('candidate-attachments')
        .remove([fileUrl])

      if (storageError) {
        console.error('Storage delete error:', storageError)
        // Don't throw here as the database record is already deleted
      }

      toast({ title: fileLabel(attachmentId) === 'the file' ? 'File deleted' : `${fileLabel(attachmentId)} deleted` })

      await getAttachments()
    } catch (err) {
      console.error('Delete error:', err)
      // Never a raw server error (Block B §16).
      toast({
        title: `Couldn\u2019t delete ${fileLabel(attachmentId)}`,
        description: 'Nothing was removed; try again.',
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const downloadAttachment = async (attachmentId: string, fileName: string) => {
    try {
      console.log('Starting download for:', fileName)
      
      toast({
        title: 'Download starting',
        description: 'Preparing your file for download...'
      })
      
      // The function checks access and logs the download, then hands back a
      // short-lived link, so files of any size (videos) download straight from
      // storage with the browser's own progress.
      const linked = await supabase.functions.invoke('download-attachment', {
        body: { attachmentId, mode: 'link' }
      })
      const link = (linked.data as { url?: string } | null)?.url
      if (!linked.error && link) {
        const a = document.createElement('a')
        a.href = link
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        return
      }

      // Older function version: the bytes come back through it.
      const response = await supabase.functions.invoke('download-attachment', {
        body: { attachmentId }
      })

      if (response.error) {
        console.error('Download function error:', response.error)
        throw new Error(response.error.message || 'Failed to download file')
      }

      if (!response.data) {
        throw new Error('No file data received')
      }

      // Create blob and download link
      const blob = new Blob([response.data], { 
        type: response.data.type || 'application/octet-stream' 
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: 'Download complete',
        description: `${fileName} has been downloaded successfully`
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download attachment'
      console.error('Download error:', err)
      toast({
        title: 'Download failed',
        description: errorMessage,
        variant: 'destructive'
      })
    }
  }
  const setPrimaryResume = async (attachmentId: string) => {
    setIsLoading(true)
    try {
      console.log('Setting primary resume:', attachmentId)
      const { error } = await supabase
        .from('candidate_attachments')
        .update({ is_resume: true })
        .eq('id', attachmentId)

      if (error) {
        console.error('Error setting primary resume:', error)
        throw error
      }

      toast({
        title: 'Resume set',
        description: 'This attachment is now the primary resume.'
      })

      await getAttachments()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set resume'
      console.error('Set resume error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const refetch = () => {
    void getAttachments()
  }

  return {
    attachments,
    isLoading,
    isUploading,
    uploadAttachment,
    deleteAttachment,
    downloadAttachment,
    setPrimaryResume,
    getAttachments,
    refetch
  }
}
