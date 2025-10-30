import { useState } from 'react'
import { useResumeParsing } from './useResumeParsing'
import { useIndependentCandidates } from './useIndependentCandidates'
import { useSkillsGeneration } from './useSkillsGeneration'
import { usePipelineActions } from './usePipelineActions'
import { toast } from './use-toast'

export interface BulkUploadOptions {
  autoGenerateSkills: boolean
  assignToJob?: string
  assignToStage?: string
}

export interface FileProcessingResult {
  file: File
  status: 'pending' | 'parsing' | 'creating' | 'success' | 'duplicate' | 'error'
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
  
  const { parseResume } = useResumeParsing()
  const { addCandidate, updateCandidate } = useIndependentCandidates()
  const { generateSkills } = useSkillsGeneration()
  const { createAssociationAndMove } = usePipelineActions()

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

  const processFile = async (
    file: File,
    fileIndex: number,
    options: BulkUploadOptions
  ) => {
    try {
      // 1. Parse resume
      updateFileStatus(fileIndex, 'parsing', 20)
      
      const parsed = await parseResume(file)
      if (!parsed) {
        throw new Error('Failed to parse resume')
      }

      updateFileStatus(fileIndex, 'parsing', 50)

      // 2. Generate skills if enabled
      let skills: string[] = []
      if (options.autoGenerateSkills && parsed.profileSummary) {
        try {
          const { skills: generatedSkills } = await generateSkills(
            parsed.profileSummary,
            parsed.name || file.name
          )
          skills = generatedSkills.map(s => s.name)
        } catch (err) {
          console.warn('Skills generation failed, continuing without skills:', err)
        }
      }

      updateFileStatus(fileIndex, 'creating', 70)

      // 3. Parse location
      const locationParts = parsed.location?.split(',').map(s => s.trim()) || []
      
      // 4. Create candidate data
      const candidateData = {
        candidate_name: parsed.name || file.name.replace(/\.[^/.]+$/, ''),
        email: parsed.email,
        phone: parsed.phone,
        linkedin_url: parsed.linkedinUrl,
        profile_summary: parsed.profileSummary,
        skills: skills.length > 0 ? skills : undefined,
        location_city: locationParts[0],
        location_state: locationParts[1],
        location_country: locationParts[2] || locationParts[1],
      }

      const result = await addCandidate(candidateData)

      // 5. Handle duplicate detection
      if (result && 'isDuplicate' in result) {
        // Auto-merge duplicates in bulk mode
        await updateCandidate(result.existingCandidate.id, result.mergedData)
        updateFileStatus(fileIndex, 'duplicate', 100, result.existingCandidate)
      } else if (result && 'id' in result) {
        updateFileStatus(fileIndex, 'success', 100, result)

        // 6. Assign to job if specified
        if (options.assignToJob && options.assignToStage && result.id) {
          try {
            await createAssociationAndMove(
              result.id,
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
    summary: calculateSummary(fileResults)
  }
}
