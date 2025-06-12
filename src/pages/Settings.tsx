
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuthGate } from '@/components/auth/AuthGate'
import { OrgGate } from '@/components/auth/OrgGate'
import { AppContainer } from '@/components/layout/AppContainer'
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
            <div className="py-6 lg:py-8">
              <div className="mb-6 lg:mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-2">
                  Manage your account preferences and organization settings
                </p>
              </div>

              {/* Debug Panel for Development */}
              {showDebugPanel && (
                <div className="mb-6">
                  <DebugPanel />
                </div>
              )}

              <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                {/* Mobile Header */}
                <div className="lg:hidden">
                  <SettingsMobileHeader 
                    onMenuToggle={handleMenuToggle} 
                    onBackToDashboard={handleBackToDashboard} 
                  />
                </div>

                {/* Desktop Sidebar */}
                <div className="hidden lg:block lg:w-64 flex-shrink-0">
                  <SettingsSidebar currentTab={activeTab} onTabChange={setActiveTab} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="lg:hidden grid w-full grid-cols-5 mb-6">
                      <TabsTrigger value="profile">Profile</TabsTrigger>
                      <TabsTrigger value="organization">Org</TabsTrigger>
                      <TabsTrigger value="members">Members</TabsTrigger>
                      <TabsTrigger value="billing">Billing</TabsTrigger>
                      {(permissions.isPlatformAdmin || permissions.canCreateOrganizations) && (
                        <TabsTrigger value="platform">Platform</TabsTrigger>
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
