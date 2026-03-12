import { Separator } from '@/components/ui/separator'
import { PageHeader } from '@/components/layout/PageHeader'
import { GoogleWorkspaceIntegrationSection } from './GoogleWorkspaceIntegrationSection'
import { ChromeExtensionTokenCard } from './ChromeExtensionTokenCard'
import { WhatsAppIntegrationCard } from './WhatsAppIntegrationCard'

export function IntegrationsTab() {
  return (
    <div className="space-y-md">
      <PageHeader 
        title="Integrations" 
        subtitle="Connect external services to enhance your workflow"
      />
      
      <ChromeExtensionTokenCard />
      
      <Separator className="my-8" />

      <GoogleWorkspaceIntegrationSection />

      <Separator className="my-8" />

      <WhatsAppIntegrationCard />
    </div>
  )
}
