
import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileTab } from '@/components/settings/ProfileTab'
import { OrganizationTab } from '@/components/settings/OrganizationTab'
import { BillingTab } from '@/components/settings/BillingTab'
import { MembersTab } from '@/components/settings/MembersTab'
import { PlatformSettingsManager } from '@/components/settings/PlatformSettingsManager'
import { AdvertisingManager } from '@/components/settings/AdvertisingManager'
import { LegalManager } from '@/components/settings/LegalManager'
import { PlatformAssetUploader } from '@/components/settings/PlatformAssetUploader'
import { CountryManagement } from '@/components/settings/CountryManagement'
import { OfferTemplatesManager } from '@/components/settings/OfferTemplatesManager'
import { WorkerComplianceManager } from '@/components/settings/WorkerComplianceManager'
import { PlatformTab } from '@/components/settings/PlatformTab'
import { usePermissions } from '@/hooks/usePermissions'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'
import { SettingsSidebar } from '@/components/settings/SettingsSidebar'
import { SettingsMobileHeader } from '@/components/settings/SettingsMobileHeader'
import { InvoiceFilterProvider } from '@/utils/invoiceFilters'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { canViewBilling, canManageMembers, isPlatformAdmin, isGuest } = usePermissions()
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
      case 'platform-advertising':
        return <AdvertisingManager />
      case 'platform-legal':
        return <LegalManager />
      case 'platform-assets':
        return <PlatformAssetUploader />
      case 'platform-countries':
        return <CountryManagement />
      case 'platform-templates':
        return <OfferTemplatesManager />
      case 'platform-worker-compliance':
        return <WorkerComplianceManager />
      default:
        return <PlatformTab />
    }
  }

  // Guest users should not have access to billing tab
  const canAccessBilling = canViewBilling && !isGuest

  return (
    <InvoiceFilterProvider>
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
                
                {canAccessBilling && (
                  <TabsContent value="billing">
                    <BillingTab />
                  </TabsContent>
                )}
                
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
                    <TabsContent value="platform-advertising">
                      {renderPlatformContent()}
                    </TabsContent>
                    <TabsContent value="platform-legal">
                      {renderPlatformContent()}
                    </TabsContent>
                    <TabsContent value="platform-assets">
                      {renderPlatformContent()}
                    </TabsContent>
                    <TabsContent value="platform-countries">
                      {renderPlatformContent()}
                    </TabsContent>
                    <TabsContent value="platform-templates">
                      {renderPlatformContent()}
                    </TabsContent>
                    <TabsContent value="platform-worker-compliance">
                      {renderPlatformContent()}
                    </TabsContent>
                  </>
                )}
              </div>
            </div>
          </Tabs>
        </AppContainer>
      </Section>
    </InvoiceFilterProvider>
  )
}
