
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuthGate } from '@/components/auth/AuthGate'
import { OrgGate } from '@/components/auth/OrgGate'
import { AppContainer } from '@/components/layout/AppContainer'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { SettingsSidebar } from '@/components/settings/SettingsSidebar'
import { SettingsMobileHeader } from '@/components/settings/SettingsMobileHeader'
import { ProfileTab } from '@/components/settings/ProfileTab'
import { OrganizationTab } from '@/components/settings/OrganizationTab'
import { MembersTab } from '@/components/settings/MembersTab'
import { BillingTab } from '@/components/settings/BillingTab'
import { PlatformTab } from '@/components/settings/PlatformTab'
import { DebugPanel } from '@/components/debug/DebugPanel'
import { usePermissions } from '@/hooks/usePermissions'
import { useSearchParams, useNavigate } from 'react-router-dom'

export default function Settings() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialTab = searchParams.get('tab') || 'profile'
  const [activeTab, setActiveTab] = useState(initialTab)
  const permissions = usePermissions()

  // Show debug panel in development
  const showDebugPanel = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost'

  const handleMenuToggle = () => {
    // Handle mobile menu toggle - could implement a mobile drawer here
    console.log('Menu toggle clicked')
  }

  const handleBackToDashboard = () => {
    navigate('/')
  }

  return (
    <AuthGate>
      <OrgGate>
        <Section className="min-h-screen">
          <AppContainer variant="default">
            <div className="py-lg">
              <PageHeader
                title="Settings"
                subtitle="Manage your account preferences and organization settings"
              />

              {/* Debug Panel for Development */}
              {showDebugPanel && (
                <div className="mb-lg">
                  <DebugPanel />
                </div>
              )}

              <div className="flex flex-col lg:flex-row gap-lg">
                {/* Mobile Header */}
                <div className="lg:hidden">
                  <SettingsMobileHeader 
                    onMenuToggle={handleMenuToggle} 
                    onBackToDashboard={handleBackToDashboard} 
                  />
                </div>

                {/* Desktop Sidebar */}
                <div className="hidden lg:block lg:w-60 flex-shrink-0">
                  <SettingsSidebar currentTab={activeTab} onTabChange={setActiveTab} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="lg:hidden grid w-full grid-cols-5 mb-lg">
                      <TabsTrigger value="profile" className="text-xs">Profile</TabsTrigger>
                      <TabsTrigger value="organization" className="text-xs">Org</TabsTrigger>
                      <TabsTrigger value="members" className="text-xs">Members</TabsTrigger>
                      <TabsTrigger value="billing" className="text-xs">Billing</TabsTrigger>
                      {(permissions.isPlatformAdmin || permissions.canCreateOrganizations) && (
                        <TabsTrigger value="platform" className="text-xs">Platform</TabsTrigger>
                      )}
                    </TabsList>

                    <TabsContent value="profile" className="mt-0">
                      <ProfileTab />
                    </TabsContent>

                    <TabsContent value="organization" className="mt-0">
                      <OrganizationTab />
                    </TabsContent>

                    <TabsContent value="members" className="mt-0">
                      <MembersTab />
                    </TabsContent>

                    <TabsContent value="billing" className="mt-0">
                      <BillingTab />
                    </TabsContent>

                    <TabsContent value="platform" className="mt-0">
                      <PlatformTab />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          </AppContainer>
        </Section>
      </OrgGate>
    </AuthGate>
  )
}
