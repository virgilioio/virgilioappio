import { useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { usePendingActivities, PendingActivity } from '@/hooks/usePendingActivities'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function groupByDate(items: PendingActivity[]): { label: string; items: PendingActivity[] }[] {
  const today: PendingActivity[] = []
  const yesterday: PendingActivity[] = []
  const earlier: PendingActivity[] = []

  for (const item of items) {
    const date = new Date(item.timestamp)
    if (isToday(date)) today.push(item)
    else if (isYesterday(date)) yesterday.push(item)
    else earlier.push(item)
  }

  return [
    { label: 'Today', items: today },
    { label: 'Yesterday', items: yesterday },
    { label: 'Earlier', items: earlier },
  ].filter((g) => g.items.length > 0)
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { data: activities, markEmailAsRead } = usePendingActivities()

  const notifications = (activities || []).filter(
    (a): a is PendingActivity => a.type === 'email' || a.type === 'offer_approval'
  )

  const unreadCount = notifications.length

  const handleNotificationClick = (notification: PendingActivity) => {
    setOpen(false)
    if (notification.type === 'email' && notification.emailId) {
      markEmailAsRead.mutate(notification.emailId)
    }
    if (notification.type === 'offer_approval') {
      navigate(`/jobs/${notification.jobId}?candidate=${notification.candidateId}&tab=offer`)
    } else {
      navigate(`/candidates?openCandidate=${notification.candidateId}`)
    }
  }

  const handleMarkAllAsRead = () => {
    notifications.forEach((n) => {
      if (n.type === 'email' && n.emailId) {
        markEmailAsRead.mutate(n.emailId)
      }
    })
  }

  const groups = groupByDate(notifications)

  return (
    <Popover modal={true} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[440px] p-0 shadow-calendly border-virgilio-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-virgilio-border">
          <div className="flex items-center gap-2">
            <h3 className="font-poppins font-semibold text-sm text-virgilio-text">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs font-poppins text-virgilio-purple hover:text-virgilio-purple/80 transition-colors font-medium"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notification List */}
        {unreadCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <BellOff className="h-8 w-8 text-virgilio-muted mb-3" />
            <p className="text-sm font-poppins font-medium text-virgilio-text">
              All caught up!
            </p>
            <p className="text-xs text-virgilio-muted mt-1">
              No new notifications right now
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[420px]">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="sticky top-0 z-10 bg-popover px-4 py-2">
                  <span className="text-[11px] font-poppins font-semibold uppercase tracking-wider text-virgilio-muted">
                    {group.label}
                  </span>
                </div>
                <div className="divide-y divide-virgilio-border">
                  {group.items.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className="w-full text-left px-4 py-4 hover:bg-virgilio-purple/10 transition-colors duration-150 focus:outline-none focus:bg-virgilio-purple/10"
                    >
                      <div className="flex gap-3 items-start">
                        {/* Unread dot */}
                        <div className="flex items-center pt-3.5 shrink-0">
                          <div className="h-2 w-2 rounded-full bg-virgilio-purple" />
                        </div>

                        {/* Avatar */}
                        <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                          <AvatarFallback
                            className={
                              notification.type === 'offer_approval'
                                ? 'bg-accent text-accent-foreground text-xs font-semibold'
                                : 'bg-virgilio-purple text-white text-xs font-semibold'
                            }
                          >
                            {getInitials(notification.candidateName)}
                          </AvatarFallback>
                        </Avatar>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-poppins font-semibold text-virgilio-text truncate">
                              {notification.type === 'offer_approval'
                                ? 'Offer approval needed'
                                : notification.candidateName}
                            </span>
                            <span className="text-[11px] text-virgilio-muted whitespace-nowrap shrink-0">
                              {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-xs text-virgilio-text truncate">
                            {notification.type === 'offer_approval'
                              ? `Approve offer for ${notification.candidateName}`
                              : notification.emailSubject || 'No subject'}
                          </p>
                          {notification.type === 'email' && notification.emailSnippet && (
                            <p className="text-xs text-virgilio-muted truncate">
                              {notification.emailSnippet}
                            </p>
                          )}
                          {notification.jobTitle && (
                            <Badge variant="outline" className="text-[10px] mt-1 px-1.5 py-0">
                              {notification.jobTitle}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
