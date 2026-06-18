import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  DollarSign, MapPin, Phone, Linkedin, Briefcase, Building2, Users,
  Type, AlignLeft, Hash, Mail, Link2, Calendar as CalendarIcon, List, ListChecks,
  ToggleLeft, FileText, MessageSquare,
} from 'lucide-react'
import type { ComponentType } from 'react'

export type AnswerType =
  // smart fields
  | 'salary_expectations' | 'location' | 'phone' | 'linkedin'
  | 'employment_type' | 'work_location' | 'recruiter'
  // basic types
  | 'text' | 'longtext' | 'number' | 'email' | 'url' | 'date'
  | 'single_select' | 'multi_select' | 'yes_no' | 'file'

export interface ScorecardFieldDef {
  type: AnswerType
  label: string
  icon: ComponentType<{ className?: string }>
  hint?: string
  /** Default question text used when the type is selected (smart fields only). */
  defaultQuestion?: string
  /** Candidate column synced on submit, if any. */
  syncTarget?: 'salary' | 'phone' | 'linkedin' | 'location'
}

/** Smart fields (mirrors ApplicationFormBuilder.SMART_FIELDS, identifiers adapted to scorecard answer_type). */
export const SCORECARD_SMART_FIELDS: ScorecardFieldDef[] = [
  { type: 'salary_expectations', label: 'Salary expectations', icon: DollarSign, hint: 'Currency-aware',                    defaultQuestion: "What are the candidate's salary expectations?",       syncTarget: 'salary' },
  { type: 'location',            label: 'Location',            icon: MapPin,     hint: 'City · state · country',            defaultQuestion: 'Where is the candidate based?',                       syncTarget: 'location' },
  { type: 'phone',               label: 'Phone',               icon: Phone,      hint: 'International format',              defaultQuestion: "What is the candidate's phone number?",               syncTarget: 'phone' },
  { type: 'linkedin',            label: 'LinkedIn',            icon: Linkedin,   hint: 'Profile URL',                       defaultQuestion: "What is the candidate's LinkedIn profile URL?",       syncTarget: 'linkedin' },
  { type: 'employment_type',     label: 'Employment type',     icon: Briefcase,  hint: 'Full-time · part-time · contract',  defaultQuestion: "What is the candidate's preferred employment type?" },
  { type: 'work_location',       label: 'Work location',       icon: Building2,  hint: 'Remote · hybrid · on-site',         defaultQuestion: "What is the candidate's preferred work arrangement?" },
  { type: 'recruiter',           label: 'Preferred recruiter', icon: Users,      hint: 'Team member assignment',            defaultQuestion: 'Which recruiter should this candidate be routed to?' },
]

/** Basic types (mirrors ApplicationFormBuilder.BASIC_TYPES; multi_select kept for backward compatibility). */
export const SCORECARD_BASIC_TYPES: ScorecardFieldDef[] = [
  { type: 'text',          label: 'Short text',    icon: Type },
  { type: 'longtext',      label: 'Long text',     icon: AlignLeft },
  { type: 'number',        label: 'Number',        icon: Hash },
  { type: 'email',         label: 'Email',         icon: Mail },
  { type: 'url',           label: 'URL',           icon: Link2 },
  { type: 'date',          label: 'Date',          icon: CalendarIcon },
  { type: 'single_select', label: 'Single select', icon: List },
  { type: 'multi_select',  label: 'Multi select',  icon: ListChecks },
  { type: 'yes_no',        label: 'Yes / No',      icon: ToggleLeft },
  { type: 'file',          label: 'File upload',   icon: FileText },
]

export const SCORECARD_SMART_FIELD_TYPES = new Set<AnswerType>(SCORECARD_SMART_FIELDS.map(s => s.type))

const SCORECARD_TYPE_DEF: Record<AnswerType, ScorecardFieldDef> = Object.fromEntries(
  [...SCORECARD_SMART_FIELDS, ...SCORECARD_BASIC_TYPES].map(d => [d.type, d])
) as Record<AnswerType, ScorecardFieldDef>

export function getScorecardTypeDef(t: AnswerType): ScorecardFieldDef {
  return SCORECARD_TYPE_DEF[t] ?? { type: t, label: String(t), icon: MessageSquare }
}

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
          answer_type: question.answer_type as any,
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

  const updateVisibility = useMutation({
    mutationFn: async (visibility: ScorecardVisibility) => {
      if (!template) throw new Error('Template not loaded')
      const { error } = await supabase
        .from('stage_scorecard_templates')
        .update({ visibility })
        .eq('id', template.id)
      if (error) throw error
    },
    onSuccess: (_, visibility) => {
      if (template) {
        setTemplate({ ...template, visibility })
      }
      toast.success(`Scorecard visibility set to ${visibility}`)
      queryClient.invalidateQueries({ queryKey: ['scorecard-configuration', jhsId] })
    },
    onError: (error) => {
      console.error('Error updating visibility:', error)
      toast.error('Failed to update scorecard visibility')
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
    reorderQuestions,
    updateVisibility
  }
}
