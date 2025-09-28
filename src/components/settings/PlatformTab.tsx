
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlatformAssetUploader } from './PlatformAssetUploader'
import { PlatformSettingsManager } from './PlatformSettingsManager'
import { PlatformDashboard } from '@/components/dashboard/PlatformDashboard'
import { JobSettingsManager } from './JobSettingsManager'
export function PlatformTab() {
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
