import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, MessageSquareText, AlertCircle, RefreshCw, Lock, Globe } from 'lucide-react'
import { useScorecardsConfiguration, type InterviewQuestion, type ScorecardVisibility } from '@/hooks/useScorecardsConfiguration'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
    reorderQuestions
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

  return (
    <div className="space-y-6">
      {/* AI Question Generator */}
      <ScorecardQuestionsGenerationPanel
        jobId={jobId}
        stageName={stageName}
        stageType={stageType}
        existingQuestions={template?.questions || []}
        onAddQuestions={handleAddMultipleQuestions}
        isAdding={isAddingMultiple}
      />

      {/* Header Info */}
      <div className="bg-gradient-to-b from-virgilio-purple/5 to-transparent border border-virgilio-border/50 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="bg-virgilio-purple/10 p-3 rounded-lg">
            <MessageSquareText className="h-6 w-6 text-virgilio-purple" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-virgilio-text mb-2">
              Interview Questions
            </h3>
            <p className="text-sm text-virgilio-muted mb-3">
              Configure interview questions that will be presented to interviewers when they submit scorecards for this stage. These questions help standardize the evaluation process.
            </p>
            <div className="bg-white border border-virgilio-border/30 rounded-md p-3">
              <p className="text-xs text-virgilio-muted">
                <strong className="text-virgilio-text">Note:</strong> All scorecards automatically include a "Key Takeaways" section with rich text support for comprehensive notes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Question Button */}
      <div className="flex justify-between items-center">
        <h4 className="text-base font-semibold text-virgilio-text">
          Interview Questions {template?.questions.length ? `(${template.questions.length})` : ''}
        </h4>
        <Button onClick={handleAddClick} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Interview Question
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
