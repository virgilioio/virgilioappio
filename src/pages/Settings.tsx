
import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileTab } from '@/components/settings/ProfileTab'
import { OrganizationTab } from '@/components/settings/OrganizationTab'
import { OrganizationsTab } from '@/components/settings/OrganizationsTab'
import { MembersTab } from '@/components/settings/MembersTab'
import { PlatformSettingsManager } from '@/components/settings/PlatformSettingsManager'
import { PlatformAssetUploader } from '@/components/settings/PlatformAssetUploader'
import { OfferTemplatesManager } from '@/components/settings/OfferTemplatesManager'
import { JobSettingsManager } from '@/components/settings/JobSettingsManager'
import { PlatformJobSettingsManager } from '@/components/settings/PlatformJobSettingsManager'
import { PlatformTab } from '@/components/settings/PlatformTab'
import { CustomerManagementTab } from '@/pages/settings/customer-management/CustomerManagementTab'
import { SaaSSubscription } from '@/pages/settings/saas-customers/SaaSSubscription'
import { SaaSCustomersList } from '@/pages/settings/saas-customers/SaaSCustomersList'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'
import { SettingsSidebar } from '@/components/settings/SettingsSidebar'
import { SettingsMobileHeader } from '@/components/settings/SettingsMobileHeader'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { canViewBilling, canManageMembers, canViewOrganizations, isPlatformAdmin, isGuest } = usePermissions()
  const { organizationId, userType } = useAuth()
  const defaultTab = searchParams.get('tab') || 'profile'
  const [currentTab, setCurrentTab] = useState(defaultTab)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab)
    setSearchParams({ tab })
    setMobileMenuOpen(false) // Close mobile menu when tab changes
  }

  const handleMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  const handleBackToDashboard = () => {
    navigate('/')
  }

  const renderPlatformContent = () => {
    switch (currentTab) {
      case 'platform-dashboard':
        return <PlatformTab />
      case 'platform-settings':
        return <PlatformSettingsManager />
      case 'platform-job-settings':
        return <PlatformJobSettingsManager />
      case 'platform-saas-customers':
        return <SaaSCustomersList />
      case 'platform-customers':
        return <CustomerManagementTab />
      default:
        return <PlatformTab />
    }
  }

  const isWorkspaceOwnerOfSaaSOrg = () => {
    return userType === 'workspace_owner' && organizationId
  }

  // All authenticated users with workspace owner status can access billing
  const canAccessBilling = canViewBilling

  return (
    <Section>
      <AppContainer variant="default">
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
            {/* Mobile header with sheet for sidebar */}
            <div className="lg:hidden mb-6">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SettingsMobileHeader 
                  onMenuToggle={handleMenuToggle}
                  onBackToDashboard={handleBackToDashboard}
                />
                <SheetContent side="left" className="w-80 p-0">
                  <div className="p-4">
                    <SettingsSidebar 
                      currentTab={currentTab} 
                      onTabChange={handleTabChange}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Desktop layout with floating sidebar */}
            <div className="flex gap-6">
              {/* Floating Sidebar - hidden on mobile */}
              <div className="hidden lg:block">
                <SettingsSidebar 
                  currentTab={currentTab} 
                  onTabChange={handleTabChange} 
                />
              </div>
              
              {/* Main content */}
              <div className="flex-1">
                <TabsContent value="profile">
                  <ProfileTab />
                </TabsContent>
                
                <TabsContent value="organization">
                  <OrganizationTab />
                </TabsContent>
                
                {canViewOrganizations && (
                  <TabsContent value="organizations">
                    <OrganizationsTab />
                  </TabsContent>
                )}
                
                {/* Billing tab removed */}
                
                {canManageMembers && (
                  <TabsContent value="members">
                    <MembersTab />
                  </TabsContent>
                )}
                
                {isPlatformAdmin && (
                  <>
                    <TabsContent value="platform-dashboard">
                      {renderPlatformContent()}
                    </TabsContent>
                     <TabsContent value="platform-settings">
                       {renderPlatformContent()}
                     </TabsContent>
                     <TabsContent value="platform-job-settings">
                       {renderPlatformContent()}
                     </TabsContent>
                    <TabsContent value="platform-saas-customers">
                      {renderPlatformContent()}
                    </TabsContent>
                    <TabsContent value="platform-customers">
                      {renderPlatformContent()}
                    </TabsContent>
                  </>
                )}

                {/* Workspace Job Settings for both Platform Admins and Workspace Owners */}
                {(isPlatformAdmin || isWorkspaceOwnerOfSaaSOrg()) && (
                  <TabsContent value="workspace-job-settings">
                    <JobSettingsManager />
                  </TabsContent>
                )}

                {isWorkspaceOwnerOfSaaSOrg() && (
                  <TabsContent value="subscription">
                    <SaaSSubscription />
                  </TabsContent>
                )}
              </div>
            </div>
          </Tabs>
        </AppContainer>
      </Section>
  )
}
