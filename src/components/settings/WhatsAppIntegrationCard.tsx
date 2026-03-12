import { useState, useRef } from 'react'
import { Check, Loader2, Phone, MessageSquareText, Plus, Send, Settings } from 'lucide-react'
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
    saveNumber,
  } = useWhatsAppConfig()

  const { data: templates = [], isLoading: templatesLoading } = useWhatsAppTemplates()
  const createTemplate = useCreateWhatsAppTemplate()

  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ name: '', body_template: '', category: 'UTILITY' })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [manualNumber, setManualNumber] = useState('')
  const [showManualSetup, setShowManualSetup] = useState(false)

  const handleSaveManualNumber = async () => {
    const cleaned = manualNumber.replace(/[^\d+]/g, '')
    if (!cleaned) return
    try {
      await saveNumber(cleaned.startsWith('+') ? cleaned : `+${cleaned}`)
      toast.success('WhatsApp sender number saved')
      setShowManualSetup(false)
      setManualNumber('')
    } catch {
      toast.error('Failed to save WhatsApp number')
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

  const AVAILABLE_VARIABLES = [
    { key: 'candidate_name', label: 'Candidate Name' },
    { key: 'recruiter_name', label: 'Recruiter Name' },
    { key: 'company_name', label: 'Company Name' },
    { key: 'job_title', label: 'Job Title' },
    { key: 'interview_date', label: 'Interview Date' },
    { key: 'interview_time', label: 'Interview Time' },
  ]

  const insertVariable = (varKey: string) => {
    const tag = `{{${varKey}}}`
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const current = newTemplate.body_template
      const updated = current.substring(0, start) + tag + current.substring(end)
      setNewTemplate((p) => ({ ...p, body_template: updated }))
      setTimeout(() => {
        textarea.focus()
        const newPos = start + tag.length
        textarea.setSelectionRange(newPos, newPos)
      }, 0)
    } else {
      setNewTemplate((p) => ({ ...p, body_template: p.body_template + tag }))
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
        {/* Number Configuration */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            WhatsApp Sender Number
          </h4>
          {isProvisioned ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="h-2 w-2 rounded-full bg-[#25D366]" />
                <span className="text-sm font-mono">{whatsappNumber}</span>
                <Badge variant="secondary" className="text-xs">Active</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowManualSetup(true)}
                className="text-xs text-muted-foreground"
              >
                <Settings className="h-3 w-3 mr-1" />
                Change sender number
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Enter your active Twilio WhatsApp Sender number. This must be a number already registered as a WhatsApp Sender in your Twilio console.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="+1 234 567 8900"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleSaveManualNumber}
                  disabled={!manualNumber.trim() || isSaving}
                  className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Manual number change dialog */}
          {showManualSetup && (
            <div className="p-3 rounded-lg border border-border space-y-2">
              <Label className="text-xs">New WhatsApp Sender Number</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="+1 234 567 8900"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                  className="flex-1"
                />
                <Button size="sm" onClick={handleSaveManualNumber} disabled={!manualNumber.trim() || isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowManualSetup(false); setManualNumber('') }}>
                  Cancel
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Must be registered as an active WhatsApp Sender in Twilio.
              </p>
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
                        Submit a custom message template for WhatsApp approval. Click a variable below to insert it into your message.
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
                          ref={textareaRef}
                          placeholder="Hi {{candidate_name}}, we're pleased to inform you that..."
                          value={newTemplate.body_template}
                          onChange={(e) => setNewTemplate((p) => ({ ...p, body_template: e.target.value }))}
                          rows={4}
                        />
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">Click to insert a variable at cursor position:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {AVAILABLE_VARIABLES.map((v) => (
                              <button
                                key={v.key}
                                type="button"
                                onClick={() => insertVariable(v.key)}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer border border-primary/20"
                              >
                                {v.label}
                              </button>
                            ))}
                          </div>
                        </div>
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

function resolveTemplatePreview(bodyTemplate: string, variableMapping: Record<string, string> | null) {
  if (!variableMapping) return bodyTemplate
  const labelMap: Record<string, string> = {
    candidate_name: 'Candidate Name',
    recruiter_name: 'Recruiter Name',
    company_name: 'Company Name',
    job_title: 'Job Title',
    interview_date: 'Interview Date',
    interview_time: 'Interview Time',
    offer_details: 'Offer Details',
    portal_link: 'Portal Link',
  }
  let text = bodyTemplate
  Object.entries(variableMapping).forEach(([num, field]) => {
    const label = labelMap[field] || field
    text = text.replace(new RegExp(`\\{\\{${num}\\}\\}`, 'g'), `[${label}]`)
  })
  return text
}

function deriveDisplayStatus(template: any): { label: string; className: string } {
  const hasContentSid = !!template.twilio_content_sid
  if (!hasContentSid) {
    return { label: 'Not submitted', className: 'border-muted-foreground/30 text-muted-foreground' }
  }
  if (template.approval_status === 'approved') {
    return { label: 'Approved', className: 'border-[#25D366]/30 text-[#25D366]' }
  }
  if (template.approval_status === 'rejected') {
    return { label: 'Rejected', className: 'border-destructive/30 text-destructive' }
  }
  return { label: 'Pending review', className: 'border-yellow-500/30 text-yellow-600' }
}

function TemplateCard({ template, isGlobal }: { template: any; isGlobal?: boolean }) {
  const status = deriveDisplayStatus(template)
  const previewText = resolveTemplatePreview(template.body_template, template.variable_mapping)

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
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{previewText}</p>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] shrink-0 ${status.className}`}
        >
          {status.label}
        </Badge>
      </div>
    </div>
  )
}
