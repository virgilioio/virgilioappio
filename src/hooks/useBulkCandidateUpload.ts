import { useState } from 'react'
import { useResumeParsing } from './useResumeParsing'
import { useIndependentCandidates } from './useIndependentCandidates'
import { usePipelineActions } from './usePipelineActions'
import { toast } from './use-toast'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { triggerBackgroundEnrichment } from './useCandidateEnrichment'

export interface BulkUploadOptions {
  autoGenerateSkills: boolean
  assignToJob?: string
  assignToStage?: string
}

export interface FileProcessingResult {
  file: File
  status: 'pending' | 'parsing' | 'creating' | 'uploading' | 'success' | 'duplicate' | 'error'
  candidate?: any
  error?: string
  progress: number
}

interface Summary {
  created: number
  merged: number
  failed: number
  total: number
}

export function useBulkCandidateUpload() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [fileResults, setFileResults] = useState<FileProcessingResult[]>([])
  
  const { parseResumeCoreFields } = useResumeParsing()
  const { addCandidate, updateCandidate } = useIndependentCandidates()
  const { createAssociationAndMove } = usePipelineActions()
  const { user } = useAuth()

  const resetUploadState = () => {
    setFileResults([])
    setIsProcessing(false)
  }

  const updateFileStatus = (
    fileIndex: number,
    status: FileProcessingResult['status'],
    progress: number,
    candidate?: any,
    error?: string
  ) => {
    setFileResults(prev => {
      const newResults = [...prev]
      newResults[fileIndex] = {
        ...newResults[fileIndex],
        status,
        progress,
        candidate,
        error
      }
      return newResults
    })
  }

  const uploadResumeFile = async (candidateId: string, file: File) => {
    // Generate unique storage path
    const ext = file.name.split('.').pop()
    const storagePath = `${candidateId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    
    // Upload to storage
    const { error: storageError } = await supabase.storage
      .from('candidate-attachments')
      .upload(storagePath, file)
    
    if (storageError) throw storageError
    
    // Create database record
    const { error: dbError } = await supabase
      .from('candidate_attachments')
      .insert({
        candidate_id: candidateId,
        file_name: file.name,
        file_url: storagePath,
        file_size_bytes: file.size,
        file_type: file.type,
        uploaded_by: user?.id,
        is_resume: true,
      })
    
    if (dbError) {
      // Cleanup storage if DB insert fails
      await supabase.storage.from('candidate-attachments').remove([storagePath])
      throw dbError
    }
  }

  const processFile = async (
    file: File,
    fileIndex: number,
    options: BulkUploadOptions
  ) => {
    try {
      // 1. AI Core Fields Parse (fast, ~3-5 seconds)
      updateFileStatus(fileIndex, 'parsing', 30)
      
      const result = await parseResumeCoreFields(file)
      if (!result) {
        throw new Error('Failed to parse resume')
      }
      
      const { parsed, resumeText } = result

      updateFileStatus(fileIndex, 'creating', 60)

      // 2. Parse location
      const locationParts = parsed.location?.split(',').map(s => s.trim()) || []
      
      // 3. Create candidate data (without AI-generated skills/summary - will be added by background enrichment)
      const candidateData = {
        candidate_name: parsed.name || file.name.replace(/\.[^/.]+$/, ''),
        email: parsed.email,
        phone: parsed.phone,
        linkedin_url: parsed.linkedinUrl,
        // No profile_summary or skills - will be added by background enrichment
        location_city: locationParts[0],
        location_state: locationParts[1],
        location_country: locationParts[2] || locationParts[1],
        enrichment_status: options.autoGenerateSkills ? 'pending' : undefined,
      }

      const createResult = await addCandidate(candidateData)

      // 4. Handle duplicate detection
      if (createResult && 'isDuplicate' in createResult) {
        await updateCandidate(createResult.existingCandidate.id, createResult.mergedData)
        
        updateFileStatus(fileIndex, 'uploading', 80)
        try {
          await uploadResumeFile(createResult.existingCandidate.id, file)
        } catch (uploadError) {
          console.warn('Resume upload failed for merged candidate:', uploadError)
        }
        
        // Trigger background enrichment for merged candidate (generates skills + profile summary)
        if (options.autoGenerateSkills && resumeText) {
          triggerBackgroundEnrichment(createResult.existingCandidate.id, resumeText, parsed.name)
        }
        
        updateFileStatus(fileIndex, 'duplicate', 100, createResult.existingCandidate)
      } else if (createResult && 'id' in createResult) {
        updateFileStatus(fileIndex, 'uploading', 80)
        try {
          await uploadResumeFile(createResult.id, file)
        } catch (uploadError) {
          console.warn('Resume upload failed, but candidate was created:', uploadError)
        }
        
        // Trigger background enrichment for new candidate (generates skills + profile summary)
        if (options.autoGenerateSkills && resumeText) {
          triggerBackgroundEnrichment(createResult.id, resumeText, parsed.name)
        }
        
        updateFileStatus(fileIndex, 'success', 100, createResult)

        // 5. Assign to job if specified
        if (options.assignToJob && options.assignToStage && createResult.id) {
          try {
            await createAssociationAndMove(
              createResult.id,
              options.assignToJob,
              options.assignToStage
            )
          } catch (err) {
            console.warn('Job assignment failed:', err)
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      updateFileStatus(fileIndex, 'error', 100, undefined, errorMessage)
    }
  }

  const uploadCandidates = async (
    files: File[],
    options: BulkUploadOptions
  ) => {
    setIsProcessing(true)
    setFileResults(files.map(file => ({
      file,
      status: 'pending',
      progress: 0
    })))

    try {
      // Process files with concurrency control (3 at a time)
      const CONCURRENT_UPLOADS = 3
      
      for (let i = 0; i < files.length; i += CONCURRENT_UPLOADS) {
        const chunk = files.slice(i, i + CONCURRENT_UPLOADS)
        const promises = chunk.map((file, chunkIndex) => 
          processFile(file, i + chunkIndex, options)
        )
        await Promise.all(promises)
      }

      const summary = calculateSummary(fileResults)
      toast({
        title: 'Upload Complete',
        description: `${summary.created} created, ${summary.merged} merged, ${summary.failed} failed`
      })
    } catch (error) {
      console.error('Bulk upload error:', error)
      toast({
        title: 'Upload Error',
        description: 'An error occurred during bulk upload',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const calculateOverallProgress = (results: FileProcessingResult[]): number => {
    if (results.length === 0) return 0
    const total = results.reduce((sum, r) => sum + r.progress, 0)
    return Math.round(total / results.length)
  }

  const calculateSummary = (results: FileProcessingResult[]): Summary => {
    return {
      created: results.filter(r => r.status === 'success').length,
      merged: results.filter(r => r.status === 'duplicate').length,
      failed: results.filter(r => r.status === 'error').length,
      total: results.length
    }
  }

  return {
    uploadCandidates,
    isProcessing,
    fileResults,
    progress: calculateOverallProgress(fileResults),
    summary: calculateSummary(fileResults),
    resetUploadState
  }
}
