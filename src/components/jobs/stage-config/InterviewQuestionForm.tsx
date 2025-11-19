import { useState, useEffect } from 'react'
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
import { Plus, X } from 'lucide-react'
import type { InterviewQuestion, AnswerType, SelectOption } from '@/hooks/useScorecardsConfiguration'

interface InterviewQuestionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (question: Omit<InterviewQuestion, 'id'>) => void
  existingQuestion?: InterviewQuestion
  nextDisplayOrder: number
  isSaving: boolean
}

export function InterviewQuestionForm({
  open,
  onOpenChange,
  onSave,
  existingQuestion,
  nextDisplayOrder,
  isSaving
}: InterviewQuestionFormProps) {
  const [questionText, setQuestionText] = useState('')
  const [answerType, setAnswerType] = useState<AnswerType>('text')
  const [isRequired, setIsRequired] = useState(true)
  const [selectOptions, setSelectOptions] = useState<SelectOption[]>([
    { value: '', label: '' },
    { value: '', label: '' }
  ])

  useEffect(() => {
    if (existingQuestion) {
      setQuestionText(existingQuestion.question_text)
      setAnswerType(existingQuestion.answer_type)
      setIsRequired(existingQuestion.is_required)
      setSelectOptions(existingQuestion.select_options || [{ value: '', label: '' }, { value: '', label: '' }])
    } else {
      setQuestionText('')
      setAnswerType('text')
      setIsRequired(true)
      setSelectOptions([{ value: '', label: '' }, { value: '', label: '' }])
    }
  }, [existingQuestion, open])

  const handleSave = () => {
    if (!questionText.trim()) {
      return
    }

    if ((answerType === 'single_select' || answerType === 'multi_select')) {
      const validOptions = selectOptions.filter(opt => opt.value.trim() && opt.label.trim())
      if (validOptions.length < 2) {
        return
      }
    }

    const question: Omit<InterviewQuestion, 'id'> = {
      question_text: questionText.trim(),
      answer_type: answerType,
      is_required: isRequired,
      display_order: existingQuestion?.display_order || nextDisplayOrder,
      select_options: (answerType === 'single_select' || answerType === 'multi_select')
        ? selectOptions.filter(opt => opt.value.trim() && opt.label.trim())
        : undefined
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

  const isSelectType = answerType === 'single_select' || answerType === 'multi_select'
  const validOptions = isSelectType ? selectOptions.filter(opt => opt.value.trim() && opt.label.trim()) : []
  const canSave = questionText.trim() && (!isSelectType || validOptions.length >= 2)

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
          {/* Question Text */}
          <div className="space-y-2">
            <Label htmlFor="question-text">
              Question <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="question-text"
              placeholder="Enter the interview question..."
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
            />
          </div>

          {/* Answer Type */}
          <div className="space-y-2">
            <Label htmlFor="answer-type">
              Answer Type <span className="text-destructive">*</span>
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
              </SelectContent>
            </Select>
          </div>

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
