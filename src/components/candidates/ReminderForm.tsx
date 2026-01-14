import { useState } from 'react'
import { addHours } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, X } from 'lucide-react'
import { ReminderDateTimePicker } from './ReminderDateTimePicker'
import type { CandidateReminder } from '@/hooks/useCandidateReminders'

interface ReminderFormProps {
  reminder?: CandidateReminder
  onSubmit: (data: {
    subject: string
    description?: string
    due_at: string
    is_team_visible: boolean
  }) => void
  onCancel: () => void
  isSubmitting?: boolean
}

export function ReminderForm({
  reminder,
  onSubmit,
  onCancel,
  isSubmitting
}: ReminderFormProps) {
  const isEditing = !!reminder

  // Default to 1 hour from now for new reminders
  const defaultDueAt = reminder?.due_at 
    ? new Date(reminder.due_at)
    : addHours(new Date(), 1)

  const [subject, setSubject] = useState(reminder?.subject || '')
  const [description, setDescription] = useState(reminder?.description || '')
  const [dueAt, setDueAt] = useState<Date>(defaultDueAt)
  const [isTeamVisible, setIsTeamVisible] = useState(reminder?.is_team_visible ?? false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!subject.trim()) return

    onSubmit({
      subject: subject.trim(),
      description: description.trim() || undefined,
      due_at: dueAt.toISOString(),
      is_team_visible: isTeamVisible
    })
  }

  return (
    <Card className="bg-white border border-virgilio-border shadow-calendly">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              {isEditing ? 'Edit Reminder' : 'New Reminder'}
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="reminder-subject" className="text-xs">
                Subject <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reminder-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Follow up on references"
                className="h-9"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reminder-description" className="text-xs">
                Description (optional)
              </Label>
              <Textarea
                id="reminder-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add any additional notes..."
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reminder-due-at" className="text-xs">
                Due Date & Time <span className="text-destructive">*</span>
              </Label>
              <ReminderDateTimePicker
                value={dueAt}
                onChange={setDueAt}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="team-visible" className="text-xs font-medium">
                  Team Visible
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isTeamVisible 
                    ? 'Visible to your hiring team' 
                    : 'Only visible to you'}
                </p>
              </div>
              <Switch
                id="team-visible"
                checked={isTeamVisible}
                onCheckedChange={setIsTeamVisible}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="submit"
              size="sm"
              disabled={!subject.trim() || isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Reminder'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
