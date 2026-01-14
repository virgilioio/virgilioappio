import { format, formatDistanceToNow, isPast, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bell, Check, Clock, Edit2, Lock, MoreVertical, Trash2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CandidateReminder } from '@/hooks/useCandidateReminders'

interface ReminderCardProps {
  reminder: CandidateReminder
  onComplete: () => void
  onEdit: () => void
  onDelete: () => void
  isEditing?: boolean
}

export function ReminderCard({
  reminder,
  onComplete,
  onEdit,
  onDelete,
  isEditing
}: ReminderCardProps) {
  const dueDate = parseISO(reminder.due_at)
  const isPastDue = isPast(dueDate) && !reminder.completed_at
  const isCompleted = !!reminder.completed_at

  const getRelativeTime = () => {
    if (isPastDue) {
      return `Past due by ${formatDistanceToNow(dueDate)}`
    }
    return `Due ${formatDistanceToNow(dueDate, { addSuffix: true })}`
  }

  if (isEditing) {
    return null // Hide when editing (the form is shown separately)
  }

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-all",
        isPastDue && "border-destructive/50 bg-destructive/5",
        isCompleted && "opacity-60",
        !isPastDue && !isCompleted && "border-border bg-card hover:bg-accent"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Line 1: Subject + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{reminder.subject}</span>
            {isPastDue && (
              <Badge variant="destructive" className="text-xs shrink-0">
                Past Due
              </Badge>
            )}
            {reminder.is_team_visible ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Users className="h-3 w-3" />
                Team
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Lock className="h-3 w-3" />
                Personal
              </span>
            )}
          </div>

          {/* Line 2: Description (if present) */}
          {reminder.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {reminder.description}
            </p>
          )}

          {/* Line 3: Due date */}
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{format(dueDate, 'MMM d, h:mm a')}</span>
            <span>•</span>
            <span className={cn(isPastDue && "text-destructive font-medium")}>
              {getRelativeTime()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onComplete}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-success"
            title="Mark as complete"
          >
            <Check className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onComplete}>
                <Check className="h-4 w-4 mr-2" />
                Mark Complete
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
