
import { WelcomeHeader } from '@/components/dashboard/WelcomeHeader'
import { QuickAccess } from '@/components/dashboard/QuickAccess'
import { JobsOverview } from '@/components/dashboard/JobsOverview'
import { PaymentsTracker } from '@/components/dashboard/PaymentsTracker'
import { PriorityPaymentAlert } from '@/components/dashboard/PriorityPaymentAlert'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { OnboardingProgress } from '@/components/dashboard/OnboardingProgress'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'
import { InvoiceFilterProvider } from '@/utils/invoiceFilters'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'

export default function Dashboard() {
  const { profile, isLoading } = useUserProfile()
  const permissions = usePermissions()

  // Calculate if onboarding should show
  const shouldShowOnboarding = () => {
    if (isLoading) return true
    if (!profile) return false
    
    const fields = [
      profile.first_name,
      profile.last_name,
      profile.title,
      profile.phone,
      profile.timezone,
      profile.avatar_url
    ]
    
    const filledFields = fields.filter(field => field && field.trim()).length
    const progress = Math.round((filledFields / fields.length) * 100)
    return progress < 100
  }

  return (
    <InvoiceFilterProvider>
      <Section>
        <AppContainer variant="default">
          <div className="space-y-6">
            <WelcomeHeader profile={profile} isLoading={isLoading} />
            <PriorityPaymentAlert />
            
            {shouldShowOnboarding() && (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1">
                  <OnboardingProgress profile={profile} isLoading={isLoading} />
                </div>
              </div>
            )}
            
            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
              <div className="lg:col-span-1 xl:col-span-1 space-y-6">
                <PaymentsTracker />
                <JobsOverview permissions={permissions} />
              </div>
              
              <div className="lg:col-span-1 xl:col-span-2 space-y-6">
                <QuickAccess permissions={permissions} />
                <RecentActivity />
              </div>
            </div>
          </div>
        </AppContainer>
      </Section>
    </InvoiceFilterProvider>
  )
}
