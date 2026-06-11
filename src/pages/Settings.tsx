import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { ProfileTab } from '@/components/settings/ProfileTab'
import OrganizationTab from '@/components/settings/OrganizationTab'
import { MembersTab } from '@/components/settings/MembersTab'
import { PlatformSettingsManager } from '@/components/settings/PlatformSettingsManager'
import { DealStagesManager } from '@/components/settings/DealStagesManager'
import { DepartmentsManager } from '@/components/settings/DepartmentsManager'
import { PlatformJobSettingsManager } from '@/components/settings/PlatformJobSettingsManager'
import { PlatformTab } from '@/components/settings/PlatformTab'
import { IntegrationsTab } from '@/components/settings/IntegrationsTab'
import { SaaSCustomersList } from '@/pages/settings/saas-customers/SaaSCustomersList'
import { CustomersTab } from '@/components/settings/tabs/CustomersTab'
import { Billing } from '@/pages/settings/Billing'
import { JobStagesManager } from '@/components/settings/JobStagesManager'
import { ApplicationFieldsManager } from '@/components/settings/ApplicationFieldsManager'
import { OfferTemplatesManager } from '@/components/settings/OfferTemplatesManager'
import { AutomationsTab } from '@/components/settings/AutomationsTab'
import { CareersPageTab } from '@/components/settings/CareersPageTab'
import { JobBoardsTab } from '@/pages/settings/JobBoardsTab'
import { SettingsSidebar } from '@/components/settings/SettingsSidebar'
import { SetupTab } from '@/components/settings/tabs/SetupTab'
import { NotificationsTab } from '@/components/settings/tabs/NotificationsTab'
import { EmailCalendarTab } from '@/components/settings/tabs/EmailCalendarTab'
import { BookingTab } from '@/components/settings/tabs/BookingTab'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { useSetupProgress } from '@/hooks/useSetupProgress'
import { scrollToHighlightedSection } from '@/utils/scrollToHighlight'

// Map legacy tab keys to new ones so old links keep working.
const LEGACY_TAB_MAP: Record<string, string> = {
  'workspace-currency': 'organization',
  'workspace-job-settings': 'pipeline-stages',
  'platform-saas-customers': 'customers',
  'workspace-deal-stages': 'workspace-deal-stages',
}

// Brand-new tabs that don't have content yet — render a small placeholder card.
// (Will be replaced by real components in Phase 2.)
function ComingSoonCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white border border-[#E7E8EE] rounded-xl p-6">
      <h3 className="font-poppins font-semibold text-[14px] text-[#0d0d09] mb-1.5" style={{ letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      <p className="font-inter text-[12.5px] text-[#5A6072] leading-relaxed">{description}</p>
      <p className="font-inter text-[11.5px] text-[#8B8F9E] mt-4">Coming in the next Settings revamp pass.</p>
    </div>
  )
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isPlatformAdmin } = usePermissions()
  const { organizationId, userType } = useAuth()
  const { tenant } = useTenant()

  const isBillingRoute = location.pathname === '/billing'
  const pickDefaultTab = () => {
    if (isPlatformAdmin) return 'platform-dashboard'
    if (userType === 'workspace_owner' && organizationId) return 'organization'
    return 'profile'
  }

  const rawTab = searchParams.get('tab')
  const resolved = isBillingRoute ? 'billing' : (rawTab ? (LEGACY_TAB_MAP[rawTab] || rawTab) : pickDefaultTab())
  const [currentTab, setCurrentTab] = useState(resolved)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    scrollToHighlightedSection()
  }, [currentTab])

  // Redirect legacy tab keys in the URL once
  useEffect(() => {
    if (rawTab && LEGACY_TAB_MAP[rawTab] && LEGACY_TAB_MAP[rawTab] !== rawTab) {
      setSearchParams({ tab: LEGACY_TAB_MAP[rawTab] })
    }
  }, [rawTab, setSearchParams])

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab)
    setSearchParams({ tab })
    setMobileOpen(false)
  }

  const { essentialsRemaining, essentialsTotal, configuredCount } = useSetupProgress()

  const renderContent = () => {
    switch (currentTab) {
      case 'setup':
        return <SetupTab />
      case 'profile':
        return <ProfileTab />
      case 'email-calendar':
        return <EmailCalendarTab />
      case 'booking':
        return <BookingTab />
      case 'notifications':
        return <NotificationsTab />
      case 'organization':
        return <OrganizationTab />
      case 'members':
        return <MembersTab />
      case 'workspace-departments':
        return <DepartmentsManager />
      case 'integrations':
        return <IntegrationsTab />
      case 'billing':
        return <Billing />
      case 'pipeline-stages':
        return <JobStagesManager context="organization" />
      case 'application-form':
        return <ApplicationFieldsManager context="organization" />
      case 'templates':
        return <OfferTemplatesManager context="organization" />
      case 'automations':
        return <AutomationsTab />
      case 'careers-page':
        return <CareersPageTab />
      case 'job-boards':
        return <JobBoardsTab />
      case 'workspace-deal-stages':
        return <DealStagesManager />
      case 'customers':
        return <CustomersTab />
      case 'platform-dashboard':
        return <PlatformTab />
      case 'platform-settings':
        return <PlatformSettingsManager />
      case 'platform-job-settings':
        return <PlatformJobSettingsManager />
      case 'platform-saas-customers':
        return <SaaSCustomersList />
      default:
        if (currentTab.startsWith('integration-')) {
          return <IntegrationsTab initialConfigureId={currentTab.replace('integration-', '')} />
        }
        return <ProfileTab />
    }
  }

  const workspaceName = tenant?.name || 'Workspace'

  return (
    <div className="min-h-screen bg-[#F6F5F1]">
      <div style={{ padding: '24px 28px' }}>
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1
              className="font-poppins font-semibold text-[#0d0d09]"
              style={{ fontSize: '28px', letterSpacing: '-0.04em', lineHeight: 1 }}
            >
              Settings<span className="text-[#6F3FF5]">.</span>
            </h1>
            <p className="mt-2 font-inter text-[12.5px] text-[#5A6072]">
              {workspaceName} workspace
              <span className="mx-2 text-[#B5B9C4]">·</span>
              {configuredCount} of {essentialsTotal} essentials configured
            </p>
          </div>
          {/* Mobile menu trigger */}
          <Button
            variant="secondary"
            size="sm"
            className="lg:hidden"
            icon={Menu}
            iconOnly
            aria-label="Open settings menu"
            onClick={() => setMobileOpen(true)}
          />
        </div>

        {/* Mobile sidebar sheet */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[280px] p-4 bg-[#F6F5F1]">
            <SettingsSidebar
              currentTab={currentTab}
              onTabChange={handleTabChange}
              essentialsRemaining={essentialsRemaining}
            />
          </SheetContent>
        </Sheet>

        {/* Desktop grid */}
        <div
          className="grid"
          style={{ gridTemplateColumns: '224px minmax(0, 1fr)', gap: 26 }}
        >
          <div className="hidden lg:block">
            <SettingsSidebar
              currentTab={currentTab}
              onTabChange={handleTabChange}
              essentialsRemaining={essentialsRemaining}
            />
          </div>
          <div className="min-w-0">
            <div className="max-w-[860px]">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
