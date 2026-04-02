import { WelcomeHeader } from '@/components/dashboard/WelcomeHeader'
import { UpcomingActivities } from '@/components/dashboard/UpcomingActivities'
import { JobsOverview } from '@/components/dashboard/JobsOverview'
import { TrialCountdownBanner } from '@/components/dashboard/TrialCountdownBanner'
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist'

import { TasksOverview } from '@/components/dashboard/TasksOverview'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'
import { Section } from '@/components/layout/Section'
import { useOrgContext } from '@/contexts/OrgContext'
import { WorkspaceProvisioningLoader } from '@/components/onboarding/WorkspaceProvisioningLoader'
import { useSourcingProjects } from '@/hooks/useSourcingProjects'
import { useUserJobRoles } from '@/hooks/useUserJobRoles'
import { ApplicationReviewCard } from '@/components/dashboard/ApplicationReviewCard'

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
  
  
  return (
    <div>
      <Section container className="py-6 sm:py-8 lg:py-12 animate-fade-in">
        <div className="space-y-6">
          <WelcomeHeader profile={profile} isLoading={isLoading} />
          
          {/* Trial countdown banner */}
          <TrialCountdownBanner />
          
          {/* Layout: Two columns with 1:1 proportions */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 overflow-hidden">
            {/* Col 1 — Application Review + Jobs */}
            <div className="space-y-6 min-w-0">
              <OnboardingChecklist isDeemphasized={!hasSeenValue} />
              
              {hasJobContent && <ApplicationReviewCard />}
              {hasJobContent && <div className="hidden sm:block"><JobsOverview permissions={permissions} /></div>}
            </div>
            
            {/* Col 2 — Tasks */}
            <div className="space-y-6 min-w-0">
              <TasksOverview />
            </div>
            
            {/* Col 3 — Agenda / Calendar */}
            <div className="space-y-6 min-w-0 md:col-span-2 xl:col-span-1">
              <UpcomingActivities />
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}
