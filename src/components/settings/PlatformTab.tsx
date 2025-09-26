
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlatformAssetUploader } from './PlatformAssetUploader'
import { CountryManagement } from './CountryManagement'
import { PlatformSettingsManager } from './PlatformSettingsManager'

import { LegalManager } from './LegalManager'
import { PlatformDashboard } from '@/components/dashboard/PlatformDashboard'
import { WorkerComplianceManager } from './WorkerComplianceManager'
import { JobSettingsManager } from './JobSettingsManager'

export function PlatformTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="legal">Legal</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="countries">Countries</TabsTrigger>
          <TabsTrigger value="worker-compliance">Worker Compliance</TabsTrigger>
          <TabsTrigger value="job-settings">Job Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="space-y-6">
          <PlatformDashboard />
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-6">
          <PlatformSettingsManager />
        </TabsContent>
        
        <TabsContent value="legal" className="space-y-6">
          <LegalManager />
        </TabsContent>
        
        <TabsContent value="assets" className="space-y-6">
          <PlatformAssetUploader />
        </TabsContent>
        
        <TabsContent value="countries" className="space-y-6">
          <CountryManagement />
        </TabsContent>
        
        <TabsContent value="worker-compliance" className="space-y-6">
          <WorkerComplianceManager />
        </TabsContent>
        
        <TabsContent value="job-settings" className="space-y-6">
          <JobSettingsManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
