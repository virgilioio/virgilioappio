import { useState } from 'react'
import { FileText, Loader2, Plus, AlertCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  useWhatsAppTemplates,
  type WhatsAppTemplate,
} from '@/hooks/useWhatsAppConfig'
import { WhatsAppTemplateCreator } from './WhatsAppTemplateCreator'
import { AVAILABLE_PLACEHOLDERS } from '@/utils/placeholderUtils'
import { cn } from '@/lib/utils'

export function WhatsAppTemplateLibrary() {
  const { data: templates = [], isLoading } = useWhatsAppTemplates()
  const [showCreator, setShowCreator] = useState(false)

  const globalTemplates = templates.filter((t) => !t.tenant_id)
  const customTemplates = templates.filter((t) => !!t.tenant_id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Template Library
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pre-approved templates for first-contact messaging.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreator(true)}
          className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
        >
          <Plus className="h-3 w-3 mr-1" />
          New Template
        </Button>
      </div>

      {/* Info note about custom templates */}
      <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-start gap-2">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          GoGio templates are ready to use. Custom templates require GoGio team approval before they can be used for first-contact messaging.
        </p>
      </div>

      {/* Template list */}
      <div className="space-y-4">
        {globalTemplates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">GoGio Templates</p>
            <div className="space-y-2">
              {globalTemplates.map((t) => (
                <TemplateRow key={t.id} template={t} />
              ))}
            </div>
          </div>
        )}

        {customTemplates.length > 0 && globalTemplates.length > 0 && <Separator />}

        {customTemplates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Custom Templates</p>
            <div className="space-y-2">
              {customTemplates.map((t) => (
                <TemplateRow key={t.id} template={t} />
              ))}
            </div>
          </div>
        )}

        {templates.length === 0 && (
          <div className="text-center py-8">
            <FileText className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No templates yet.</p>
          </div>
        )}
      </div>

      {/* Template creator dialog */}
      <WhatsAppTemplateCreator
        open={showCreator}
        onOpenChange={setShowCreator}
      />
    </div>
  )
}

// --- Status helpers ---

function getStatusBadge(template: WhatsAppTemplate) {
  const hasContentSid = !!template.twilio_content_sid

  if (!hasContentSid) {
    return {
      label: template.tenant_id ? 'Draft' : 'Local only',
      description: template.tenant_id
        ? 'Saved locally. Contact GoGio team for approval.'
        : 'Template ready — Content SID will be added by GoGio team.',
      className: 'border-muted-foreground/30 text-muted-foreground bg-muted/20',
    }
  }

  switch (template.approval_status) {
    case 'approved':
      return {
        label: 'Ready to use',
        description: 'Approved by Meta. Ready for first-contact messaging.',
        className: 'border-[#25D366]/30 text-[#25D366] bg-[#25D366]/5',
      }
    case 'rejected':
      return {
        label: 'Rejected',
        description: 'Rejected by Meta. Contact GoGio team for assistance.',
        className: 'border-destructive/30 text-destructive bg-destructive/5',
      }
    case 'pending':
    default:
      return {
        label: 'Pending review',
        description: 'Submitted to Meta for approval. This can take up to 48 hours.',
        className: 'border-yellow-500/30 text-yellow-600 bg-yellow-500/5',
      }
  }
}

// Build label map from shared AVAILABLE_PLACEHOLDERS
const LABEL_MAP: Record<string, string> = Object.fromEntries(
  AVAILABLE_PLACEHOLDERS.map((p) => [p.value, p.label])
)

function resolvePreview(bodyTemplate: string, variableMapping: Record<string, string> | null) {
  if (!variableMapping) return bodyTemplate
  let text = bodyTemplate
  Object.entries(variableMapping).forEach(([num, field]) => {
    const label = LABEL_MAP[field] || field
    text = text.replace(new RegExp(`\\{\\{${num}\\}\\}`, 'g'), `[${label}]`)
  })
  return text
}

function TemplateRow({ template }: { template: WhatsAppTemplate }) {
  const status = getStatusBadge(template)
  const preview = resolvePreview(template.body_template, template.variable_mapping)
  const isRejected = !!template.twilio_content_sid && template.approval_status === 'rejected'

  return (
    <div className="p-4 rounded-lg border border-border bg-card group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground truncate">{template.name}</p>
            {!template.tenant_id && (
              <Badge variant="secondary" className="text-[10px] shrink-0">GoGio</Badge>
            )}
            <Badge
              variant="outline"
              className={cn('text-[10px] shrink-0', status.className)}
            >
              {status.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{preview}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1 hidden group-hover:block">{status.description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isRejected && (
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            </div>
          )}
        </div>
      </div>

      {/* Category + language info */}
      <div className="flex items-center gap-3 mt-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {template.category}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {template.language}
        </span>
      </div>
    </div>
  )
}
