import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SoonBadge } from '@/components/ui/soon-badge'
import { ConfirmationEmailAutomation } from './automations/ConfirmationEmailAutomation'

export function AutomationsTab() {
  return (
    <Tabs defaultValue="confirmation-email" className="w-full">
      <TabsList>
        <TabsTrigger value="confirmation-email">Confirmation Email</TabsTrigger>
        <TabsTrigger value="applicant-notifications" disabled className="gap-2">
          Applicant Notifications <SoonBadge />
        </TabsTrigger>
        <TabsTrigger value="interview-reminders" disabled className="gap-2">
          Interview Reminders <SoonBadge />
        </TabsTrigger>
        <TabsTrigger value="stage-alerts" disabled className="gap-2">
          Stage Alerts <SoonBadge />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="confirmation-email" className="mt-4">
        <ConfirmationEmailAutomation />
      </TabsContent>
    </Tabs>
  )
}
