import { useState } from 'react'
import { FileText, Loader2, Plus, AlertCircle, Info, Send, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  useWhatsAppTemplates,
  useSubmitWhatsAppTemplate,
  useCheckWhatsAppTemplateStatus,
  useDeleteWhatsAppTemplate,
  type WhatsAppTemplate,
} from '@/hooks/useWhatsAppConfig'
import { WhatsAppTemplateCreator } from './WhatsAppTemplateCreator'
import { AVAILABLE_PLACEHOLDERS } from '@/utils/placeholderUtils'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function WhatsAppTemplateLibrary() {
  const { data: templates = [], isLoading } = useWhatsAppTemplates()
  const [showCreator, setShowCreator] = useState(false)

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

      {/* Info note */}
      <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-start gap-2">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          GoGio templates are ready to use. Custom templates are submitted directly to Meta for approval — this typically takes minutes but can take up to 48 hours.
        </p>
      </div>

      {/* Template list */}
      <div className="space-y-4">
        {templates.length > 0 ? (
          <div className="space-y-2">
            {templates.map((t) => (
              <TemplateRow key={t.id} template={t} />
            ))}
          </div>
        ) : (
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
        ? 'Not yet submitted. Click "Submit for Approval" to send to Meta.'
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
        description: 'Rejected by Meta. You may create a new template with different content.',
        className: 'border-destructive/30 text-destructive bg-destructive/5',
      }
    case 'error':
      return {
        label: 'Error',
        description: 'There was an error submitting this template. Try again or contact support.',
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

  const isDraft = !!template.tenant_id && !template.twilio_content_sid
  const isPending = !!template.twilio_content_sid && template.approval_status === 'pending'

  const submitMutation = useSubmitWhatsAppTemplate()
  const checkStatusMutation = useCheckWhatsAppTemplateStatus()
  const deleteMutation = useDeleteWhatsAppTemplate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleSubmit = async () => {
    try {
      await submitMutation.mutateAsync(template.id)
      toast.success('Template submitted for Meta approval')
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit template')
    }
  }

  const handleRefreshStatus = async () => {
    try {
      const updated = await checkStatusMutation.mutateAsync(template.id)
      if (updated.approval_status === 'approved') {
        toast.success('Template approved! Ready to use.')
      } else if (updated.approval_status === 'rejected') {
        toast.error('Template was rejected by Meta.')
      } else {
        toast.info('Still pending review.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to check status')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(template.id)
      toast.success('Template deleted')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete template')
    } finally {
      setShowDeleteConfirm(false)
    }
  }

  return (
    <>
      <div className="p-4 rounded-lg border border-border bg-card group">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-foreground truncate">{template.name}</p>
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
            {isDraft && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="h-7 text-xs gap-1"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Submit
              </Button>
            )}
            {isPending && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRefreshStatus}
                disabled={checkStatusMutation.isPending}
                className="h-7 text-xs gap-1"
              >
                <RefreshCw className={cn("h-3 w-3", checkStatusMutation.isPending && "animate-spin")} />
                Refresh
              </Button>
            )}
            {isRejected && (
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteMutation.isPending}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </Button>
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

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{template.name}"
              {template.twilio_content_sid && ' and remove it from Twilio/Meta'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
