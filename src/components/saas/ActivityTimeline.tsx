import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Briefcase, 
  Users, 
  UserPlus, 
  CreditCard, 
  Calendar, 
  ArrowRightLeft, 
  FileText, 
  MessageSquare,
  Mail,
  Upload,
  ClipboardCheck,
  Video,
  GitBranch,
  Settings,
  Star
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// Activity types from the database activities table
type ActivityType = 
  | 'job_created' 
  | 'job_updated' 
  | 'job_archived'
  | 'job_unarchived'
  | 'job_deleted'
  | 'candidate_added' 
  | 'candidate_created'
  | 'candidate_email_received'
  | 'candidate_updated'
  | 'candidate_assigned_to_job'
  | 'candidate_stage_changed'
  | 'candidate_status_changed'
  | 'candidate_note_added'
  | 'candidate_email_sent'
  | 'candidate_attachment_uploaded'
  | 'candidate_profile_updated'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'scorecard_submitted'
  | 'member_invited'
  | 'member_joined'
  | 'member_activated'
  | 'member_removed'
  | 'plan_changed'
  | 'sourcing_project_created'
  | 'sourcing_project_updated'
  | 'sourcing_search_completed'
  | 'sourcing_candidate_collected'
  | 'other'

interface Activity {
  id: string
  activity_type: ActivityType | string
  title: string
  description?: string | null
  timestamp?: string
  created_at?: string
}

interface ActivityTimelineProps {
  activities: Activity[]
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const getIcon = (type: Activity['activity_type']) => {
    switch (type) {
      case 'job_created':
      case 'job_updated':
      case 'job_archived':
      case 'job_unarchived':
      case 'job_deleted':
        return Briefcase
      case 'candidate_added':
      case 'candidate_created':
      case 'candidate_updated':
      case 'candidate_profile_updated':
        return Users
      case 'candidate_assigned_to_job':
        return UserPlus
      case 'candidate_stage_changed':
      case 'candidate_status_changed':
        return ArrowRightLeft
      case 'candidate_note_added':
        return MessageSquare
      case 'candidate_email_sent':
      case 'candidate_email_received':
        return Mail
      case 'candidate_attachment_uploaded':
        return Upload
      case 'interview_scheduled':
      case 'interview_completed':
        return Video
      case 'scorecard_submitted':
        return ClipboardCheck
      case 'member_invited':
      case 'member_joined':
      case 'member_activated':
      case 'member_removed':
        return UserPlus
      case 'plan_changed':
        return CreditCard
      case 'sourcing_project_created':
      case 'sourcing_project_updated':
        return GitBranch
      case 'sourcing_search_completed':
      case 'sourcing_candidate_collected':
        return Star
      default:
        return Calendar
    }
  }

  const getIconColor = (type: Activity['activity_type']) => {
    switch (type) {
      case 'job_created':
      case 'job_updated':
        return 'text-virgilio-purple bg-virgilio-purple/10'
      case 'job_archived':
      case 'job_deleted':
        return 'text-virgilio-muted bg-virgilio-muted/10'
      case 'job_unarchived':
        return 'text-virgilio-success bg-virgilio-success/10'
      case 'candidate_added':
      case 'candidate_created':
      case 'candidate_assigned_to_job':
        return 'text-virgilio-success bg-virgilio-success/10'
      case 'candidate_updated':
      case 'candidate_profile_updated':
        return 'text-blue-500 bg-blue-500/10'
      case 'candidate_stage_changed':
        return 'text-amber-500 bg-amber-500/10'
      case 'candidate_status_changed':
        return 'text-orange-500 bg-orange-500/10'
      case 'candidate_note_added':
        return 'text-slate-500 bg-slate-500/10'
      case 'candidate_email_sent':
      case 'candidate_email_received':
        return 'text-cyan-500 bg-cyan-500/10'
      case 'candidate_attachment_uploaded':
        return 'text-indigo-500 bg-indigo-500/10'
      case 'interview_scheduled':
      case 'interview_completed':
        return 'text-violet-500 bg-violet-500/10'
      case 'scorecard_submitted':
        return 'text-emerald-500 bg-emerald-500/10'
      case 'member_invited':
      case 'member_joined':
      case 'member_activated':
        return 'text-blue-500 bg-blue-500/10'
      case 'member_removed':
        return 'text-red-500 bg-red-500/10'
      case 'plan_changed':
        return 'text-orange-500 bg-orange-500/10'
      case 'sourcing_project_created':
      case 'sourcing_project_updated':
        return 'text-teal-500 bg-teal-500/10'
      case 'sourcing_search_completed':
      case 'sourcing_candidate_collected':
        return 'text-yellow-500 bg-yellow-500/10'
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
          {activities.map((activity) => {
            const Icon = getIcon(activity.activity_type as ActivityType)
            const iconColor = getIconColor(activity.activity_type as ActivityType)
            const timestamp = activity.timestamp || activity.created_at
            
            return (
              <div key={activity.id} className="flex gap-3">
                <div className={`flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${iconColor}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-virgilio-text font-medium">
                    {activity.title}
                  </p>
                  {activity.description && (
                    <p className="text-xs text-virgilio-muted mt-0.5 line-clamp-2">
                      {activity.description}
                    </p>
                  )}
                  {timestamp && (
                    <p className="text-xs text-virgilio-muted mt-0.5">
                      {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
