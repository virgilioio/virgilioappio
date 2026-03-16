import { Switch } from '@/components/ui/switch'
import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'
import { Loader2 } from 'lucide-react'

export function WhatsAppIntegrationDetail() {
  const { automation, isLoading, isSaving, toggle } = useWorkspaceAutomation('whatsapp_integration')
  const isActive = automation?.is_active ?? false

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold font-poppins text-foreground">WhatsApp Shortcuts</h3>
        <p className="text-sm text-muted-foreground font-poppins mt-1">
          Enable WhatsApp shortcut actions across GoGio. Recruiters will be able to open candidate phone numbers directly in WhatsApp.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border p-4">
        <div>
          <p className="text-sm font-medium font-poppins text-foreground">Enable WhatsApp shortcuts</p>
          <p className="text-xs text-muted-foreground font-poppins mt-0.5">
            Show WhatsApp quick-action buttons next to candidate phone numbers
          </p>
        </div>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            checked={isActive}
            onCheckedChange={(checked) => toggle(checked)}
            disabled={isSaving}
          />
        )}
      </div>
    </div>
  )
}
