
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlatformAssetUploader } from './PlatformAssetUploader'
import { PlatformSettingsManager } from './PlatformSettingsManager'
import { PlatformDashboard } from '@/components/dashboard/PlatformDashboard'
import { JobSettingsManager } from './JobSettingsManager'
import { SaaSCustomersList } from '@/pages/settings/saas-customers/SaaSCustomersList'
import { useSearchParams } from 'react-router-dom'

export function PlatformTab() {
  const [searchParams] = useSearchParams()
  const currentTab = searchParams.get('tab')
  
  // If we're on the saas-customers tab, show that content
  if (currentTab === 'platform-saas-customers') {
    return (
      <div className="space-y-6">
        <SaaSCustomersList />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="job-settings">Job Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="space-y-6">
          <PlatformDashboard />
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-6">
          <PlatformSettingsManager />
        </TabsContent>
        
        <TabsContent value="assets" className="space-y-6">
          <PlatformAssetUploader />
        </TabsContent>
        
        <TabsContent value="job-settings" className="space-y-6">
          <JobSettingsManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
