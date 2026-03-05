import { useState } from 'react'
import { Bell, Mail, BellOff, ClipboardCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { usePendingActivities, PendingActivity } from '@/hooks/usePendingActivities'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { Separator } from '@/components/ui/separator'

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
    emailNotifications.forEach((n) => {
      if (n.emailId) {
        markEmailAsRead.mutate(n.emailId)
      }
    })
  }

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
        className="w-96 p-0 shadow-calendly border-virgilio-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-virgilio-border">
          <h3 className="font-poppins font-semibold text-sm text-virgilio-text">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} new
            </Badge>
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
          <>
            <div className="overflow-y-auto max-h-80">
              <div className="divide-y divide-virgilio-border">
                {emailNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="w-full text-left px-4 py-3 hover:bg-virgilio-purple/10 transition-colors duration-150 focus:outline-none focus:bg-virgilio-purple/10"
                  >
                    <div className="flex gap-3 items-start">
                      <div className="mt-0.5 shrink-0">
                        <Mail className="h-3.5 w-3.5 text-virgilio-muted" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-poppins font-semibold text-virgilio-text truncate">
                            {notification.candidateName}
                          </span>
                          <span className="text-[11px] text-virgilio-muted whitespace-nowrap shrink-0">
                            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-virgilio-text truncate">
                          {notification.emailSubject || 'No subject'}
                        </p>
                        {notification.emailSnippet && (
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
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs font-poppins text-virgilio-muted hover:text-virgilio-text"
                onClick={handleMarkAllAsRead}
              >
                Mark all as read
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
