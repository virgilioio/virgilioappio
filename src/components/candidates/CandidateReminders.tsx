import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell, Plus } from 'lucide-react'
import { useCandidateReminders, type CandidateReminder } from '@/hooks/useCandidateReminders'
import { ReminderCard } from './ReminderCard'
import { ReminderForm } from './ReminderForm'
import { InlineEmpty } from '@/components/ui/empty-state'

interface CandidateRemindersProps {
  candidateId: string
  jobId?: string | null
}

export function CandidateReminders({ candidateId, jobId }: CandidateRemindersProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<CandidateReminder | null>(null)
  
  const {
    reminders,
    isLoading,
    createReminder,
    updateReminder,
    completeReminder,
    deleteReminder,
    isCreating,
    isUpdating
  } = useCandidateReminders(candidateId, jobId)

  const handleCreate = (data: {
    subject: string
    description?: string
    due_at: string
    is_team_visible: boolean
  }) => {
    createReminder({
      candidate_id: candidateId,
      job_id: jobId,
      ...data
    })
    setIsFormOpen(false)
  }

  const handleUpdate = (data: {
    subject: string
    description?: string
    due_at: string
    is_team_visible: boolean
  }) => {
    if (!editingReminder) return
    updateReminder({
      id: editingReminder.id,
      ...data
    })
    setEditingReminder(null)
  }

  const handleEdit = (reminder: CandidateReminder) => {
    setEditingReminder(reminder)
    setIsFormOpen(false)
  }

  const handleCancelEdit = () => {
    setEditingReminder(null)
  }

  const handleCancelCreate = () => {
    setIsFormOpen(false)
  }

  if (isLoading) {
    return (
      <Card className="bg-surface-primary border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-text-secondary">Loading reminders...</div>
        </CardContent>
      </Card>
    )
  }

  // Empty state
  if (reminders.length === 0 && !isFormOpen && !editingReminder) {
    return (
      <Card className="bg-surface-primary border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InlineEmpty
            text="No reminders set."
            action="Add reminder"
            onAction={() => setIsFormOpen(true)}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-surface-primary border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Reminders
          </CardTitle>
          {!isFormOpen && !editingReminder && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsFormOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-6 space-y-4">
            {/* Create form */}
            {isFormOpen && (
              <ReminderForm
                onSubmit={handleCreate}
                onCancel={handleCancelCreate}
                isSubmitting={isCreating}
              />
            )}
            
            {/* Edit form */}
            {editingReminder && (
              <ReminderForm
                reminder={editingReminder}
                onSubmit={handleUpdate}
                onCancel={handleCancelEdit}
                isSubmitting={isUpdating}
              />
            )}
            
            {/* Reminder list */}
            {reminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onComplete={() => completeReminder(reminder.id)}
                onEdit={() => handleEdit(reminder)}
                onDelete={() => deleteReminder(reminder.id)}
                isEditing={editingReminder?.id === reminder.id}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
