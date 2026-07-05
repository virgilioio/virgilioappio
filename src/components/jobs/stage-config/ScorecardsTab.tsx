import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, MessageSquareText, AlertCircle, RefreshCw, Lock, Users, Sparkles, ClipboardCheck, Bell, Clock } from 'lucide-react'
import { useScorecardsConfiguration, type InterviewQuestion, type ScorecardVisibility, type ScorecardReminderCadence } from '@/hooks/useScorecardsConfiguration'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { InterviewQuestionForm } from './InterviewQuestionForm'
import { InterviewQuestionsList } from './InterviewQuestionsList'
import { ScorecardQuestionsGenerationPanel } from './ScorecardQuestionsGenerationPanel'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'

interface ScorecardsTabProps {
  jhsId: string
  jobId: string
  stageName: string
  stageType: string
}

export function ScorecardsTab({ jhsId, jobId, stageName, stageType }: ScorecardsTabProps) {
  const {
    template,
    isLoading,
    error,
    refetch,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    updateVisibility,
    updateRequirements,
  } = useScorecardsConfiguration(jhsId)
  const [isAddingMultiple, setIsAddingMultiple] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<InterviewQuestion | undefined>()

  const handleAddClick = () => {
    setEditingQuestion(undefined)
    setFormOpen(true)
  }

  const handleEditClick = (question: InterviewQuestion) => {
    setEditingQuestion(question)
    setFormOpen(true)
  }

  const handleSave = (question: Omit<InterviewQuestion, 'id'>) => {
    if (editingQuestion) {
      updateQuestion.mutate(
        { questionId: editingQuestion.id, updates: question },
        {
          onSuccess: () => {
            setFormOpen(false)
            setEditingQuestion(undefined)
          }
        }
      )
    } else {
      createQuestion.mutate(question, {
        onSuccess: () => {
          setFormOpen(false)
        }
      })
    }
  }

  const handleDelete = (questionId: string) => {
    deleteQuestion.mutate(questionId)
  }

  const handleReorder = (questionIds: string[]) => {
    reorderQuestions.mutate(questionIds)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error || !template) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load scorecard configuration</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>There was an error loading the interview questions. Please try again.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const nextDisplayOrder = template?.questions.length ? 
    Math.max(...template.questions.map(q => q.display_order)) + 1 : 1

  const handleAddMultipleQuestions = async (questions: Omit<InterviewQuestion, 'id'>[]) => {
    setIsAddingMultiple(true)
    try {
      for (const question of questions) {
        await createQuestion.mutateAsync(question)
      }
      toast.success(`Added ${questions.length} interview questions`)
    } catch (err) {
      console.error('Error adding questions:', err)
      toast.error('Failed to add some questions')
    } finally {
      setIsAddingMultiple(false)
    }
  }

  const isPublic = template?.visibility === 'public'

  const handleVisibilityToggle = (checked: boolean) => {
    const newVisibility: ScorecardVisibility = checked ? 'public' : 'private'
    updateVisibility.mutate(newVisibility)
  }

  return (
    <div className="space-y-6">
      <ScorecardRequirementsCard
        requireScorecard={template.requirements.requireScorecard}
        remindersEnabled={template.requirements.remindersEnabled}
        reminderCadence={template.requirements.reminderCadence}
        isPublic={isPublic}
        onToggleRequire={(v) => updateRequirements.mutate({ requireScorecard: v })}
        onToggleReminders={(v) => updateRequirements.mutate({ remindersEnabled: v })}
        onChangeCadence={(v) => updateRequirements.mutate({ reminderCadence: v })}
        onToggleVisibility={handleVisibilityToggle}
        visibilityDisabled={updateVisibility.isPending}
      />


      {/* AI Question Generator card */}
      <div
        className="flex items-center justify-between gap-4"
        style={{ background: '#FAF8FF', border: '1px solid #EDE4FF', borderRadius: 12, padding: 16 }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: 40, height: 40, background: '#EDE4FF', borderRadius: 10 }}
          >
            <Sparkles className="h-5 w-5" style={{ color: '#6F3FF5' }} />
          </div>
          <div className="min-w-0">
            <h4 className="font-poppins font-semibold" style={{ fontSize: 13, color: '#0d0d09' }}>
              AI question generator
            </h4>
            <p className="font-inter mt-0.5" style={{ fontSize: 12.5, color: '#5A6072' }}>
              Generate tailored interview questions for the "{stageName}" stage.
            </p>
          </div>
        </div>
      </div>

      <ScorecardQuestionsGenerationPanel
        jobId={jobId}
        stageName={stageName}
        stageType={stageType}
        existingQuestions={template?.questions || []}
        onAddQuestions={handleAddMultipleQuestions}
        isAdding={isAddingMultiple}
      />

      {/* Interview questions intro */}
      <section>
        <h3
          className="font-poppins font-semibold mb-2.5"
          style={{ fontSize: 12.5, color: '#8B8F9E', letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          Interview questions
        </h3>
        <div style={{ background: '#fff', border: '1px solid #E7E8EE', borderRadius: 12, padding: 16 }}>
          <p className="font-inter" style={{ fontSize: 12.5, color: '#5A6072' }}>
            Presented to interviewers when they submit scorecards for this stage — they standardize evaluation.
          </p>
          <div
            className="flex items-start gap-2 mt-3"
            style={{ background: '#FAF8FF', border: '1px solid #EDE4FF', borderRadius: 10, padding: 12 }}
          >
            <MessageSquareText className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#6F3FF5' }} />
            <p className="font-inter" style={{ fontSize: 12.5, color: '#5B21B6' }}>
              <strong>Note:</strong> All scorecards automatically include a "Key Takeaways" section with rich-text support for comprehensive notes.
            </p>
          </div>
        </div>
      </section>

      {/* Add Question Button */}
      <div className="flex justify-between items-center">
        <h4 className="font-poppins font-semibold" style={{ fontSize: 14, color: '#0d0d09' }}>
          Interview questions {template?.questions.length ? `(${template.questions.length})` : '(0)'}
        </h4>
        <Button onClick={handleAddClick} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Add interview question
        </Button>
      </div>

      {/* Questions List */}
      <InterviewQuestionsList
        questions={template?.questions || []}
        onReorder={handleReorder}
        onEdit={handleEditClick}
        onDelete={handleDelete}
      />

      {/* Question Form */}
      <InterviewQuestionForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditingQuestion(undefined)
        }}
        onSave={handleSave}
        existingQuestion={editingQuestion}
        nextDisplayOrder={nextDisplayOrder}
        isSaving={createQuestion.isPending || updateQuestion.isPending}
        jobId={jobId}
      />
    </div>
  )
}

// ============================================================================
// Scorecard requirements grouped card
// ============================================================================

interface RequirementsCardProps {
  requireScorecard: boolean
  remindersEnabled: boolean
  reminderCadence: ScorecardReminderCadence
  isPublic: boolean
  onToggleRequire: (v: boolean) => void
  onToggleReminders: (v: boolean) => void
  onChangeCadence: (v: ScorecardReminderCadence) => void
  onToggleVisibility: (v: boolean) => void
  visibilityDisabled?: boolean
}

function ScorecardRequirementsCard({
  requireScorecard,
  remindersEnabled,
  reminderCadence,
  isPublic,
  onToggleRequire,
  onToggleReminders,
  onChangeCadence,
  onToggleVisibility,
  visibilityDisabled,
}: RequirementsCardProps) {
  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <h3
          className="font-poppins font-semibold"
          style={{ fontSize: 13.5, color: '#0d0d09', letterSpacing: '-0.02em' }}
        >
          Scorecard requirements
        </h3>
        {requireScorecard && (
          <Badge tone="purple" size="xs" dot>
            Required to advance
          </Badge>
        )}
      </div>

      {/* Grouped card */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E7E8EE',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* Row 1 — Require scorecard */}
        <ToggleRow
          on={requireScorecard}
          onChange={onToggleRequire}
          Icon={ClipboardCheck}
          title="Require scorecard"
          badge={
            requireScorecard ? (
              <Badge tone="purple" size="xs">Required</Badge>
            ) : (
              <Badge tone="neutral" size="xs">Optional</Badge>
            )
          }
          description="Interviewers must submit a scorecard after the interview before the candidate can advance from this stage."
        />

        {/* Row 2 — Email reminders */}
        <ToggleRow
          on={remindersEnabled}
          onChange={onToggleReminders}
          Icon={Bell}
          title="Email reminders to interviewers"
          badge={remindersEnabled ? <Badge tone="purple" size="xs">On</Badge> : null}
          description={
            requireScorecard
              ? 'Email the interviewer(s) after the interview and keep reminding them until their scorecard is submitted.'
              : 'Email the interviewer(s) a reminder to submit their scorecard after the interview.'
          }
          topDivider
          extra={
            remindersEnabled ? (
              <CadenceStrip value={reminderCadence} onChange={onChangeCadence} />
            ) : null
          }
        />

        {/* Row 3 — Visibility */}
        <ToggleRow
          on={isPublic}
          onChange={onToggleVisibility}
          Icon={isPublic ? Users : Lock}
          title="Scorecard visibility"
          badge={
            isPublic ? (
              <Badge tone="green" size="xs">Shared</Badge>
            ) : (
              <Badge tone="neutral" size="xs">Private</Badge>
            )
          }
          description={
            isPublic
              ? 'Everyone on the hiring team can view scorecard responses for this stage.'
              : 'Only the interviewer who submitted and admins/recruiters can view scorecard responses.'
          }
          topDivider
          disabled={visibilityDisabled}
        />
      </div>
    </section>
  )
}

interface ToggleRowProps {
  on: boolean
  onChange: (v: boolean) => void
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  title: string
  badge?: React.ReactNode
  description: string
  topDivider?: boolean
  disabled?: boolean
  extra?: React.ReactNode
}

function ToggleRow({
  on,
  onChange,
  Icon,
  title,
  badge,
  description,
  topDivider,
  disabled,
  extra,
}: ToggleRowProps) {
  return (
    <div style={topDivider ? { borderTop: '1px solid #F1F0EC' } : undefined}>
      <div
        className="flex items-start gap-[13px]"
        style={{ padding: '14px 16px' }}
      >
        <div
          className="flex items-center justify-center shrink-0 transition-colors"
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: on ? '#EDE4FF' : '#F1F0EC',
          }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: on ? '#6F3FF5' : '#5A6072' }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-poppins font-semibold" style={{ fontSize: 13, color: '#1F2230' }}>
              {title}
            </h4>
            {badge}
          </div>
          <p
            className="font-inter mt-0.5"
            style={{ fontSize: 11.5, color: '#8B8F9E', lineHeight: 1.45 }}
          >
            {description}
          </p>
        </div>
        <Switch checked={on} onCheckedChange={onChange} disabled={disabled} />
      </div>
      {extra}
    </div>
  )
}

const CADENCE_OPTIONS: { value: ScorecardReminderCadence; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'every_2_days', label: 'Every 2 days' },
  { value: 'weekly', label: 'Weekly' },
]

function CadenceStrip({
  value,
  onChange,
}: {
  value: ScorecardReminderCadence
  onChange: (v: ScorecardReminderCadence) => void
}) {
  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      style={{
        background: '#FAFAF7',
        borderTop: '1px solid #F1F0EC',
        padding: '10px 16px 10px 20px',
      }}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: '#8B8F9E' }} />
      <span
        className="font-inter"
        style={{ fontSize: 12, color: '#5A6072' }}
      >
        Remind every
      </span>
      <div className="flex items-center gap-1.5 ml-1">
        {CADENCE_OPTIONS.map((opt) => {
          const active = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                'font-inter transition-colors',
                'rounded-full',
              )}
              style={{
                fontSize: 11.5,
                height: 24,
                padding: '0 10px',
                border: `1px solid ${active ? '#D7C5FB' : '#E7E8EE'}`,
                background: active ? '#EDE4FF' : '#fff',
                color: active ? '#5B21B6' : '#1F2230',
                fontWeight: active ? 600 : 500,
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

