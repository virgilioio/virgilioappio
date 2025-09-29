
import { Skeleton } from '@/components/ui/skeleton'
import { UserProfile } from '@/hooks/useUserProfile'
import { Hand } from 'lucide-react'

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
      <h1 className="text-4xl font-semibold text-text-primary mb-sm flex items-center gap-sm">
        Welcome back, {firstName}!
        <Hand className="w-8 h-8 text-text-primary" />
      </h1>
      <p className="text-sm text-text-secondary">
        Here's a quick overview of what's going on.
      </p>
    </div>
  )
}
