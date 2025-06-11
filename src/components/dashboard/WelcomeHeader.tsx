
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { UserProfile } from '@/hooks/useUserProfile'

interface WelcomeHeaderProps {
  profile: UserProfile | null
  isLoading: boolean
}

export function WelcomeHeader({ profile, isLoading }: WelcomeHeaderProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-80" />
        </CardContent>
      </Card>
    )
  }

  const firstName = profile?.first_name || 'there'

  return (
    <Card>
      <CardContent className="p-6">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">
          Hello, {firstName} 👋
        </h1>
        <p className="text-text-secondary">
          Here's a quick overview of what's going on.
        </p>
      </CardContent>
    </Card>
  )
}
