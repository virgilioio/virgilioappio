
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlatformAssetUploader } from './PlatformAssetUploader'
import { CountryManagement } from './CountryManagement'

export function PlatformTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="assets" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="assets">Platform Assets</TabsTrigger>
          <TabsTrigger value="countries">Country Management</TabsTrigger>
        </TabsList>
        
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
