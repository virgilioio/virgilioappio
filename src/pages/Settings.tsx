import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import OrganizationTab from '@/components/settings/OrganizationTab'
import { MembersTab } from '@/components/settings/MembersTab'
import { DepartmentsManager } from '@/components/settings/DepartmentsManager'
import { PlatformCustomers } from '@/components/settings/platform/PlatformCustomers'

import { IntegrationsTab } from '@/components/settings/IntegrationsTab'
import { CustomersTab } from '@/components/settings/tabs/CustomersTab'
import { Billing } from '@/pages/settings/Billing'
import { JobStagesManager } from '@/components/settings/JobStagesManager'
import { ApplicationFieldsManager } from '@/components/settings/ApplicationFieldsManager'
import { OfferTemplatesManager } from '@/components/settings/OfferTemplatesManager'
import { CareersPageTab } from '@/components/settings/CareersPageTab'
import { JobBoardsTab } from '@/pages/settings/JobBoardsTab'
import { SettingsSidebar } from '@/components/settings/SettingsSidebar'
import { SetupTab } from '@/components/settings/tabs/SetupTab'
import { NotificationsTab } from '@/components/settings/tabs/NotificationsTab'
import { EmailCalendarTab } from '@/components/settings/tabs/EmailCalendarTab'
import { BookingTab } from '@/components/settings/tabs/BookingTab'
import { GioRecruitingSettings } from '@/components/settings/GioRecruitingSettings'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { usePermissions } from '@/hooks/usePermissions'
import { useSetupProgress } from '@/hooks/useSetupProgress'
import { scrollToHighlightedSection } from '@/utils/scrollToHighlight'

// Map legacy tab keys to new ones so old links keep working.
const LEGACY_TAB_MAP: Record<string, string> = {
  'workspace-currency': 'organization',
  'workspace-job-settings': 'pipeline-stages',
  'workspace-deal-stages': 'workspace-deal-stages',
  // Old Platform group → new Platform group
  'platform-saas-customers': 'platform-customers',
  // Job defaults merged into Settings › Recruiting (2026-10-19).
  'platform-job-settings': 'pipeline-stages',
  'platform-job-defaults': 'pipeline-stages',
  'platform-settings': 'platform-customers',
  // The platform dashboard was removed (Allan, 2026-10-19).
  'platform-dashboard': 'platform-customers',
  // Settings › Automations held only the confirmation email, now on Careers page (2026-10-19).
  automations: 'careers-page',
}

const EXTERNAL_TABS = ['setup', 'email-calendar', 'booking', 'notifications']

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
  const { organizationId, userType } = useAuth()
  const { tenant } = useTenant()
  const { isExternal } = usePermissions()

  const { essentialsRemaining, essentialsTotal, configuredCount } = useSetupProgress()

  const isBillingRoute = location.pathname === '/billing'
  const pickDefaultTab = () => {
    if (essentialsRemaining > 0) return 'setup'
    if (userType === 'workspace_owner' && organizationId) return 'organization'
    return 'email-calendar'
  }

  const rawTab = searchParams.get('tab')
  const resolved = isBillingRoute ? 'billing' : (rawTab ? (LEGACY_TAB_MAP[rawTab] || rawTab) : pickDefaultTab())
  const [currentTab, setCurrentTab] = useState(resolved)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    scrollToHighlightedSection()
  }, [currentTab])

  // A link to another tab while Settings is open (Setup's rows, the account menu) switches to it.
  useEffect(() => {
    if (isBillingRoute || !rawTab) return
    const next = LEGACY_TAB_MAP[rawTab] || rawTab
    setCurrentTab((cur) => (cur === next ? cur : next))
  }, [rawTab, isBillingRoute])

  // Redirect legacy tab keys in the URL once
  useEffect(() => {
    if (rawTab && LEGACY_TAB_MAP[rawTab] && LEGACY_TAB_MAP[rawTab] !== rawTab) {
      setSearchParams({ tab: LEGACY_TAB_MAP[rawTab] })
    }
  }, [rawTab, setSearchParams])

  const handleTabChange = (tab: string) => {
    // Reference templates live in the Reference checks module — deep-link out.
    if (tab === 'reference-templates') {
      navigate('/references/templates')
      setMobileOpen(false)
      return
    }
    setCurrentTab(tab)
    setSearchParams({ tab })
    setMobileOpen(false)
  }


  // External users (2026-10-24) have only their own settings.
  const shownTab = isExternal && !EXTERNAL_TABS.includes(currentTab) ? 'email-calendar' : currentTab

  const renderContent = () => {
    switch (shownTab) {
      case 'setup':
        return <SetupTab />
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
        return <JobStagesManager />
      case 'gio':
        return <GioRecruitingSettings />
      case 'application-form':
        return <ApplicationFieldsManager />
      case 'templates':
        return <OfferTemplatesManager />
      case 'careers-page':
        return <CareersPageTab />
      case 'job-boards':
        return <JobBoardsTab />
      case 'customers':
        return <CustomersTab />
      case 'platform-customers':
        return <PlatformCustomers />
      default:
        if (shownTab.startsWith('integration-')) {
          return <IntegrationsTab initialConfigureId={shownTab.replace('integration-', '')} />
        }
        return <EmailCalendarTab />
    }
  }

  // Settings › Profile is My profile's You card now (Allan, 2026-10-24): old links land there.
  if (rawTab === 'profile') return <Navigate to="/me?focus=card-you" replace />

  const workspaceName = tenant?.name || 'Workspace'

  return (
    <div className="min-h-screen bg-virgilio-cream">
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
              {configuredCount} of {essentialsTotal} essentials done
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
          <SheetContent side="left" className="w-[280px] p-4 bg-virgilio-cream">
            <SettingsSidebar
              currentTab={shownTab}
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
              currentTab={shownTab}
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
