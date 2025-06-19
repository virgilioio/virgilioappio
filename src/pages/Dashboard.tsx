
import { usePermissions } from '@/hooks/usePermissions'
import { useUserProfile } from '@/hooks/useUserProfile'
import { AppContainer } from '@/components/layout/AppContainer'
import { PageHeader } from '@/components/layout/PageHeader'
import { WelcomeHeader } from '@/components/dashboard/WelcomeHeader'
import { PriorityPaymentAlert } from '@/components/dashboard/PriorityPaymentAlert'
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
      <div className="space-y-lg py-lg">
        <WelcomeHeader profile={profile} isLoading={profileLoading} />
        
        {/* Priority Payment Alert - shows at top for maximum visibility */}
        {permissions.canViewBilling && (
          <PriorityPaymentAlert />
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
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
    </AppContainer>
  )
}
