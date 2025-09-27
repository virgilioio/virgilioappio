
import { WelcomeHeader } from '@/components/dashboard/WelcomeHeader'
import { QuickAccess } from '@/components/dashboard/QuickAccess'
import { JobsOverview } from '@/components/dashboard/JobsOverview'


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
    <div>
      <Section container className="py-6 sm:py-8 lg:py-12 animate-fade-in">
        <div className="space-y-6">
            <WelcomeHeader profile={profile} isLoading={isLoading} />

            {/* Trial banner */}
            <TrialBanner />
            
            {/* AI Job Assistant - Top Section */}
            {permissions.isPlatformAdmin && (
              <AIJobAssistant />
            )}
            
            {/* Three column layout with Jobs Overview spanning 2 columns */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Jobs Overview - spans 2 columns */}
              {hasJobContent && (
                <div className="lg:col-span-2">
                  <JobsOverview permissions={permissions} />
                </div>
              )}
              
              {/* Right column for other components */}
              <div className="space-y-6">
                {hasQuickAccess && <QuickAccess permissions={permissions} />}
                
              </div>
            </div>
        </div>
      </Section>
    </div>
  )
}

function TrialBanner() {
  // Subscription functionality removed
  return null
}
