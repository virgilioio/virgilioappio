
import { useState, useEffect } from 'react'
import { WelcomeHeader } from '@/components/dashboard/WelcomeHeader'
import { MyInterviews } from '@/components/dashboard/MyInterviews'
import { JobsOverview } from '@/components/dashboard/JobsOverview'
import { TrialCountdownBanner } from '@/components/dashboard/TrialCountdownBanner'
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'
import { Section } from '@/components/layout/Section'
import { useOrgContext } from '@/contexts/OrgContext'
import { WorkspaceProvisioningLoader } from '@/components/onboarding/WorkspaceProvisioningLoader'

export default function Dashboard() {
  const { profile, isLoading } = useUserProfile()
  const permissions = usePermissions()
  const { isLoading: orgLoading, hasOrganizationContext } = useOrgContext()
  const [showWelcome, setShowWelcome] = useState(false)
  
  // Handle post-onboarding welcome flow
  useEffect(() => {
    const welcomePhase = sessionStorage.getItem('virgilio_show_welcome')
    
    if (welcomePhase === 'phase1') {
      // Update to phase2 before refresh (sessionStorage survives reload)
      sessionStorage.setItem('virgilio_show_welcome', 'phase2')
      
      // Trigger refresh to ensure all components initialize properly
      window.location.reload()
    } else if (welcomePhase === 'phase2') {
      // After refresh, show welcome message
      setShowWelcome(true)
      
      // Clear flag and hide welcome after 2.5 seconds
      setTimeout(() => {
        sessionStorage.removeItem('virgilio_show_welcome')
        setShowWelcome(false)
      }, 2500)
    }
  }, [])
  
  // Show welcome loader after onboarding
  if (showWelcome) {
    return <WorkspaceProvisioningLoader status="welcome" />
  }
  
  // Fallback loader if context isn't ready
  if (orgLoading || !hasOrganizationContext) {
    return <WorkspaceProvisioningLoader status="finalizing" />
  }

  // Check what content will be visible - only platform admins can see billing
  const hasBillingContent = permissions.isPlatformAdmin
  const hasJobContent = permissions.canViewJobs || permissions.canCreateJobs
  const hasQuickAccess = permissions.canCreateJobs || permissions.canManageMembers
  const canManageOrganization = (permissions.canManageOrganization || permissions.isWorkspaceOwner || permissions.isPlatformAdmin)
  
  return (
    <div>
      <Section container className="py-6 sm:py-8 lg:py-12 animate-fade-in">
        <div className="space-y-6">
          <WelcomeHeader profile={profile} isLoading={isLoading} />
          
          {/* Trial countdown banner */}
          <TrialCountdownBanner />
          
          {/* Layout: Onboarding on left, content on right */}
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            {/* Onboarding Checklist - Left Column */}
            <div>
              <OnboardingChecklist />
            </div>
            
            {/* Main Content - Right Column */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Jobs Overview */}
              {hasJobContent && (
                <div>
                  <JobsOverview permissions={permissions} />
                </div>
              )}
              
              {/* My Interviews */}
              <div className="space-y-6">
                <MyInterviews />
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}

