import { useState, useEffect, useMemo } from 'react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, X, Link2, Sparkles, ChevronDown, RefreshCw } from 'lucide-react'
import type { InterviewQuestion, AnswerType, SelectOption } from '@/hooks/useScorecardsConfiguration'
import {
  SCORECARD_SMART_FIELDS,
  SCORECARD_BASIC_TYPES,
  SCORECARD_SMART_FIELD_TYPES,
  getScorecardTypeDef,
} from '@/hooks/useScorecardsConfiguration'
import { useSubmitShortcut } from '@/hooks/useSubmitShortcut'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { CurrencySelect } from '@/components/ui/currency-select'

interface InterviewQuestionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (question: Omit<InterviewQuestion, 'id'>) => void
  existingQuestion?: InterviewQuestion
  nextDisplayOrder: number
  isSaving: boolean
  jobId: string
}

const PERIODS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annually', label: 'Annually' },
]

/** Smart fields whose answer auto-syncs back to the candidate profile. */
const SYNC_LABELS: Partial<Record<AnswerType, string>> = {
  salary_expectations: 'Syncs to Candidate Profile · salary',
  phone: 'Syncs to Candidate Profile · phone',
  linkedin: 'Syncs to Candidate Profile · LinkedIn',
  location: 'Syncs to Candidate Profile · location',
}

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
      setSalaryCurrency(job?.currency || 'USD')
      setSalaryPeriod('annually')
    }
  }, [existingQuestion, open, job?.currency])

  const isSmart = SCORECARD_SMART_FIELD_TYPES.has(answerType)
  const isSalaryType = answerType === 'salary_expectations'
  const isSelectType = answerType === 'single_select' || answerType === 'multi_select'
  const syncLabel = SYNC_LABELS[answerType]

  // For smart fields, the question text is fixed (the type IS the question).
  const lockedQuestion = isSmart ? (getScorecardTypeDef(answerType).defaultQuestion || '') : null

  const handleTypeChange = (next: AnswerType) => {
    setAnswerType(next)
    if (SCORECARD_SMART_FIELD_TYPES.has(next)) {
      const def = getScorecardTypeDef(next)
      if (def.defaultQuestion) setQuestionText(def.defaultQuestion)
    }
  }

  const handleSave = () => {
    const effectiveText = lockedQuestion ?? questionText.trim()
    if (!effectiveText) return

    if (isSelectType) {
      const validOptions = selectOptions.filter(opt => opt.value.trim() && opt.label.trim())
      if (validOptions.length < 2) return
    }

    const question: Omit<InterviewQuestion, 'id'> = {
      question_text: effectiveText,
      answer_type: answerType,
      is_required: isRequired,
      display_order: existingQuestion?.display_order || nextDisplayOrder,
      select_options: isSelectType
        ? selectOptions.filter(opt => opt.value.trim() && opt.label.trim())
        : undefined,
      notes_for_interviewer: notesForInterviewer.trim() || undefined,
      salary_config: isSalaryType ? { currency: salaryCurrency, period: salaryPeriod } : undefined
    }

    onSave(question)
  }

  const addOption = () => setSelectOptions([...selectOptions, { value: '', label: '' }])
  const removeOption = (index: number) => {
    if (selectOptions.length > 2) setSelectOptions(selectOptions.filter((_, i) => i !== index))
  }
  const updateOption = (index: number, field: 'value' | 'label', value: string) => {
    const updated = [...selectOptions]
    updated[index][field] = value
    setSelectOptions(updated)
  }

  const validOptions = isSelectType ? selectOptions.filter(opt => opt.value.trim() && opt.label.trim()) : []
  const canSave = (lockedQuestion || questionText.trim()) && (!isSelectType || validOptions.length >= 2)

  const handleKeyDown = useSubmitShortcut(handleSave, { disabled: !canSave || isSaving })

  // Render the selected type's icon + label inside the trigger.
  const selectedDef = useMemo(() => getScorecardTypeDef(answerType), [answerType])
  const SelectedIcon = selectedDef.icon

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
          {/* Question Type — matches the application-form "Add question" dropdown */}
          <div className="space-y-2">
            <Label htmlFor="answer-type">
              Question Type <span className="text-destructive">*</span>
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  id="answer-type"
                  type="button"
                  className="flex h-[var(--input-height)] w-full items-center justify-between rounded-brand border border-border bg-surface-primary px-3 py-2 text-sm ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30 transition-colors duration-150 hover:bg-[hsl(var(--menu-hover))]"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <SelectedIcon className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                    <span className="truncate">{selectedDef.label}</span>
                    {SCORECARD_SMART_FIELD_TYPES.has(answerType) && (
                      <Badge tone="lilac" size="xs">Smart</Badge>
                    )}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="w-[320px]">
                <DropdownMenuLabel className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-virgilio-purple" />
                  Smart fields
                </DropdownMenuLabel>
                {SCORECARD_SMART_FIELDS.map((sf) => {
                  const Icon = sf.icon
                  return (
                    <DropdownMenuItem key={sf.type} onSelect={() => handleTypeChange(sf.type)}>
                      <Icon className="h-3.5 w-3.5 text-text-tertiary" />
                      <span className="flex-1 truncate">{sf.label}</span>
                      <Badge tone="lilac" size="xs">Smart</Badge>
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Basic question types</DropdownMenuLabel>
                {SCORECARD_BASIC_TYPES.map((bt) => {
                  const Icon = bt.icon
                  return (
                    <DropdownMenuItem key={bt.type} onSelect={() => handleTypeChange(bt.type)}>
                      <Icon className="h-3.5 w-3.5 text-text-tertiary" />
                      <span className="flex-1 truncate">{bt.label}</span>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            {selectedDef.hint && (
              <p className="text-xs text-virgilio-muted">{selectedDef.hint}</p>
            )}
          </div>

          {/* Sync-to-profile banner (smart fields with a candidate target) */}
          {syncLabel && (
            <div className="space-y-3 p-4 bg-virgilio-purple/5 border border-virgilio-purple/20 rounded-lg">
              <div className="flex items-center gap-2 text-virgilio-purple">
                <RefreshCw className="h-4 w-4" />
                <span className="text-sm font-medium">{syncLabel}</span>
              </div>
              <div className="bg-white border border-virgilio-border/50 rounded-md p-3">
                <p className="text-sm text-virgilio-text font-medium mb-1">
                  "{lockedQuestion}"
                </p>
                <p className="text-xs text-virgilio-muted">
                  This question is pre-set. Answers will automatically update the candidate's profile.
                </p>
              </div>

              {isSalaryType && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="salary-currency">Currency</Label>
                    <CurrencySelect value={salaryCurrency} onChange={setSalaryCurrency} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salary-period">Period</Label>
                    <Select value={salaryPeriod} onValueChange={(v) => setSalaryPeriod(v as 'hourly' | 'monthly' | 'annually')}>
                      <SelectTrigger id="salary-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIODS.map(period => (
                          <SelectItem key={period.value} value={period.value}>{period.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Smart-but-no-sync banner (employment_type / work_location / recruiter) */}
          {isSmart && !syncLabel && lockedQuestion && (
            <div className="space-y-2 p-4 bg-virgilio-purple/5 border border-virgilio-purple/20 rounded-lg">
              <div className="flex items-center gap-2 text-virgilio-purple">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">Smart field</span>
              </div>
              <div className="bg-white border border-virgilio-border/50 rounded-md p-3">
                <p className="text-sm text-virgilio-text font-medium mb-1">"{lockedQuestion}"</p>
                <p className="text-xs text-virgilio-muted">
                  This question is pre-set. {selectedDef.hint}
                </p>
              </div>
            </div>
          )}

          {/* Free-form question text — hidden for smart fields */}
          {!isSmart && (
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

          {/* Notes for Interviewer */}
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
