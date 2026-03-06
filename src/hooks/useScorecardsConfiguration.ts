import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export type AnswerType = 'text' | 'yes_no' | 'single_select' | 'multi_select' | 'salary_expectations'

export interface SelectOption {
  value: string
  label: string
}

export interface SalaryConfig {
  currency: string
  period: 'hourly' | 'monthly' | 'annually'
}

export interface InterviewQuestion {
  id: string
  question_text: string
  answer_type: AnswerType
  is_required: boolean
  display_order: number
  select_options?: SelectOption[]
  notes_for_interviewer?: string | null
  salary_config?: SalaryConfig | null
}

export type ScorecardVisibility = 'private' | 'public'

export interface ScorecardTemplate {
  id: string
  job_hiring_stage_id: string
  visibility: ScorecardVisibility
  questions: InterviewQuestion[]
}

export function useScorecardsConfiguration(jhsId: string | null) {
  const [template, setTemplate] = useState<ScorecardTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const queryClient = useQueryClient()

  const loadTemplate = async () => {
    if (!jhsId) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      
      // Check if template exists
      const { data: templateData, error: templateError } = await supabase
        .from('stage_scorecard_templates')
        .select('*')
        .eq('job_hiring_stage_id', jhsId)
        .maybeSingle()

      if (templateError) throw templateError

      let templateId: string

      if (!templateData) {
        // Create template if it doesn't exist
        const { data: newTemplate, error: createError } = await supabase
          .from('stage_scorecard_templates')
          .insert({
            job_hiring_stage_id: jhsId,
            created_by: (await supabase.auth.getUser()).data.user?.id
          })
          .select()
          .single()

        if (createError) throw createError
        templateId = newTemplate.id
      } else {
        templateId = templateData.id
      }

      // Load questions
      const { data: questions, error: questionsError } = await supabase
        .from('scorecard_interview_questions')
        .select('*')
        .eq('scorecard_template_id', templateId)
        .order('display_order', { ascending: true })

      if (questionsError) throw questionsError

      const formattedQuestions: InterviewQuestion[] = (questions || []).map(q => ({
        id: q.id,
        question_text: q.question_text,
        answer_type: q.answer_type as AnswerType,
        is_required: q.is_required,
        display_order: q.display_order,
        select_options: (q.select_options as unknown) as SelectOption[] | undefined,
        notes_for_interviewer: q.notes_for_interviewer,
        salary_config: (q.salary_config as unknown) as SalaryConfig | undefined
      }))

      // Get visibility from template data (re-fetch if we just created it)
      let visibility: ScorecardVisibility = 'private'
      if (templateData?.visibility) {
        visibility = templateData.visibility as ScorecardVisibility
      }

      setTemplate({
        id: templateId,
        job_hiring_stage_id: jhsId,
        visibility,
        questions: formattedQuestions
      })
    } catch (err) {
      console.error('Error loading scorecard template:', err)
      setError(err instanceof Error ? err : new Error('Failed to load scorecard configuration'))
      toast.error('Failed to load scorecard configuration')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTemplate()
  }, [jhsId])

  const createQuestion = useMutation({
    mutationFn: async (question: Omit<InterviewQuestion, 'id'>) => {
      if (!template) throw new Error('Scorecard template not loaded. Please refresh the page and try again.')

      const { data, error } = await supabase
        .from('scorecard_interview_questions')
        .insert({
          scorecard_template_id: template.id,
          question_text: question.question_text,
          answer_type: question.answer_type,
          is_required: question.is_required,
          display_order: question.display_order,
          select_options: question.select_options as any || null,
          notes_for_interviewer: question.notes_for_interviewer || null,
          salary_config: question.salary_config as any || null
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Interview question added successfully')
      loadTemplate()
      queryClient.invalidateQueries({ queryKey: ['scorecard-configuration', jhsId] })
    },
    onError: (error) => {
      console.error('Error creating question:', error)
      toast.error('Failed to add interview question')
    }
  })

  const updateQuestion = useMutation({
    mutationFn: async ({ questionId, updates }: { questionId: string; updates: Partial<InterviewQuestion> }) => {
      const updateData: any = { ...updates }
      if (updateData.select_options) {
        updateData.select_options = updateData.select_options as any
      }
      
      const { data, error } = await supabase
        .from('scorecard_interview_questions')
        .update(updateData)
        .eq('id', questionId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Interview question updated successfully')
      loadTemplate()
      queryClient.invalidateQueries({ queryKey: ['scorecard-configuration', jhsId] })
    },
    onError: (error) => {
      console.error('Error updating question:', error)
      toast.error('Failed to update interview question')
    }
  })

  const deleteQuestion = useMutation({
    mutationFn: async (questionId: string) => {
      const { error } = await supabase
        .from('scorecard_interview_questions')
        .delete()
        .eq('id', questionId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Interview question deleted successfully')
      loadTemplate()
      queryClient.invalidateQueries({ queryKey: ['scorecard-configuration', jhsId] })
    },
    onError: (error) => {
      console.error('Error deleting question:', error)
      toast.error('Failed to delete interview question')
    }
  })

  const reorderQuestions = useMutation({
    mutationFn: async (questionIds: string[]) => {
      const updates = questionIds.map((id, index) => ({
        id,
        display_order: index + 1
      }))

      const promises = updates.map(({ id, display_order }) =>
        supabase
          .from('scorecard_interview_questions')
          .update({ display_order })
          .eq('id', id)
      )

      await Promise.all(promises)
    },
    onSuccess: () => {
      toast.success('Questions reordered successfully')
      loadTemplate()
      queryClient.invalidateQueries({ queryKey: ['scorecard-configuration', jhsId] })
    },
    onError: (error) => {
      console.error('Error reordering questions:', error)
      toast.error('Failed to reorder questions')
    }
  })

  return {
    template,
    isLoading,
    error,
    refetch: loadTemplate,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions
  }
}
