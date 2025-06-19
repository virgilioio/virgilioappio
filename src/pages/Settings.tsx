
import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileTab } from '@/components/settings/ProfileTab'
import { OrganizationTab } from '@/components/settings/OrganizationTab'
import { BillingTab } from '@/components/settings/BillingTab'
import { MembersTab } from '@/components/settings/MembersTab'
import { PlatformTab } from '@/components/settings/PlatformTab'
import { usePermissions } from '@/hooks/usePermissions'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'
import { SettingsSidebar } from '@/components/settings/SettingsSidebar'
import { SettingsMobileHeader } from '@/components/settings/SettingsMobileHeader'
import { InvoiceFilterProvider } from '@/utils/invoiceFilters'

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { canViewBilling, canManageMembers, isPlatformAdmin } = usePermissions()
  const defaultTab = searchParams.get('tab') || 'profile'
  const [currentTab, setCurrentTab] = useState(defaultTab)

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab)
    setSearchParams({ tab })
  }

  const handleMenuToggle = () => {
    // Handle mobile menu toggle if needed
    console.log('Menu toggle clicked')
  }

  const handleBackToDashboard = () => {
    navigate('/')
  }

  return (
    <InvoiceFilterProvider>
      <Section>
        <AppContainer variant="default">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar - hidden on mobile */}
            <div className="hidden lg:block w-64 flex-shrink-0">
              <SettingsSidebar 
                currentTab={currentTab} 
                onTabChange={handleTabChange} 
              />
            </div>
            
            {/* Main content */}
            <div className="flex-1 min-w-0">
              <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
                {/* Mobile header */}
                <div className="lg:hidden mb-6">
                  <SettingsMobileHeader 
                    onMenuToggle={handleMenuToggle}
                    onBackToDashboard={handleBackToDashboard}
                  />
                </div>

                <TabsContent value="profile">
                  <ProfileTab />
                </TabsContent>
                
                <TabsContent value="organization">
                  <OrganizationTab />
                </TabsContent>
                
                {canViewBilling && (
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
                  <TabsContent value="platform">
                    <PlatformTab />
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </div>
        </AppContainer>
      </Section>
    </InvoiceFilterProvider>
  )
}
