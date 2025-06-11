
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, UserPlus, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PermissionsState } from '@/hooks/usePermissions'

interface QuickAccessProps {
  permissions: PermissionsState
}

export function QuickAccess({ permissions }: QuickAccessProps) {
  const quickActions = []

  if (permissions.canCreateJobs) {
    quickActions.push({
      label: 'Create New Job',
      href: '/jobs',
      icon: Plus,
      action: 'create'
    })
  }

  if (permissions.canRequestJobs && !permissions.canCreateJobs) {
    quickActions.push({
      label: 'Request New Job',
      href: '/job-requests',
      icon: Plus,
      action: 'request'
    })
  }

  if (permissions.canManageMembers) {
    quickActions.push({
      label: 'Invite Member',
      href: '/members',
      icon: UserPlus,
      action: 'invite'
    })
  }

  if (quickActions.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <Button 
              key={action.action}
              variant="outline" 
              size="sm" 
              asChild 
              className="w-full justify-start gap-2 h-10"
            >
              <Link to={action.href} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {action.label}
              </Link>
            </Button>
          )
        })}
      </CardContent>
    </Card>
  )
}
