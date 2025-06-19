
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5 text-blue-500" />
            Setup Progress
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Compliance Required
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Complete your setup for full platform access and job requests
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Progress Overview */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Profile Progress */}
          {!profileProgress.isComplete && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Profile</span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {profileProgress.progress}%
                </span>
              </div>
              <Progress value={profileProgress.progress} className="h-2" />
              
              <div className="space-y-1">
                {profileProgress.items.slice(0, 2).map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-xs">
                    {item.completed ? (
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={item.completed ? 'text-muted-foreground line-through' : 'text-foreground'}>
                      {item.label}
                    </span>
                  </div>
                ))}
                {profileProgress.items.length > 2 && (
                  <p className="text-xs text-muted-foreground pl-5">
                    +{profileProgress.items.length - 2} more items
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Organization Progress */}
          {!organizationProgress.isComplete && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Organization</span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {organizationProgress.progress}%
                </span>
              </div>
              <Progress value={organizationProgress.progress} className="h-2" />
              
              <div className="space-y-1">
                {organizationProgress.items
                  .filter(item => item.required)
                  .slice(0, 2)
                  .map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-xs">
                    {item.completed ? (
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={item.completed ? 'text-muted-foreground line-through' : 'text-foreground'}>
                      {item.label}
                    </span>
                  </div>
                ))}
                {organizationProgress.items.filter(item => item.required).length > 2 && (
                  <p className="text-xs text-muted-foreground pl-5">
                    +{organizationProgress.items.filter(item => item.required).length - 2} more items
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          {!profileProgress.isComplete && (
            <Link to="/settings?tab=profile" className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                <User className="h-3 w-3 mr-2" />
                Complete Profile
                <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
            </Link>
          )}
          
          {!organizationProgress.isComplete && (
            <Link to="/settings?tab=organization" className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                <Building className="h-3 w-3 mr-2" />
                Complete Organization
                <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
            </Link>
          )}
        </div>
        
        {/* Compliance Benefits */}
        <div className="pt-3 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Benefits of completion:</p>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
              <span>Regulatory compliance for job requests</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
              <span>Full platform features and capabilities</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0" />
              <span>Enhanced team collaboration experience</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
