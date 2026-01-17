import { useState, useEffect, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, X, DollarSign, Link2 } from 'lucide-react'
import type { InterviewQuestion, AnswerType, SelectOption, SalaryConfig } from '@/hooks/useScorecardsConfiguration'
import { useSubmitShortcut } from '@/hooks/useSubmitShortcut'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

interface InterviewQuestionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (question: Omit<InterviewQuestion, 'id'>) => void
  existingQuestion?: InterviewQuestion
  nextDisplayOrder: number
  isSaving: boolean
  jobId: string
}

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'MXN', label: 'MXN - Mexican Peso' },
  { value: 'BRL', label: 'BRL - Brazilian Real' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'SEK', label: 'SEK - Swedish Krona' },
  { value: 'NZD', label: 'NZD - New Zealand Dollar' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'HKD', label: 'HKD - Hong Kong Dollar' },
  { value: 'COP', label: 'COP - Colombian Peso' },
  { value: 'ARS', label: 'ARS - Argentine Peso' },
  { value: 'CLP', label: 'CLP - Chilean Peso' },
  { value: 'PEN', label: 'PEN - Peruvian Sol' },
]

const PERIODS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annually', label: 'Annually' },
]

export function InterviewQuestionForm({
  open,
  onOpenChange,
  onSave,
  existingQuestion,
  nextDisplayOrder,
  isSaving,
  jobId
}: InterviewQuestionFormProps) {
  const [questionText, setQuestionText] = useState('')
  const [answerType, setAnswerType] = useState<AnswerType>('text')
  const [isRequired, setIsRequired] = useState(true)
  const [selectOptions, setSelectOptions] = useState<SelectOption[]>([
    { value: '', label: '' },
    { value: '', label: '' }
  ])
  const [notesForInterviewer, setNotesForInterviewer] = useState('')
  const [salaryCurrency, setSalaryCurrency] = useState('USD')
  const [salaryPeriod, setSalaryPeriod] = useState<'hourly' | 'monthly' | 'annually'>('annually')

  // Fetch job's default currency
  const { data: job } = useQuery({
    queryKey: ['job-currency', jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from('jobs')
        .select('currency')
        .eq('id', jobId)
        .single()
      return data
    },
    enabled: !!jobId
  })

  useEffect(() => {
    if (existingQuestion) {
      setQuestionText(existingQuestion.question_text)
      setAnswerType(existingQuestion.answer_type)
      setIsRequired(existingQuestion.is_required)
      setSelectOptions(existingQuestion.select_options || [{ value: '', label: '' }, { value: '', label: '' }])
      setNotesForInterviewer(existingQuestion.notes_for_interviewer || '')
      if (existingQuestion.salary_config) {
        setSalaryCurrency(existingQuestion.salary_config.currency)
        setSalaryPeriod(existingQuestion.salary_config.period)
      }
    } else {
      setQuestionText('')
      setAnswerType('text')
      setIsRequired(true)
      setSelectOptions([{ value: '', label: '' }, { value: '', label: '' }])
      setNotesForInterviewer('')
      // Set default currency from job
      setSalaryCurrency(job?.currency || 'USD')
      setSalaryPeriod('annually')
    }
  }, [existingQuestion, open, job?.currency])

  const handleSave = () => {
    const isSalaryType = answerType === 'salary_expectations'
    
    if (!isSalaryType && !questionText.trim()) {
      return
    }

    if ((answerType === 'single_select' || answerType === 'multi_select')) {
      const validOptions = selectOptions.filter(opt => opt.value.trim() && opt.label.trim())
      if (validOptions.length < 2) {
        return
      }
    }

    const question: Omit<InterviewQuestion, 'id'> = {
      question_text: isSalaryType ? "What are the candidate's salary expectations?" : questionText.trim(),
      answer_type: answerType,
      is_required: isRequired,
      display_order: existingQuestion?.display_order || nextDisplayOrder,
      select_options: (answerType === 'single_select' || answerType === 'multi_select')
        ? selectOptions.filter(opt => opt.value.trim() && opt.label.trim())
        : undefined,
      notes_for_interviewer: notesForInterviewer.trim() || undefined,
      salary_config: isSalaryType ? { currency: salaryCurrency, period: salaryPeriod } : undefined
    }

    onSave(question)
  }

  const addOption = () => {
    setSelectOptions([...selectOptions, { value: '', label: '' }])
  }

  const removeOption = (index: number) => {
    if (selectOptions.length > 2) {
      setSelectOptions(selectOptions.filter((_, i) => i !== index))
    }
  }

  const updateOption = (index: number, field: 'value' | 'label', value: string) => {
    const updated = [...selectOptions]
    updated[index][field] = value
    setSelectOptions(updated)
  }

  const isSalaryType = answerType === 'salary_expectations'
  const isSelectType = answerType === 'single_select' || answerType === 'multi_select'
  const validOptions = isSelectType ? selectOptions.filter(opt => opt.value.trim() && opt.label.trim()) : []
  const canSave = isSalaryType || (questionText.trim() && (!isSelectType || validOptions.length >= 2))

  const handleKeyDown = useSubmitShortcut(handleSave, { disabled: !canSave || isSaving })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-h4-mobile font-poppins font-bold text-virgilio-text tracking-page-title">
            {existingQuestion ? 'Edit' : 'Add'} Interview Question<span className="text-purple-period">.</span>
          </SheetTitle>
          <SheetDescription className="text-virgilio-muted">
            Configure the interview question that will appear when submitting a scorecard for this stage.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Answer Type - Moved to top */}
          <div className="space-y-2">
            <Label htmlFor="answer-type">
              Question Type <span className="text-destructive">*</span>
            </Label>
            <Select value={answerType} onValueChange={(value) => setAnswerType(value as AnswerType)}>
              <SelectTrigger id="answer-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text (Long Answer)</SelectItem>
                <SelectItem value="yes_no">Yes/No</SelectItem>
                <SelectItem value="single_select">Single Select</SelectItem>
                <SelectItem value="multi_select">Multi Select</SelectItem>
                <SelectItem value="salary_expectations">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-virgilio-purple" />
                    Salary Expectations
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Salary Configuration - shown for salary_expectations type */}
          {isSalaryType && (
            <div className="space-y-4 p-4 bg-virgilio-purple/5 border border-virgilio-purple/20 rounded-lg">
              <div className="flex items-center gap-2 text-virgilio-purple">
                <Link2 className="h-4 w-4" />
                <span className="text-sm font-medium">Syncs to Candidate Profile</span>
              </div>
              
              <div className="bg-white border border-virgilio-border/50 rounded-md p-3">
                <p className="text-sm text-virgilio-text font-medium mb-1">
                  "What are the candidate's salary expectations?"
                </p>
                <p className="text-xs text-virgilio-muted">
                  This question is pre-set. Answers will automatically update the candidate's salary expectations field.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salary-currency">Currency</Label>
                  <Select value={salaryCurrency} onValueChange={setSalaryCurrency}>
                    <SelectTrigger id="salary-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(currency => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salary-period">Period</Label>
                  <Select value={salaryPeriod} onValueChange={(v) => setSalaryPeriod(v as 'hourly' | 'monthly' | 'annually')}>
                    <SelectTrigger id="salary-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIODS.map(period => (
                        <SelectItem key={period.value} value={period.value}>
                          {period.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Badge variant="outline" className="bg-white">
                  {salaryCurrency}
                </Badge>
                <Badge variant="outline" className="bg-white capitalize">
                  {salaryPeriod}
                </Badge>
              </div>
            </div>
          )}

          {/* Question Text - hidden for salary_expectations */}
          {!isSalaryType && (
            <div className="space-y-2">
              <Label htmlFor="question-text">
                Question <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="question-text"
                placeholder="Enter the interview question..."
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">⌘↵ to save</p>
            </div>
          )}

          {/* Options for Select Types */}
          {isSelectType && (
            <div className="space-y-2">
              <Label>
                Options <span className="text-destructive">*</span>
                <span className="text-xs text-virgilio-muted ml-2">(At least 2 required)</span>
              </Label>
              <div className="space-y-2">
                {selectOptions.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Value"
                      value={option.value}
                      onChange={(e) => updateOption(index, 'value', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Label"
                      value={option.label}
                      onChange={(e) => updateOption(index, 'label', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeOption(index)}
                      disabled={selectOptions.length <= 2}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Option
                </Button>
              </div>
            </div>
          )}

          {/* Notes for Interviewer - shown for all types */}
          <div className="space-y-2">
            <Label htmlFor="notes-for-interviewer">
              Notes for Interviewer (Optional)
            </Label>
            <Textarea
              id="notes-for-interviewer"
              placeholder="Add guidance, expected answers, or context about this question..."
              value={notesForInterviewer}
              onChange={(e) => setNotesForInterviewer(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <p className="text-xs text-virgilio-muted">
              These notes will be displayed to interviewers when they fill out the scorecard.
            </p>
          </div>

          {/* Required Toggle */}
          <div className="flex items-center justify-between p-4 border border-virgilio-border rounded-lg bg-surface-primary">
            <div className="space-y-0.5">
              <Label htmlFor="required-toggle">Required Question</Label>
              <p className="text-sm text-virgilio-muted">
                Interviewers must answer this question to submit their scorecard
              </p>
            </div>
            <Switch
              id="required-toggle"
              checked={isRequired}
              onCheckedChange={setIsRequired}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving ? 'Saving...' : existingQuestion ? 'Update Question' : 'Add Question'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}