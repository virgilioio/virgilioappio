import { useState, useRef, useCallback } from 'react'
import { useResumeParsing } from './useResumeParsing'
import { useIndependentCandidates } from './useIndependentCandidates'
import { usePipelineActions } from './usePipelineActions'
import { toast } from './use-toast'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { triggerBackgroundEnrichment } from './useCandidateEnrichment'
import { sanitizeToE164 } from '@/utils/phoneUtils'

export interface BulkUploadOptions {
  autoGenerateSkills: boolean
  assignToJob?: string
  assignToStage?: string
  source?: string
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

interface EnrichmentTask {
  candidateId: string
  resumeText: string
  candidateName: string
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function useBulkCandidateUpload() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [fileResults, setFileResults] = useState<FileProcessingResult[]>([])
  // Mirror of fileResults for synchronous reads (avoids stale closure)
  const localResultsRef = useRef<FileProcessingResult[]>([])
  
  const { parseResumeCoreFields } = useResumeParsing()
  const { addCandidate, updateCandidate, getCandidates } = useIndependentCandidates()
  const { createAssociationAndMove } = usePipelineActions()
  const { user } = useAuth()

  const resetUploadState = useCallback(() => {
    setFileResults([])
    localResultsRef.current = []
    setIsProcessing(false)
  }, [])

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
    // Keep local mirror in sync
    localResultsRef.current[fileIndex] = {
      ...localResultsRef.current[fileIndex],
      status,
      progress,
      candidate,
      error
    }
  }

  const uploadResumeFile = async (candidateId: string, file: File) => {
    const ext = file.name.split('.').pop()
    const storagePath = `${candidateId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    
    const { error: storageError } = await supabase.storage
      .from('candidate-attachments')
      .upload(storagePath, file)
    
    if (storageError) throw storageError
    
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
      await supabase.storage.from('candidate-attachments').remove([storagePath])
      throw dbError
    }
  }

  const processFile = async (
    file: File,
    fileIndex: number,
    options: BulkUploadOptions,
    enrichmentQueue: EnrichmentTask[]
  ) => {
    try {
      // 1. AI Core Fields Parse
      updateFileStatus(fileIndex, 'parsing', 30)
      
      const result = await parseResumeCoreFields(file)
      if (!result) {
        throw new Error('Failed to parse resume')
      }
      
      const { parsed, resumeText } = result

      updateFileStatus(fileIndex, 'creating', 60)

      // 2. Parse location
      const locationParts = parsed.location?.split(',').map(s => s.trim()) || []
      
      // 3. Create candidate data
      const candidateData = {
        candidate_name: parsed.name || file.name.replace(/\.[^/.]+$/, ''),
        email: parsed.email,
        phone: parsed.phone ? sanitizeToE164(parsed.phone) : undefined,
        linkedin_url: parsed.linkedinUrl,
        location_city: locationParts[0],
        location_state: locationParts[1],
        location_country: locationParts[2] || locationParts[1],
        enrichment_status: options.autoGenerateSkills ? 'pending' : undefined,
        source: options.source || undefined,
      }

      // Pass skipRefresh + silent to avoid per-candidate DB saturation and toast spam
      const createResult = await addCandidate(candidateData, { skipRefresh: true, silent: true })

      // 4. Handle duplicate detection
      if (createResult && 'isDuplicate' in createResult) {
        await updateCandidate(createResult.existingCandidate.id, createResult.mergedData)
        
        updateFileStatus(fileIndex, 'uploading', 80)
        try {
          await uploadResumeFile(createResult.existingCandidate.id, file)
        } catch (uploadError) {
          console.warn('Resume upload failed for merged candidate:', uploadError)
        }
        
        // Queue enrichment instead of firing immediately
        if (options.autoGenerateSkills && resumeText) {
          enrichmentQueue.push({
            candidateId: createResult.existingCandidate.id,
            resumeText,
            candidateName: parsed.name || ''
          })
        }
        
        updateFileStatus(fileIndex, 'duplicate', 100, createResult.existingCandidate)
      } else if (createResult && 'id' in createResult) {
        updateFileStatus(fileIndex, 'uploading', 80)
        try {
          await uploadResumeFile(createResult.id, file)
        } catch (uploadError) {
          console.warn('Resume upload failed, but candidate was created:', uploadError)
        }
        
        // Queue enrichment instead of firing immediately
        if (options.autoGenerateSkills && resumeText) {
          enrichmentQueue.push({
            candidateId: createResult.id,
            resumeText,
            candidateName: parsed.name || ''
          })
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

  // Store hook deps in refs so uploadCandidates doesn't need them in its dependency array
  const parseResumeCoreFieldsRef = useRef(parseResumeCoreFields)
  parseResumeCoreFieldsRef.current = parseResumeCoreFields
  const addCandidateRef = useRef(addCandidate)
  addCandidateRef.current = addCandidate
  const updateCandidateRef = useRef(updateCandidate)
  updateCandidateRef.current = updateCandidate
  const getCandidatesRef = useRef(getCandidates)
  getCandidatesRef.current = getCandidates
  const createAssociationAndMoveRef = useRef(createAssociationAndMove)
  createAssociationAndMoveRef.current = createAssociationAndMove
  const userRef = useRef(user)
  userRef.current = user

  const uploadCandidates = useCallback(async (
    filesToUpload: File[],
    options: BulkUploadOptions
  ) => {
    setIsProcessing(true)
    const initialResults = filesToUpload.map(file => ({
      file,
      status: 'pending' as const,
      progress: 0
    }))
    setFileResults(initialResults)
    localResultsRef.current = [...initialResults]

    const updateStatus = (
      fileIndex: number,
      status: FileProcessingResult['status'],
      progress: number,
      candidate?: any,
      error?: string
    ) => {
      setFileResults(prev => {
        const newResults = [...prev]
        newResults[fileIndex] = { ...newResults[fileIndex], status, progress, candidate, error }
        return newResults
      })
      localResultsRef.current[fileIndex] = {
        ...localResultsRef.current[fileIndex],
        status, progress, candidate, error
      }
    }

    const uploadResumeFileInner = async (candidateId: string, file: File) => {
      const ext = file.name.split('.').pop()
      const storagePath = `${candidateId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: storageError } = await supabase.storage.from('candidate-attachments').upload(storagePath, file)
      if (storageError) throw storageError
      const { error: dbError } = await supabase.from('candidate_attachments').insert({
        candidate_id: candidateId, file_name: file.name, file_url: storagePath,
        file_size_bytes: file.size, file_type: file.type, uploaded_by: userRef.current?.id, is_resume: true,
      })
      if (dbError) {
        await supabase.storage.from('candidate-attachments').remove([storagePath])
        throw dbError
      }
    }

    const processFileInner = async (
      file: File, fileIndex: number, opts: BulkUploadOptions, enrichmentQueue: EnrichmentTask[]
    ) => {
      try {
        updateStatus(fileIndex, 'parsing', 30)
        const result = await parseResumeCoreFieldsRef.current(file)
        if (!result) throw new Error('Failed to parse resume')
        const { parsed, resumeText } = result
        updateStatus(fileIndex, 'creating', 60)
        const locationParts = parsed.location?.split(',').map(s => s.trim()) || []
        const candidateData = {
          candidate_name: parsed.name || file.name.replace(/\.[^/.]+$/, ''),
          email: parsed.email, phone: parsed.phone ? sanitizeToE164(parsed.phone) : undefined,
          linkedin_url: parsed.linkedinUrl, location_city: locationParts[0],
          location_state: locationParts[1], location_country: locationParts[2] || locationParts[1],
          enrichment_status: opts.autoGenerateSkills ? 'pending' : undefined,
          source: opts.source || undefined,
        }
        const createResult = await addCandidateRef.current(candidateData, { skipRefresh: true, silent: true })
        if (createResult && 'isDuplicate' in createResult) {
          await updateCandidateRef.current(createResult.existingCandidate.id, createResult.mergedData)
          updateStatus(fileIndex, 'uploading', 80)
          try { await uploadResumeFileInner(createResult.existingCandidate.id, file) } catch (e) { console.warn('Resume upload failed for merged candidate:', e) }
          if (opts.autoGenerateSkills && resumeText) enrichmentQueue.push({ candidateId: createResult.existingCandidate.id, resumeText, candidateName: parsed.name || '' })
          updateStatus(fileIndex, 'duplicate', 100, createResult.existingCandidate)
        } else if (createResult && 'id' in createResult) {
          updateStatus(fileIndex, 'uploading', 80)
          try { await uploadResumeFileInner(createResult.id, file) } catch (e) { console.warn('Resume upload failed, but candidate was created:', e) }
          if (opts.autoGenerateSkills && resumeText) enrichmentQueue.push({ candidateId: createResult.id, resumeText, candidateName: parsed.name || '' })
          updateStatus(fileIndex, 'success', 100, createResult)
          if (opts.assignToJob && opts.assignToStage && createResult.id) {
            try { await createAssociationAndMoveRef.current(createResult.id, opts.assignToJob, opts.assignToStage) } catch (err) { console.warn('Job assignment failed:', err) }
          }
        }
      } catch (error) {
        updateStatus(fileIndex, 'error', 100, undefined, error instanceof Error ? error.message : 'Unknown error')
      }
    }

    const enrichmentQueue: EnrichmentTask[] = []
    try {
      const CONCURRENT_UPLOADS = 2
      for (let i = 0; i < filesToUpload.length; i += CONCURRENT_UPLOADS) {
        const chunk = filesToUpload.slice(i, i + CONCURRENT_UPLOADS)
        await Promise.all(chunk.map((file, chunkIndex) => processFileInner(file, i + chunkIndex, options, enrichmentQueue)))
        if (i + CONCURRENT_UPLOADS < filesToUpload.length) await delay(500)
      }
      const summary = calculateSummary(localResultsRef.current)
      toast({ title: 'Upload Complete', description: `${summary.created} created, ${summary.merged} merged, ${summary.failed} failed` })
      try { await getCandidatesRef.current() } catch (err) { console.warn('Post-bulk-upload refresh failed:', err) }
      if (enrichmentQueue.length > 0) {
        console.log(`🔄 Starting sequential enrichment for ${enrichmentQueue.length} candidates`)
        for (const task of enrichmentQueue) { triggerBackgroundEnrichment(task.candidateId, task.resumeText, task.candidateName); await delay(1000) }
      }
    } catch (error) {
      console.error('Bulk upload error:', error)
      toast({ title: 'Upload Error', description: 'An error occurred during bulk upload', variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }, [])

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
