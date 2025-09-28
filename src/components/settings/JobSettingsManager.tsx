import { JobStagesManager } from './JobStagesManager'
import { ApplicationFieldsManager } from './ApplicationFieldsManager'
import { OfferTemplatesManager } from './OfferTemplatesManager'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function JobSettingsManager() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Job Settings</h1>
        <p className="text-text-secondary mt-1">Configure job-related settings for the platform</p>
      </div>

      <Tabs defaultValue="stages" className="w-full">
        <TabsList>
          <TabsTrigger value="stages">Stages Library</TabsTrigger>
          <TabsTrigger value="application-fields">Application Fields</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="stages" className="mt-4">
          <JobStagesManager />
        </TabsContent>
        <TabsContent value="application-fields" className="mt-4">
          <ApplicationFieldsManager />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <OfferTemplatesManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
