
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

export default function Dashboard() {
  return (
    <InvoiceFilterProvider>
      <Section>
        <AppContainer variant="default">
          <div className="space-y-6">
            <WelcomeHeader />
            <PriorityPaymentAlert />
            <OnboardingProgress />
            
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <QuickAccess />
                <JobsOverview />
              </div>
              
              <div className="space-y-6">
                <PaymentsTracker />
                <RecentActivity />
              </div>
            </div>
          </div>
        </AppContainer>
      </Section>
    </InvoiceFilterProvider>
  )
}
