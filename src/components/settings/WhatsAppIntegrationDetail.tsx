import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { PLACEHOLDER_OPTIONS } from '@/utils/templateUtils'

const WHATSAPP_PLACEHOLDERS = PLACEHOLDER_OPTIONS.filter((p) =>
  ['candidate.first_name', 'candidate.name', 'sender.first_name', 'sender.name', 'organization.name', 'job.title'].includes(p.key)
)

export function WhatsAppIntegrationDetail() {
  const { automation, isLoading, isSaving, toggle, save } = useWorkspaceAutomation('whatsapp_integration')
  const isActive = automation?.is_active ?? false

  const [templateText, setTemplateText] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (automation?.body != null) {
      setTemplateText(automation.body)
      setDirty(false)
    }
  }, [automation?.body])

  const handleSaveTemplate = async () => {
    try {
      await save({ body: templateText })
      setDirty(false)
      toast.success('WhatsApp message template saved')
    } catch {
      // error toast handled by hook
    }
  }

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

      {isActive && (
        <div className="space-y-3 rounded-md border border-border p-4">
          <div>
            <p className="text-sm font-medium font-poppins text-foreground">Pre-filled message template</p>
            <p className="text-xs text-muted-foreground font-poppins mt-0.5">
              This message will be pre-filled in WhatsApp the first time a recruiter contacts a candidate for a specific job. After the first message, subsequent clicks open WhatsApp without a template.
            </p>
          </div>

          <Textarea
            value={templateText}
            onChange={(e) => {
              setTemplateText(e.target.value)
              setDirty(true)
            }}
            placeholder="Hi {{candidate.first_name}}, this is {{sender.first_name}} from {{organization.name}}. I'd like to discuss the {{job.title}} position with you."
            className="min-h-[100px] text-sm"
            disabled={isSaving}
          />

          <div className="flex flex-wrap gap-1.5">
            {WHATSAPP_PLACEHOLDERS.map((p) => (
              <button
                key={p.key}
                type="button"
                className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => {
                  setTemplateText((prev) => prev + `{{${p.key}}}`)
                  setDirty(true)
                }}
              >
                {`{{${p.key}}}`}
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveTemplate}
              disabled={!dirty || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              Save template
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
