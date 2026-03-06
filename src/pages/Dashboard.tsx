import { WelcomeHeader } from '@/components/dashboard/WelcomeHeader'
import { UpcomingActivities } from '@/components/dashboard/UpcomingActivities'
import { JobsOverview } from '@/components/dashboard/JobsOverview'
import { TrialCountdownBanner } from '@/components/dashboard/TrialCountdownBanner'
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist'
import { RecentSourcingProjects } from '@/components/dashboard/RecentSourcingProjects'
import { PendingActivities } from '@/components/dashboard/PendingActivities'
import { StaleCandidates } from '@/components/dashboard/StaleCandidates'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'
import { Section } from '@/components/layout/Section'
import { useOrgContext } from '@/contexts/OrgContext'
import { WorkspaceProvisioningLoader } from '@/components/onboarding/WorkspaceProvisioningLoader'
import { useSourcingProjects } from '@/hooks/useSourcingProjects'
import { useUserJobRoles } from '@/hooks/useUserJobRoles'

export default function Dashboard() {
  const { profile, isLoading } = useUserProfile()
  const permissions = usePermissions()
  const { isLoading: orgLoading, hasOrganizationContext } = useOrgContext()
  const { data: sourcingProjects } = useSourcingProjects()
  const { hasRecruiterRole, isPrivileged } = useUserJobRoles()
  
  // Fallback loader if context isn't ready
  if (orgLoading || !hasOrganizationContext) {
    return <WorkspaceProvisioningLoader status="finalizing" />
  }

  // Check what content will be visible - only platform admins can see billing
  const hasBillingContent = permissions.isPlatformAdmin
  const hasJobContent = permissions.canViewJobs || permissions.canCreateJobs
  const hasQuickAccess = permissions.canCreateJobs || permissions.canManageMembers
  const canManageOrganization = (permissions.canManageOrganization || permissions.isWorkspaceOwner || permissions.isPlatformAdmin)
  
  // Compute deemphasis state for checklist
  const hasSeenValue = (sourcingProjects?.length ?? 0) > 0
  
  // Show sourcing panel for Admin and above (members see it on job-level)
  const showSourcingPanel = isPrivileged || hasRecruiterRole
  
  return (
    <div>
      <Section container className="py-6 sm:py-8 lg:py-12 animate-fade-in">
        <div className="space-y-6">
          <WelcomeHeader profile={profile} isLoading={isLoading} />
          
          {/* Trial countdown banner */}
          <TrialCountdownBanner />
          
          {/* Layout: Two columns with 1:1 proportions */}
          <div className="grid gap-6 lg:grid-cols-2 overflow-hidden">
            {/* Left Column - Jobs & Searches */}
            <div className="space-y-6 min-w-0">
              <OnboardingChecklist isDeemphasized={!hasSeenValue} />
              {showSourcingPanel && <RecentSourcingProjects />}
              {hasJobContent && <JobsOverview permissions={permissions} />}
            </div>
            
            {/* Right Column - Tasks */}
            <div className="space-y-6 min-w-0">
              <UpcomingActivities />
              <PendingActivities />
              <StaleCandidates />
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}
