import { PlatformJobStagesManager } from './PlatformJobStagesManager'
import { PlatformApplicationFieldsManager } from './PlatformApplicationFieldsManager'
import { PlatformOfferTemplatesManager } from './PlatformOfferTemplatesManager'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/layout/PageHeader'

export function PlatformJobSettingsManager() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Platform Job Settings" 
        subtitle="Manage platform-wide default settings that organizations can inherit"
      />

      <Tabs defaultValue="stages" className="w-full">
        <TabsList>
          <TabsTrigger value="stages">Default Stages</TabsTrigger>
          <TabsTrigger value="application-fields">Default Application Fields</TabsTrigger>
          <TabsTrigger value="templates">Default Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="stages" className="mt-4">
          <PlatformJobStagesManager />
        </TabsContent>
        <TabsContent value="application-fields" className="mt-4">
          <PlatformApplicationFieldsManager />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <PlatformOfferTemplatesManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}