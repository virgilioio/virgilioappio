import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, MessageSquareText, AlertCircle, RefreshCw, Lock, Globe, Sparkles } from 'lucide-react'
import { useScorecardsConfiguration, type InterviewQuestion, type ScorecardVisibility } from '@/hooks/useScorecardsConfiguration'
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
    updateVisibility
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
      {/* Visibility row */}
      <div
        className="flex items-center justify-between gap-4"
        style={{ background: '#fff', border: '1px solid #E7E8EE', borderRadius: 12, padding: 16 }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: 40, height: 40, background: '#F1F0EC', borderRadius: 10 }}
          >
            {isPublic ? (
              <Globe className="h-5 w-5" style={{ color: '#5A6072' }} />
            ) : (
              <Lock className="h-5 w-5" style={{ color: '#5A6072' }} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-poppins font-semibold" style={{ fontSize: 13, color: '#0d0d09' }}>
                Scorecard visibility
              </h4>
              <Badge tone="neutral" size="xs">{isPublic ? 'Public' : 'Private'}</Badge>
            </div>
            <p className="font-inter mt-0.5" style={{ fontSize: 12.5, color: '#5A6072' }}>
              {isPublic
                ? 'All team members with access to this job can view scorecard responses.'
                : 'Only the interviewer who submitted and admins/recruiters can view scorecard responses.'}
            </p>
          </div>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={handleVisibilityToggle}
          disabled={updateVisibility.isPending}
        />
      </div>

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
