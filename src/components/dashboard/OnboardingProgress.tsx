
import { ComplianceProgress } from './ComplianceProgress'
import { usePermissions } from '@/hooks/usePermissions'

interface OnboardingProgressProps {
  profile: any | null
  isLoading: boolean
}

export function OnboardingProgress({ profile, isLoading }: OnboardingProgressProps) {
  const permissions = usePermissions()
  
  if (isLoading) {
    return <ComplianceProgress />
  }

  // Only show to users who can manage organization settings
  if (!permissions.canManageOrganization && !permissions.isWorkspaceOwner && !permissions.isPlatformAdmin) {
    return null
  }

  return <ComplianceProgress />
}
