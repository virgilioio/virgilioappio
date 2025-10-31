import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Briefcase, Users, UserPlus, CreditCard, Calendar } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Activity {
  id: string
  type: 'job_created' | 'candidate_added' | 'member_joined' | 'plan_changed' | 'other'
  description: string
  timestamp: string
}

interface ActivityTimelineProps {
  activities: Activity[]
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const getIcon = (type: Activity['type']) => {
    switch (type) {
      case 'job_created':
        return Briefcase
      case 'candidate_added':
        return Users
      case 'member_joined':
        return UserPlus
      case 'plan_changed':
        return CreditCard
      default:
        return Calendar
    }
  }

  const getIconColor = (type: Activity['type']) => {
    switch (type) {
      case 'job_created':
        return 'text-virgilio-purple bg-virgilio-purple/10'
      case 'candidate_added':
        return 'text-virgilio-success bg-virgilio-success/10'
      case 'member_joined':
        return 'text-blue-500 bg-blue-500/10'
      case 'plan_changed':
        return 'text-orange-500 bg-orange-500/10'
      default:
        return 'text-virgilio-muted bg-virgilio-muted/10'
    }
  }

  if (activities.length === 0) {
    return (
      <Card className="shadow-calendly border-virgilio-border">
        <CardHeader>
          <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
            Recent Activity<span className="text-virgilio-purple">.</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-virgilio-muted">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No recent activity to display</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-calendly border-virgilio-border">
      <CardHeader>
        <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
          Recent Activity<span className="text-virgilio-purple">.</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const Icon = getIcon(activity.type)
            const iconColor = getIconColor(activity.type)
            
            return (
              <div key={activity.id} className="flex gap-3">
                <div className={`flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${iconColor}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-virgilio-text font-medium">
                    {activity.description}
                  </p>
                  <p className="text-xs text-virgilio-muted mt-0.5">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
