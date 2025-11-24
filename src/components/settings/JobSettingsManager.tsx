import { JobStagesManager } from './JobStagesManager'
import { ApplicationFieldsManager } from './ApplicationFieldsManager'
import { OfferTemplatesManager } from './OfferTemplatesManager'
import { CareersPageTab } from './CareersPageTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/layout/PageHeader'

interface JobSettingsManagerProps {
  context?: 'platform-defaults' | 'organization'
}

export function JobSettingsManager({ context = 'organization' }: JobSettingsManagerProps) {
  return (
    <div className="space-y-6">
      <PageHeader 
        title={context === 'platform-defaults' ? 'Platform Job Settings' : 'Job Settings'}
        subtitle={context === 'platform-defaults' 
          ? 'Configure platform-wide default job settings that organizations can inherit'
          : 'Configure job-related settings for your organization'
        }
      />

      <Tabs defaultValue="stages" className="w-full">
        <TabsList>
          <TabsTrigger value="stages">Stages Library</TabsTrigger>
          <TabsTrigger value="application-fields">Application Fields</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="careers-page">Careers Page</TabsTrigger>
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
        <TabsContent value="careers-page" className="mt-4">
          <CareersPageTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
