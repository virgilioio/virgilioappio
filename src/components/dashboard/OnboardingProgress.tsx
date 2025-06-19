
import { ComplianceProgress } from './ComplianceProgress'

interface OnboardingProgressProps {
  profile: any | null
  isLoading: boolean
}

export function OnboardingProgress({ profile, isLoading }: OnboardingProgressProps) {
  if (isLoading) {
    return <ComplianceProgress />
  }

  return <ComplianceProgress />
}
