import { useState, useRef, useMemo, useEffect } from 'react'
import { Loader2, AlertCircle, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useCreateWhatsAppTemplate,
  useUpdateWhatsAppTemplate,
  type WhatsAppTemplate,
  type WhatsAppContentType,
  type QuickReplyAction,
  type CallToActionAction,
} from '@/hooks/useWhatsAppConfig'
import { AVAILABLE_PLACEHOLDERS } from '@/utils/placeholderUtils'
import { QuickReplyEditor } from './QuickReplyEditor'
import { CallToActionEditor } from './CallToActionEditor'
import { TemplateButtonPreview } from './TemplateButtonPreview'
import { toast } from 'sonner'

interface WhatsAppTemplateCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editTemplate?: WhatsAppTemplate | null
}

const WHATSAPP_CATEGORIES = ['Candidate', 'Job', 'Sender', 'Interview', 'Offer', 'Links']

const CATEGORIES = [
  { value: 'UTILITY', label: 'Utility', description: 'Transaction-related messages (scheduling, updates)' },
  { value: 'AUTHENTICATION', label: 'Authentication', description: 'One-time passcodes or verification messages' },
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
]

const CONTENT_TYPES: { value: WhatsAppContentType; label: string; description: string }[] = [
  { value: 'text', label: 'Text only', description: 'Plain message' },
  { value: 'quick_reply', label: 'Quick Reply', description: 'Up to 3 tap-to-reply buttons' },
  { value: 'call_to_action', label: 'Call to Action', description: 'Up to 2 URL or phone buttons' },
]

function unconvertBody(body: string, mapping: Record<string, string> | null): string {
  if (!mapping) return body
  let result = body
  Object.entries(mapping).forEach(([num, field]) => {
    result = result.replace(new RegExp(`\\{\\{${num}\\}\\}`, 'g'), `{{${field}}}`)
  })
  return result
}

const EMPTY_FORM = {
  name: '',
  body_template: '',
  category: 'UTILITY',
  language: 'en',
  content_type: 'text' as WhatsAppContentType,
  quick_reply_actions: [{ title: '' }] as QuickReplyAction[],
  cta_actions: [{ type: 'URL' as const, title: '', url: '' }] as CallToActionAction[],
}

export function WhatsAppTemplateCreator({ open, onOpenChange, editTemplate }: WhatsAppTemplateCreatorProps) {
  const createTemplate = useCreateWhatsAppTemplate()
  const updateTemplate = useUpdateWhatsAppTemplate()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showPreview, setShowPreview] = useState(false)

  const isEditing = !!editTemplate

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (editTemplate && open) {
      const ct = (editTemplate.content_type || 'text') as WhatsAppContentType
      const actions = editTemplate.actions || []

      setForm({
        name: editTemplate.name,
        body_template: unconvertBody(editTemplate.body_template, editTemplate.variable_mapping),
        category: editTemplate.category || 'UTILITY',
        language: editTemplate.language || 'en',
        content_type: ct,
        quick_reply_actions: ct === 'quick_reply' && actions.length > 0
          ? (actions as QuickReplyAction[])
          : [{ title: '' }],
        cta_actions: ct === 'call_to_action' && actions.length > 0
          ? (actions as CallToActionAction[])
          : [{ type: 'URL', title: '', url: '' }],
      })
      setErrors([])
      setShowPreview(false)
    }
  }, [editTemplate, open])

  const groupedPlaceholders = useMemo(() => {
    const relevant = AVAILABLE_PLACEHOLDERS.filter((p) =>
      WHATSAPP_CATEGORIES.includes(p.category)
    )
    const groups: Record<string, typeof AVAILABLE_PLACEHOLDERS> = {}
    relevant.forEach((p) => {
      if (!groups[p.category]) groups[p.category] = []
      groups[p.category].push(p)
    })
    return groups
  }, [])

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

  const currentActions = form.content_type === 'quick_reply'
    ? form.quick_reply_actions
    : form.content_type === 'call_to_action'
      ? form.cta_actions
      : []

  const validate = (): string[] => {
    const errs: string[] = []
    if (!form.name.trim()) errs.push('Template name is required.')
    if (!form.body_template.trim()) errs.push('Message body is required.')

    const body = form.body_template.trim()
    if (/^\{\{[^}]+\}\}/.test(body)) {
      errs.push('Message cannot start with a variable. Add text before it.')
    }
    if (/\{\{[^}]+\}\}$/.test(body)) {
      errs.push('Message cannot end with a variable. Add text or punctuation after it.')
    }
    if (/\{\{[^}]+\}\}\s*\{\{[^}]+\}\}/.test(body)) {
      errs.push('Variables cannot be adjacent. Insert at least one word between them.')
    }
    const withoutVars = body.replace(/\{\{[^}]+\}\}/g, '').trim()
    if (withoutVars.length < 20) {
      errs.push('Template body is too short. WhatsApp rejects templates that lack context.')
    }

    // Validate buttons
    if (form.content_type === 'quick_reply') {
      const emptyBtns = form.quick_reply_actions.filter((a) => !a.title.trim())
      if (emptyBtns.length > 0) errs.push('All quick reply buttons must have a label.')
    }

    if (form.content_type === 'call_to_action') {
      form.cta_actions.forEach((a, i) => {
        if (!a.title.trim()) errs.push(`Button ${i + 1} needs a label.`)
        if (a.type === 'URL' && !a.url?.trim()) errs.push(`Button ${i + 1} needs a URL.`)
        if (a.type === 'URL' && a.url && !/^https?:\/\/.+/.test(a.url))
          errs.push(`Button ${i + 1} URL must start with http:// or https://`)
        if (a.type === 'PHONE_NUMBER' && !a.phone?.trim()) errs.push(`Button ${i + 1} needs a phone number.`)
        if (a.type === 'PHONE_NUMBER' && a.phone && !/^\+\d{7,15}$/.test(a.phone.replace(/\s/g, '')))
          errs.push(`Button ${i + 1} phone must be E.164 format (e.g. +1234567890).`)
      })
    }

    return errs
  }

  const getPreview = () => {
    let text = form.body_template
    AVAILABLE_PLACEHOLDERS.forEach((p) => {
      text = text.replace(new RegExp(`\\{\\{${p.value.replace('.', '\\.')}\\}\\}`, 'g'), `[${p.label}]`)
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

    const actions = form.content_type === 'quick_reply'
      ? form.quick_reply_actions
      : form.content_type === 'call_to_action'
        ? form.cta_actions
        : undefined

    try {
      if (isEditing) {
        await updateTemplate.mutateAsync({
          template_id: editTemplate.id,
          name: form.name,
          body_template: form.body_template,
          category: form.category,
          language: form.language,
          content_type: form.content_type,
          actions,
        })
        toast.success('Template updated')
      } else {
        await createTemplate.mutateAsync({
          name: form.name,
          body_template: form.body_template,
          category: form.category,
          language: form.language,
          content_type: form.content_type,
          actions,
        })
        toast.success('Template saved as draft')
      }
      setForm(EMPTY_FORM)
      setShowPreview(false)
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to save template')
    }
  }

  const handleReset = () => {
    setForm(EMPTY_FORM)
    setErrors([])
    setShowPreview(false)
  }

  const isSaving = createTemplate.isPending || updateTemplate.isPending

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) handleReset() }}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit message template' : 'Create message template'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update your draft template. Once submitted for approval, it can no longer be edited.'
              : 'Design a reusable message template for WhatsApp outreach. After saving, you can submit it for Meta approval.'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
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

          {/* Content type selector */}
          <div className="space-y-2">
            <Label>Message type</Label>
            <RadioGroup
              value={form.content_type}
              onValueChange={(v) => setForm((p) => ({ ...p, content_type: v as WhatsAppContentType }))}
              className="grid grid-cols-3 gap-2"
            >
              {CONTENT_TYPES.map((ct) => (
                <label
                  key={ct.value}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                    form.content_type === ct.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <RadioGroupItem value={ct.value} className="sr-only" />
                  <span className="text-xs font-medium">{ct.label}</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">{ct.description}</span>
                </label>
              ))}
            </RadioGroup>
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
                <TemplateButtonPreview contentType={form.content_type} actions={currentActions} />
              </div>
            ) : (
              <>
                <Textarea
                  ref={textareaRef}
                  placeholder="Hi {{candidate.first_name}}, this is {{sender.first_name}} from our team. We'd like to discuss the {{job.title}} position with you."
                  value={form.body_template}
                  onChange={(e) => setForm((p) => ({ ...p, body_template: e.target.value }))}
                  rows={4}
                  className="text-sm"
                />
                <div className="space-y-2.5">
                  <p className="text-xs text-muted-foreground">Click a variable to insert it at your cursor:</p>
                  {Object.entries(groupedPlaceholders).map(([category, placeholders]) => (
                    <div key={category} className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{category}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {placeholders.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => insertVariable(p.value)}
                            title={`Inserts {{${p.value}}}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/25 transition-colors cursor-pointer border border-purple-500/30"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Button editors */}
          {form.content_type === 'quick_reply' && (
            <>
              <Separator />
              <QuickReplyEditor
                actions={form.quick_reply_actions}
                onChange={(a) => setForm((p) => ({ ...p, quick_reply_actions: a }))}
              />
            </>
          )}

          {form.content_type === 'call_to_action' && (
            <>
              <Separator />
              <CallToActionEditor
                actions={form.cta_actions}
                onChange={(a) => setForm((p) => ({ ...p, cta_actions: a }))}
              />
            </>
          )}

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
          {!isEditing && (
            <div className="p-2.5 rounded-lg bg-muted/30">
              <p className="text-[11px] text-muted-foreground">
                <strong>Note:</strong> This template will be saved as a draft. To use it for first-contact messaging, 
                submit it for Meta approval from the Template Library. Approval typically takes minutes but can take up to 48 hours.
              </p>
            </div>
          )}
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => { onOpenChange(false); handleReset() }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !form.name.trim() || !form.body_template.trim()}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEditing ? 'Save changes' : 'Save draft'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
