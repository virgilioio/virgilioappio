
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

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

export function useCandidateAttachments(candidateId: string) {
  const [attachments, setAttachments] = useState<CandidateAttachment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [lastRefetch, setLastRefetch] = useState(0)
  const { user } = useAuth()

  const getAttachments = async () => {
    if (!candidateId) return

    setIsLoading(true)
    try {
      console.log('Fetching attachments for candidate:', candidateId)
      
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

      console.log('Fetched attachments:', data)
      setAttachments(data || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch attachments'
      console.error('Attachments fetch error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
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
        .upload(fileName, file)

      if (storageError) {
        console.error('Storage upload error:', storageError)
        throw storageError
      }

      console.log('File uploaded to storage successfully')

      // Create database record
      const { error: dbError } = await supabase
        .from('candidate_attachments')
        .insert({
          candidate_id: candidateId,
          file_name: file.name,
          file_url: fileName, // Store the storage path
          file_size_bytes: file.size,
          file_type: file.type,
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

      toast({
        title: 'Success',
        description: 'Attachment uploaded successfully'
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

      toast({
        title: 'Success',
        description: 'Attachment deleted successfully'
      })

      await getAttachments()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete attachment'
      console.error('Delete error:', err)
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

  const downloadAttachment = async (attachmentId: string, fileName: string) => {
    try {
      console.log('Starting download for:', fileName)
      
      toast({
        title: 'Download starting',
        description: 'Preparing your file for download...'
      })
      
      // Use edge function for direct download
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
    setLastRefetch(Date.now())
  }

  useEffect(() => {
    if (candidateId) {
      getAttachments()
    }
  }, [candidateId, lastRefetch])

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
