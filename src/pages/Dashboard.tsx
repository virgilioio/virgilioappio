
import { usePermissions } from '@/hooks/usePermissions'
import { useUserProfile } from '@/hooks/useUserProfile'
import { AppContainer } from '@/components/layout/AppContainer'
import { WelcomeHeader } from '@/components/dashboard/WelcomeHeader'
import { PaymentsTracker } from '@/components/dashboard/PaymentsTracker'
import { OnboardingProgress } from '@/components/dashboard/OnboardingProgress'
import { PaymentHistory } from '@/components/dashboard/PaymentHistory'
import { QuickAccess } from '@/components/dashboard/QuickAccess'
import { JobsOverview } from '@/components/dashboard/JobsOverview'
import { RecentActivity } from '@/components/dashboard/RecentActivity'

export default function Dashboard() {
  const permissions = usePermissions()
  const { profile, isLoading: profileLoading } = useUserProfile()

  return (
    <AppContainer>
      <>
        <div className="space-y-6">
          <WelcomeHeader profile={profile} isLoading={profileLoading} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {permissions.canViewBilling && (
              <PaymentsTracker />
            )}
            
            <OnboardingProgress profile={profile} isLoading={profileLoading} />
            
            {permissions.canViewBilling && (
              <PaymentHistory />
            )}
            
            <QuickAccess permissions={permissions} />
            
            <JobsOverview permissions={permissions} />
            
            <RecentActivity />
          </div>
        </div>
      </>
    </AppContainer>
  )
}
