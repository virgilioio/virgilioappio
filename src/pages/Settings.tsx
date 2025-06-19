
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  const [searchParams] = useSearchParams()
  const { canViewBilling, canManageMembers, isPlatformAdmin } = usePermissions()
  const defaultTab = searchParams.get('tab') || 'profile'

  return (
    <InvoiceFilterProvider>
      <Section>
        <AppContainer variant="default">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar - hidden on mobile */}
            <div className="hidden lg:block w-64 flex-shrink-0">
              <SettingsSidebar defaultTab={defaultTab} />
            </div>
            
            {/* Main content */}
            <div className="flex-1 min-w-0">
              <Tabs defaultValue={defaultTab} className="w-full">
                {/* Mobile header */}
                <div className="lg:hidden mb-6">
                  <SettingsMobileHeader />
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
