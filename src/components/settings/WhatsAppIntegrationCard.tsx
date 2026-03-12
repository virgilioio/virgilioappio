import { useState } from 'react'
import { Check, Loader2, Phone, MessageSquareText, Plus, Send } from 'lucide-react'
import whatsappLogo from '@/assets/whatsapp-logo.png'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useWhatsAppConfig, useWhatsAppTemplates, useCreateWhatsAppTemplate } from '@/hooks/useWhatsAppConfig'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function WhatsAppIntegrationCard() {
  const {
    isConfigured,
    isProvisioned,
    whatsappNumber,
    isLoading,
    isSaving,
    isActive,
    toggle,
    provisionNumber,
  } = useWhatsAppConfig()

  const { data: templates = [], isLoading: templatesLoading } = useWhatsAppTemplates()
  const createTemplate = useCreateWhatsAppTemplate()

  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ name: '', body_template: '', category: 'UTILITY' })

  const handleProvision = async () => {
    try {
      const result = await provisionNumber.mutateAsync('US')
      if (result.already_provisioned) {
        toast.info(`WhatsApp already enabled with ${result.number}`)
      } else {
        toast.success(`WhatsApp enabled! Your number: ${result.number}`)
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to provision WhatsApp number')
    }
  }

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggle(enabled)
      toast.success(enabled ? 'WhatsApp enabled' : 'WhatsApp disabled')
    } catch {
      toast.error('Failed to update WhatsApp status')
    }
  }

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.body_template.trim()) return
    try {
      await createTemplate.mutateAsync({
        name: newTemplate.name,
        body_template: newTemplate.body_template,
        category: newTemplate.category,
      })
      toast.success('Template submitted for approval')
      setNewTemplate({ name: '', body_template: '', category: 'UTILITY' })
      setShowTemplateForm(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create template')
    }
  }

  if (isLoading) return null

  const globalTemplates = templates.filter((t) => !t.tenant_id)
  const customTemplates = templates.filter((t) => !!t.tenant_id)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg">
              <img src={whatsappLogo} alt="WhatsApp" className="h-8 w-8" />
            </div>
            <div>
              <CardTitle className="text-base">WhatsApp Business</CardTitle>
              <CardDescription>Send WhatsApp messages to candidates directly from GoGio</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isConfigured && (
              <Badge variant="outline" className="border-[#25D366]/30 text-[#25D366]">
                <Check className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
            {isProvisioned && (
              <Switch
                checked={isActive}
                onCheckedChange={handleToggle}
                disabled={isSaving}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Number Provisioning */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            WhatsApp Number
          </h4>
          {isProvisioned ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="h-2 w-2 rounded-full bg-[#25D366]" />
              <span className="text-sm font-mono">{whatsappNumber}</span>
              <Badge variant="secondary" className="text-xs">Active</Badge>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Click below to get a dedicated WhatsApp number for your workspace. GoGio handles all the setup — no external accounts needed.
              </p>
              <Button
                onClick={handleProvision}
                disabled={provisionNumber.isPending}
                className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
              >
                {provisionNumber.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enable WhatsApp
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {isProvisioned && (
          <>
            <Separator />

            {/* Template Library */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                  Message Templates
                </h4>
                <Dialog open={showTemplateForm} onOpenChange={setShowTemplateForm}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-3 w-3 mr-1" />
                      Request Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request Custom Template</DialogTitle>
                      <DialogDescription>
                        Submit a custom message template for WhatsApp approval. Use {'{{1}}'}, {'{{2}}'}, etc. for variable placeholders.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label>Template Name</Label>
                        <Input
                          placeholder="e.g. Offer Letter Notification"
                          value={newTemplate.name}
                          onChange={(e) => setNewTemplate((p) => ({ ...p, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Message Body</Label>
                        <Textarea
                          placeholder="Hi {{1}}, we're pleased to inform you that..."
                          value={newTemplate.body_template}
                          onChange={(e) => setNewTemplate((p) => ({ ...p, body_template: e.target.value }))}
                          rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                          Use {'{{1}}'}, {'{{2}}'}, etc. for dynamic values like candidate name, job title, company name.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowTemplateForm(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateTemplate}
                        disabled={createTemplate.isPending || !newTemplate.name.trim() || !newTemplate.body_template.trim()}
                      >
                        {createTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Submit for Approval
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <p className="text-xs text-muted-foreground">
                WhatsApp requires pre-approved templates for first-contact messages. GoGio provides ready-to-use templates below.
              </p>

              {templatesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* GoGio Templates */}
                  {globalTemplates.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">GoGio Templates</p>
                      <div className="space-y-2">
                        {globalTemplates.map((t) => (
                          <TemplateCard key={t.id} template={t} isGlobal />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Templates */}
                  {customTemplates.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Custom Templates</p>
                      <div className="space-y-2">
                        {customTemplates.map((t) => (
                          <TemplateCard key={t.id} template={t} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function TemplateCard({ template, isGlobal }: { template: any; isGlobal?: boolean }) {
  const statusColors: Record<string, string> = {
    approved: 'border-[#25D366]/30 text-[#25D366]',
    pending: 'border-yellow-500/30 text-yellow-600',
    rejected: 'border-destructive/30 text-destructive',
    draft: 'border-muted-foreground/30 text-muted-foreground',
  }

  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{template.name}</p>
            {isGlobal && (
              <Badge variant="secondary" className="text-[10px] shrink-0">GoGio</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.body_template}</p>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] shrink-0 capitalize ${statusColors[template.approval_status] || ''}`}
        >
          {template.approval_status}
        </Badge>
      </div>
    </div>
  )
}
