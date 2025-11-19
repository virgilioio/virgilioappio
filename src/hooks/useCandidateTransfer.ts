import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { usePipelineActions } from './usePipelineActions'

interface TransferOptions {
  candidateId: string
  candidateName: string
  sourceJobId: string
  sourceJobTitle: string
  targetJobId: string
  targetJobTitle: string
  targetStageId?: string
}

interface AddOptions {
  candidateId: string
  candidateName: string
  targetJobId: string
  targetJobTitle: string
  targetStageId?: string
  notes?: string
}

export function useCandidateTransfer() {
  const [isTransferring, setIsTransferring] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const { createAssociationAndMove } = usePipelineActions()

  const addToJob = async (options: AddOptions) => {
    setIsTransferring(true)
    setError(null)
    
    try {
      // Use existing pipeline action to create association
      await createAssociationAndMove(
        options.targetJobId,
        options.candidateId,
        options.targetStageId || ''
      )
      
      toast({
        title: "Candidate Added",
        description: `${options.candidateName} has been added to ${options.targetJobTitle}`,
      })
      
      return { success: true }
    } catch (err) {
      const error = err as Error
      setError(error)
      toast({
        title: "Failed to Add Candidate",
        description: error.message,
        variant: "destructive"
      })
      return { success: false, error }
    } finally {
      setIsTransferring(false)
    }
  }

  const transferCandidate = async (options: TransferOptions) => {
    setIsTransferring(true)
    setError(null)
    
    try {
      const { data, error: transferError } = await supabase.functions.invoke(
        'transfer-candidate',
        {
          body: {
            candidateId: options.candidateId,
            sourceJobId: options.sourceJobId,
            targetJobId: options.targetJobId,
            targetStageId: options.targetStageId
          }
        }
      )

      if (transferError) throw transferError
      if (!data?.success) throw new Error(data?.error || 'Transfer failed')

      toast({
        title: "Candidate Transferred",
        description: `${options.candidateName} has been transferred from ${options.sourceJobTitle} to ${options.targetJobTitle}. All comments, emails, and scorecards have been moved.`,
      })

      return { success: true, data }
    } catch (err) {
      const error = err as Error
      setError(error)
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive"
      })
      return { success: false, error }
    } finally {
      setIsTransferring(false)
    }
  }

  return {
    addToJob,
    transferCandidate,
    isTransferring,
    error
  }
}
