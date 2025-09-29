import { JobStagesManager } from './JobStagesManager'
import { ApplicationFieldsManager } from './ApplicationFieldsManager'
import { OfferTemplatesManager } from './OfferTemplatesManager'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface JobSettingsManagerProps {
  context?: 'platform-defaults' | 'organization'
}

export function JobSettingsManager({ context = 'organization' }: JobSettingsManagerProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          {context === 'platform-defaults' ? 'Platform Job Settings' : 'Job Settings'}
        </h1>
        <p className="text-text-secondary mt-1">
          {context === 'platform-defaults' 
            ? 'Configure platform-wide default job settings that organizations can inherit'
            : 'Configure job-related settings for your organization'
          }
        </p>
      </div>

      <Tabs defaultValue="stages" className="w-full">
        <TabsList>
          <TabsTrigger value="stages">Stages Library</TabsTrigger>
          <TabsTrigger value="application-fields">Application Fields</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="stages" className="mt-4">
          <JobStagesManager context={context} />
        </TabsContent>
        <TabsContent value="application-fields" className="mt-4">
          <ApplicationFieldsManager context={context} />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <OfferTemplatesManager context={context} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
