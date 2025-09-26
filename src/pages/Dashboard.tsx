
import { WelcomeHeader } from '@/components/dashboard/WelcomeHeader'
import { QuickAccess } from '@/components/dashboard/QuickAccess'
import { JobsOverview } from '@/components/dashboard/JobsOverview'
import { OnboardingProgress } from '@/components/dashboard/OnboardingProgress'

import { AIJobAssistant } from '@/components/dashboard/AIJobAssistant'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { Section } from '@/components/layout/Section'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function Dashboard() {
  const { profile, isLoading } = useUserProfile()
  const permissions = usePermissions()

  // Check what content will be visible - only platform admins can see billing
  const hasBillingContent = permissions.isPlatformAdmin
  const hasJobContent = permissions.canViewJobs || permissions.canCreateJobs
  const hasQuickAccess = permissions.canCreateJobs || permissions.canManageMembers
  const canManageOrganization = (permissions.canManageOrganization || permissions.isWorkspaceOwner || permissions.isPlatformAdmin) && !permissions.isGuest
  
  return (
    <div className="min-h-screen bg-background">
      <Section container className="py-6 sm:py-8 lg:py-12 animate-fade-in">
        <div className="space-y-6">
            <WelcomeHeader profile={profile} isLoading={isLoading} />

            {/* Trial banner */}
            <TrialBanner />
            
            {/* AI Job Assistant - Top Section */}
            {permissions.isPlatformAdmin && (
              <AIJobAssistant />
            )}
            
            {/* Adaptive layout based on available content */}
            {hasBillingContent ? (
              // Two column layout when billing content is available (never for guests)
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-6">
                  {hasQuickAccess && <QuickAccess permissions={permissions} />}
                  {hasJobContent && <JobsOverview permissions={permissions} />}
                </div>
                
                <div className="space-y-6">
                  {canManageOrganization && <OnboardingProgress profile={profile} isLoading={isLoading} />}
                </div>
              </div>
            ) : (
              // Single column layout when no billing content (including for guests)
            <div className="max-w-4xl mx-auto space-y-6">
              {canManageOrganization && <OnboardingProgress profile={profile} isLoading={isLoading} />}
                
                {/* Two column grid for remaining content */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-6">
                    {hasQuickAccess && <QuickAccess permissions={permissions} />}
                    {hasJobContent && <JobsOverview permissions={permissions} />}
                  </div>
                  <div className="space-y-6">
                    {/* Right column available for future content */}
                  </div>
                </div>
                
                {/* If only one of the two components is visible, center it */}
                {(hasQuickAccess && !hasJobContent) && (
                  <div className="max-w-md mx-auto">
                    {/* QuickAccess already rendered above, this is handled by the grid */}
                  </div>
                )}
                {(!hasQuickAccess && hasJobContent) && (
                  <div className="max-w-md mx-auto">
                    {/* JobsOverview already rendered above, this is handled by the grid */}
                  </div>
                )}
              </div>
            )}
        </div>
      </Section>
    </div>
  )
}

function TrialBanner() {
  // Subscription functionality removed
  return null
}
