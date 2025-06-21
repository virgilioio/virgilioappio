
import { WelcomeHeader } from '@/components/dashboard/WelcomeHeader'
import { QuickAccess } from '@/components/dashboard/QuickAccess'
import { JobsOverview } from '@/components/dashboard/JobsOverview'
import { PaymentsTracker } from '@/components/dashboard/PaymentsTracker'
import { PaymentHistory } from '@/components/dashboard/PaymentHistory'
import { PriorityPaymentAlert } from '@/components/dashboard/PriorityPaymentAlert'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { OnboardingProgress } from '@/components/dashboard/OnboardingProgress'
import { InvoiceFilterProvider } from '@/utils/invoiceFilters'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { useSampleActivities } from '@/hooks/useSampleActivities'

export default function Dashboard() {
  const { profile, isLoading } = useUserProfile()
  const permissions = usePermissions()
  
  // Initialize sample activities for demonstration
  useSampleActivities()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
        <InvoiceFilterProvider>
          <div className="space-y-6">
            <WelcomeHeader profile={profile} isLoading={isLoading} />
            
            <PermissionGate permission="canViewBilling">
              <PriorityPaymentAlert />
            </PermissionGate>
            
            {/* Compliance Progress - Full Width */}
            <OnboardingProgress profile={profile} isLoading={isLoading} />
            
            {/* Two equal columns layout */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <PermissionGate permission="canViewBilling">
                  <PaymentsTracker />
                  <PaymentHistory />
                </PermissionGate>
              </div>
              
              <div className="space-y-6">
                <QuickAccess permissions={permissions} />
                <JobsOverview permissions={permissions} />
                <RecentActivity />
              </div>
            </div>
          </div>
        </InvoiceFilterProvider>
      </div>
    </div>
  )
}
