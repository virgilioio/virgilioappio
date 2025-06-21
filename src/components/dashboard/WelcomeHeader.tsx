
import { Skeleton } from '@/components/ui/skeleton'
import { UserProfile } from '@/hooks/useUserProfile'

interface WelcomeHeaderProps {
  profile: UserProfile | null
  isLoading: boolean
}

export function WelcomeHeader({ profile, isLoading }: WelcomeHeaderProps) {
  if (isLoading) {
    return (
      <div className="p-layout-md">
        <Skeleton className="h-6 w-48 mb-sm" />
        <Skeleton className="h-4 w-80" />
      </div>
    )
  }

  const firstName = profile?.first_name || 'there'

  return (
    <div className="p-layout-md">
      <h1 className="text-3xl font-semibold text-text-primary mb-sm">
        Hello, {firstName} 👋
      </h1>
      <p className="text-sm text-text-secondary">
        Here's a quick overview of what's going on.
      </p>
    </div>
  )
}
