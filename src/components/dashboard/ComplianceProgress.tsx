
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, Circle, Building, User, ExternalLink, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useOrganizationProgress } from '@/hooks/useOrganizationProgress'

export function ComplianceProgress() {
  const { profile } = useUserProfile()
  const organizationProgress = useOrganizationProgress()
  
  // Calculate profile progress
  const calculateProfileProgress = () => {
    if (!profile) return { progress: 0, isComplete: false, items: [] }
    
    const items = [
      {
        id: 'name',
        label: 'First & Last Name',
        completed: !!(profile.first_name && profile.last_name)
      },
      {
        id: 'contact',
        label: 'Phone & Timezone',
        completed: !!(profile.phone && profile.timezone)
      },
      {
        id: 'professional',
        label: 'Job Title',
        completed: !!profile.title
      },
      {
        id: 'avatar',
        label: 'Profile Picture',
        completed: !!profile.avatar_url
      }
    ]
    
    const completedItems = items.filter(item => item.completed)
    const progress = Math.round((completedItems.length / items.length) * 100)
    
    return {
      items,
      progress,
      isComplete: progress === 100
    }
  }
  
  const profileProgress = calculateProfileProgress()
  
  // Don't render if both are complete
  if (profileProgress.isComplete && organizationProgress.isComplete) {
    return null
  }
  
  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Info className="h-5 w-5 text-blue-500" />
          Setup Progress
        </CardTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            Compliance Required
          </Badge>
          <span>Complete your setup for full platform access</span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Profile Progress */}
        {!profileProgress.isComplete && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Profile Information</span>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {profileProgress.progress}%
              </span>
            </div>
            
            <Progress value={profileProgress.progress} className="h-2" />
            
            <div className="grid gap-2">
              {profileProgress.items.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  {item.completed ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <Circle className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className={item.completed ? 'text-muted-foreground' : 'text-foreground'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
            
            <Link to="/settings?tab=profile">
              <Button variant="outline" size="sm" className="w-full">
                Complete Profile
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        )}
        
        {/* Organization Progress */}
        {!organizationProgress.isComplete && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Organization Compliance</span>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {organizationProgress.progress}%
              </span>
            </div>
            
            <Progress value={organizationProgress.progress} className="h-2" />
            
            <div className="grid gap-2">
              {organizationProgress.items
                .filter(item => item.required)
                .map(item => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  {item.completed ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <Circle className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className={item.completed ? 'text-muted-foreground' : 'text-foreground'}>
                    {item.label}
                  </span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    Required
                  </Badge>
                </div>
              ))}
            </div>
            
            <Link to="/settings?tab=organization">
              <Button variant="outline" size="sm" className="w-full">
                Complete Organization Setup
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        )}
        
        {/* Legend */}
        <div className="pt-3 border-t border-border">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Why complete this?</p>
            <div className="grid gap-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span>Required for regulatory compliance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Enables job requests and full platform features</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                <span>Improves team collaboration experience</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
