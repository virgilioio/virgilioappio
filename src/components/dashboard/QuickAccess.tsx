
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
            <Link key={action.action} to={action.href}>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start h-10"
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </Button>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
