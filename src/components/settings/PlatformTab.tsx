
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlatformAssetUploader } from './PlatformAssetUploader'
import { CountryManagement } from './CountryManagement'
import { PlatformSettingsManager } from './PlatformSettingsManager'
import { AdvertisingManager } from './AdvertisingManager'
import { LegalManager } from './LegalManager'

export function PlatformTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="advertising">Advertising</TabsTrigger>
          <TabsTrigger value="legal">Legal</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="countries">Countries</TabsTrigger>
        </TabsList>
        
        <TabsContent value="settings" className="space-y-6">
          <PlatformSettingsManager />
        </TabsContent>
        
        <TabsContent value="advertising" className="space-y-6">
          <AdvertisingManager />
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
      </Tabs>
    </div>
  )
}
