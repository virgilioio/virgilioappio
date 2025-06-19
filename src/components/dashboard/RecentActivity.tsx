
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, Briefcase, UserPlus, FileText, DollarSign, CheckCircle } from 'lucide-react'
import { useActivities } from '@/hooks/useActivities'
import { formatDistanceToNow } from 'date-fns'

const getActivityIcon = (activityType: string) => {
  switch (activityType) {
    case 'job_created':
    case 'job_updated':
    case 'job_published':
    case 'job_archived':
      return Briefcase
    case 'member_invited':
    case 'member_joined':
      return UserPlus
    case 'job_request_created':
    case 'job_request_approved':
    case 'job_request_rejected':
      return FileText
    case 'invoice_created':
    case 'invoice_paid':
      return DollarSign
    case 'candidate_added':
      return CheckCircle
    default:
      return Clock
  }
}

const getActivityColor = (activityType: string) => {
  switch (activityType) {
    case 'job_created':
    case 'job_published':
      return 'text-green-600'
    case 'job_updated':
      return 'text-blue-600'
    case 'job_archived':
      return 'text-gray-600'
    case 'member_invited':
    case 'member_joined':
      return 'text-purple-600'
    case 'job_request_approved':
    case 'invoice_paid':
      return 'text-green-600'
    case 'job_request_rejected':
      return 'text-red-600'
    case 'job_request_created':
    case 'invoice_created':
      return 'text-orange-600'
    case 'candidate_added':
      return 'text-blue-600'
    default:
      return 'text-gray-600'
  }
}

export function RecentActivity() {
  const { data: activities, isLoading } = useActivities(5)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!activities || activities.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <Clock className="h-12 w-12 mx-auto mb-4 text-text-tertiary" />
            <h3 className="font-medium mb-2">No recent activity</h3>
            <p className="text-sm">
              Activity will appear here as you use the platform
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = getActivityIcon(activity.activity_type)
              const colorClass = getActivityColor(activity.activity_type)
              
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={`p-2 rounded-full bg-muted ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {activity.title}
                    </p>
                    {activity.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {activity.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
