import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

export interface GeneratedQuestion {
  question_text: string
  notes_for_interviewer: string
  answer_type: 'text' | 'yes_no'
  suggested_reason: string
}

interface GenerateParams {
  jobId: string
  stageName: string
  stageType: string
  existingQuestions: string[]
}

export function useScorecardQuestionsGeneration() {
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const generateQuestions = async (params: GenerateParams): Promise<GeneratedQuestion[]> => {
    setIsGenerating(true)
    setError(null)
    
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('generate-scorecard-questions', {
        body: params
      })

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to generate questions')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      const questions = data?.questions || []
      setGeneratedQuestions(questions)
      
      if (questions.length > 0) {
        toast.success(`Generated ${questions.length} interview questions`)
      }
      
      return questions
    } catch (err) {
      const error = err as Error
      setError(error)
      
      // Handle specific error cases
      if (error.message.includes('Rate limit')) {
        toast.error('Rate limit exceeded. Please try again in a moment.')
      } else if (error.message.includes('credits')) {
        toast.error('AI credits exhausted. Please add credits to continue.')
      } else {
        toast.error('Failed to generate questions. Please try again.')
      }
      
      return []
    } finally {
      setIsGenerating(false)
    }
  }

  const clearGenerated = () => {
    setGeneratedQuestions([])
    setError(null)
  }

  return {
    generatedQuestions,
    isGenerating,
    error,
    generateQuestions,
    clearGenerated
  }
}
