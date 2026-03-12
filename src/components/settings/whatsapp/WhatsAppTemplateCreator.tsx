import { useState, useRef } from 'react'
import { Loader2, AlertCircle, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateWhatsAppTemplate } from '@/hooks/useWhatsAppConfig'
import { toast } from 'sonner'

interface WhatsAppTemplateCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AVAILABLE_VARIABLES = [
  { key: 'candidate_name', label: 'Candidate Name', description: 'The candidate\'s full name' },
  { key: 'recruiter_name', label: 'Recruiter Name', description: 'Your name or the assigned recruiter' },
  { key: 'company_name', label: 'Company Name', description: 'Your organization\'s name' },
  { key: 'job_title', label: 'Job Title', description: 'The job position title' },
  { key: 'interview_date', label: 'Interview Date', description: 'Scheduled interview date' },
  { key: 'interview_time', label: 'Interview Time', description: 'Scheduled interview time' },
  { key: 'offer_details', label: 'Offer Details', description: 'Summary of the offer' },
  { key: 'portal_link', label: 'Portal Link', description: 'Link to candidate portal' },
]

const CATEGORIES = [
  { value: 'UTILITY', label: 'Utility', description: 'Transaction-related messages (scheduling, updates)' },
  { value: 'MARKETING', label: 'Marketing', description: 'Promotional or outreach messages' },
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
]

export function WhatsAppTemplateCreator({ open, onOpenChange }: WhatsAppTemplateCreatorProps) {
  const createTemplate = useCreateWhatsAppTemplate()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showPreview, setShowPreview] = useState(false)

  const [form, setForm] = useState({
    name: '',
    body_template: '',
    category: 'UTILITY',
    language: 'en',
  })

  const [errors, setErrors] = useState<string[]>([])

  const insertVariable = (varKey: string) => {
    const tag = `{{${varKey}}}`
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const current = form.body_template
      const updated = current.substring(0, start) + tag + current.substring(end)
      setForm((p) => ({ ...p, body_template: updated }))
      setTimeout(() => {
        textarea.focus()
        const newPos = start + tag.length
        textarea.setSelectionRange(newPos, newPos)
      }, 0)
    } else {
      setForm((p) => ({ ...p, body_template: p.body_template + tag }))
    }
  }

  const validate = (): string[] => {
    const errs: string[] = []
    if (!form.name.trim()) errs.push('Template name is required.')
    if (!form.body_template.trim()) errs.push('Message body is required.')

    const body = form.body_template.trim()
    // Check variable at beginning
    if (/^\{\{[^}]+\}\}/.test(body)) {
      errs.push('Message cannot start with a variable. Add text before it.')
    }
    // Check variable at end
    if (/\{\{[^}]+\}\}$/.test(body)) {
      errs.push('Message cannot end with a variable. Add text or punctuation after it.')
    }
    // Check adjacent variables
    if (/\{\{[^}]+\}\}\s*\{\{[^}]+\}\}/.test(body)) {
      errs.push('Variables cannot be adjacent. Insert at least one word between them.')
    }
    // Check template is not too vague
    const withoutVars = body.replace(/\{\{[^}]+\}\}/g, '').trim()
    if (withoutVars.length < 20) {
      errs.push('Template body is too short. WhatsApp rejects templates that lack context.')
    }

    return errs
  }

  const getPreview = () => {
    let text = form.body_template
    AVAILABLE_VARIABLES.forEach((v) => {
      text = text.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), `[${v.label}]`)
    })
    return text
  }

  const handleSubmit = async () => {
    const validationErrors = validate()
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors([])

    try {
      await createTemplate.mutateAsync({
        name: form.name,
        body_template: form.body_template,
        category: form.category,
        language: form.language,
      })
      toast.success('Template saved as draft')
      setForm({ name: '', body_template: '', category: 'UTILITY', language: 'en' })
      setShowPreview(false)
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create template')
    }
  }

  const handleReset = () => {
    setForm({ name: '', body_template: '', category: 'UTILITY', language: 'en' })
    setErrors([])
    setShowPreview(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) handleReset() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create message template</DialogTitle>
          <DialogDescription>
            Design a reusable message template for WhatsApp outreach. After saving, you can submit it for Meta approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template name */}
          <div className="space-y-2">
            <Label>Template name</Label>
            <Input
              placeholder="e.g. interview_schedule_confirmation"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <p className="text-[11px] text-muted-foreground">
              Use a descriptive name. WhatsApp may reject reused names for 30 days.
            </p>
          </div>

          {/* Category + Language */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div>
                        <span>{c.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={form.language} onValueChange={(v) => setForm((p) => ({ ...p, language: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Message body */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Message body</Label>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Eye className="h-3 w-3" />
                {showPreview ? 'Edit' : 'Preview'}
              </button>
            </div>

            {showPreview ? (
              <div className="p-3 rounded-lg bg-[#25D366]/5 border border-[#25D366]/20 min-h-[100px]">
                <p className="text-sm text-foreground whitespace-pre-wrap">{getPreview() || 'Empty message'}</p>
              </div>
            ) : (
              <>
                <Textarea
                  ref={textareaRef}
                  placeholder="Hi {{candidate_name}}, this is {{recruiter_name}} from {{company_name}}. We'd like to discuss the {{job_title}} position with you."
                  value={form.body_template}
                  onChange={(e) => setForm((p) => ({ ...p, body_template: e.target.value }))}
                  rows={4}
                  className="text-sm"
                />
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Click a variable to insert it at your cursor:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_VARIABLES.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVariable(v.key)}
                        title={v.description}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer border border-primary/20"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 space-y-1">
              {errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive">{err}</p>
                </div>
              ))}
            </div>
          )}

          {/* First-contact note */}
          <div className="p-2.5 rounded-lg bg-muted/30">
            <p className="text-[11px] text-muted-foreground">
              <strong>Note:</strong> This template will be saved as a draft. To use it for first-contact messaging, 
              submit it for Meta approval from the Template Library. Approval typically takes minutes but can take up to 48 hours.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { onOpenChange(false); handleReset() }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createTemplate.isPending || !form.name.trim() || !form.body_template.trim()}
          >
            {createTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
