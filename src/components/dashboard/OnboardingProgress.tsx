
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { User, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { UserProfile } from '@/hooks/useUserProfile'

interface OnboardingProgressProps {
  profile: UserProfile | null
  isLoading: boolean
}

export function OnboardingProgress({ profile, isLoading }: OnboardingProgressProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    )
  }

  const calculateProgress = () => {
    if (!profile) return 0
    
    const fields = [
      profile.first_name,
      profile.last_name,
      profile.title,
      profile.phone,
      profile.timezone,
      profile.avatar_url
    ]
    
    const filledFields = fields.filter(field => field && field.trim()).length
    return Math.round((filledFields / fields.length) * 100)
  }

  const progress = calculateProgress()
  const isComplete = progress === 100

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Completion</span>
            <span className="text-sm font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {isComplete ? (
          <div className="text-sm text-success">
            ✅ Profile setup complete!
          </div>
        ) : (
          <div className="text-sm text-text-secondary">
            Complete your profile to unlock all features
          </div>
        )}
        
        <Button variant="outline" size="sm" asChild className="w-full gap-1">
          <Link to="/settings?tab=profile" className="flex items-center gap-1">
            {isComplete ? 'Edit Profile' : 'Complete Setup'}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
