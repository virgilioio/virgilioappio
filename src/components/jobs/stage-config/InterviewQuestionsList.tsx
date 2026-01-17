import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { GripVertical, Edit, Trash2, Type, CheckCircle2, List, ListChecks, DollarSign, Link2, MessageSquare } from 'lucide-react'
import type { InterviewQuestion } from '@/hooks/useScorecardsConfiguration'
import { cn } from '@/lib/utils'

interface InterviewQuestionsListProps {
  questions: InterviewQuestion[]
  onReorder: (questionIds: string[]) => void
  onEdit: (question: InterviewQuestion) => void
  onDelete: (questionId: string) => void
}

function SortableQuestionItem({
  question,
  onEdit,
  onDelete
}: {
  question: InterviewQuestion
  onEdit: (question: InterviewQuestion) => void
  onDelete: (questionId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const getAnswerTypeIcon = () => {
    switch (question.answer_type) {
      case 'text':
        return <Type className="h-4 w-4" />
      case 'yes_no':
        return <CheckCircle2 className="h-4 w-4" />
      case 'single_select':
        return <List className="h-4 w-4" />
      case 'multi_select':
        return <ListChecks className="h-4 w-4" />
      case 'salary_expectations':
        return <DollarSign className="h-4 w-4" />
    }
  }

  const getAnswerTypeLabel = () => {
    switch (question.answer_type) {
      case 'text':
        return 'Text'
      case 'yes_no':
        return 'Yes/No'
      case 'single_select':
        return 'Single Select'
      case 'multi_select':
        return 'Multi Select'
      case 'salary_expectations':
        return 'Salary Expectations'
    }
  }

  const isSalaryType = question.answer_type === 'salary_expectations'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-start gap-3 p-4 bg-white border border-virgilio-border rounded-lg',
        'hover:border-virgilio-purple/50 transition-all duration-200',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-virgilio-muted hover:text-virgilio-text mt-1"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-virgilio-text">{question.question_text}</p>
        
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant="outline" className={cn(
            "text-xs border-virgilio-purple/30",
            isSalaryType ? "bg-green-500/10 text-green-700 border-green-300" : "bg-virgilio-purple/10 text-virgilio-purple"
          )}>
            {getAnswerTypeIcon()}
            <span className="ml-1">{getAnswerTypeLabel()}</span>
          </Badge>
          
          {question.is_required && (
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-300">
              Required
            </Badge>
          )}
          
          {isSalaryType && (
            <>
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-300 gap-1">
                <Link2 className="h-3 w-3" />
                Syncs to Profile
              </Badge>
              {question.salary_config && (
                <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                  {question.salary_config.currency} / {question.salary_config.period}
                </Badge>
              )}
            </>
          )}
        </div>

        {question.notes_for_interviewer && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-virgilio-muted">
            <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{question.notes_for_interviewer}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(question)}
          className="hover:bg-virgilio-purple/10 hover:text-virgilio-purple"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(question.id)}
          className="hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function InterviewQuestionsList({
  questions,
  onReorder,
  onEdit,
  onDelete
}: InterviewQuestionsListProps) {
  const [items, setItems] = useState(questions)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)

      const newItems = arrayMove(items, oldIndex, newIndex)
      setItems(newItems)
      onReorder(newItems.map(item => item.id))
    }
  }

  const handleDeleteClick = (questionId: string) => {
    setQuestionToDelete(questionId)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (questionToDelete) {
      onDelete(questionToDelete)
      setQuestionToDelete(null)
      setDeleteDialogOpen(false)
    }
  }

  // Sync items with questions prop when it changes
  if (questions !== items) {
    setItems(questions)
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 px-4 border-2 border-dashed border-virgilio-border rounded-lg bg-surface-secondary">
        <Type className="h-12 w-12 mx-auto text-virgilio-muted mb-3" />
        <h3 className="text-lg font-semibold text-virgilio-text mb-2">No Interview Questions Yet</h3>
        <p className="text-sm text-virgilio-muted mb-4 max-w-md mx-auto">
          Start building your scorecard by adding interview questions. Questions will be displayed to interviewers when they submit their scorecards.
        </p>
      </div>
    )
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map(item => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {items.map((question) => (
              <SortableQuestionItem
                key={question.id}
                question={question}
                onEdit={onEdit}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Interview Question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the interview question. Any responses to this question in existing scorecards will remain, but the question will not appear for new scorecards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Question
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}