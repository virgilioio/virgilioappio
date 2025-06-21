
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { CheckCircle, Circle, Building, User, ExternalLink } from 'lucide-react'
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
    <Card className="border-l-2 border-l-blue-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Setup Progress
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Simplified Progress Overview */}
        <div className="space-y-3">
          {/* Profile Progress */}
          {!profileProgress.isComplete && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium">Profile</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {profileProgress.progress}%
                </span>
              </div>
              <Progress value={profileProgress.progress} className="h-1.5" />
            </div>
          )}
          
          {/* Organization Progress */}
          {!organizationProgress.isComplete && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium">Organization</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {organizationProgress.progress}%
                </span>
              </div>
              <Progress value={organizationProgress.progress} className="h-1.5" />
            </div>
          )}
        </div>
        
        {/* Simplified Action Buttons */}
        <div className="flex gap-2">
          {!profileProgress.isComplete && (
            <Link to="/settings?tab=profile" className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs h-7">
                <User className="h-3 w-3 mr-1" />
                Profile
              </Button>
            </Link>
          )}
          
          {!organizationProgress.isComplete && (
            <Link to="/settings?tab=organization" className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs h-7">
                <Building className="h-3 w-3 mr-1" />
                Organization
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
