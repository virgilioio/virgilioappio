import { useState } from 'react'
import { FileText, Filter, Loader2, RefreshCw, Send, Plus, Copy, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  useWhatsAppTemplates,
  useSubmitWhatsAppTemplate,
  useCheckWhatsAppTemplateStatus,
  type WhatsAppTemplate,
} from '@/hooks/useWhatsAppConfig'
import { WhatsAppTemplateCreator } from './WhatsAppTemplateCreator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type TemplateFilter = 'all' | 'draft' | 'pending' | 'approved' | 'rejected'

const FILTER_OPTIONS: { value: TemplateFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

export function WhatsAppTemplateLibrary() {
  const { data: templates = [], isLoading } = useWhatsAppTemplates()
  const [filter, setFilter] = useState<TemplateFilter>('all')
  const [showCreator, setShowCreator] = useState(false)

  const getTemplateStatus = (t: WhatsAppTemplate) => {
    if (!t.twilio_content_sid) return 'draft'
    if (t.approval_status === 'approved') return 'approved'
    if (t.approval_status === 'rejected') return 'rejected'
    return 'pending'
  }

  const filteredTemplates = templates.filter((t) => {
    if (filter === 'all') return true
    return getTemplateStatus(t) === filter
  })

  const globalTemplates = filteredTemplates.filter((t) => !t.tenant_id)
  const customTemplates = filteredTemplates.filter((t) => !!t.tenant_id)

  const counts = {
    all: templates.length,
    draft: templates.filter((t) => !t.twilio_content_sid).length,
    pending: templates.filter((t) => !!t.twilio_content_sid && t.approval_status === 'pending').length,
    approved: templates.filter((t) => !!t.twilio_content_sid && t.approval_status === 'approved').length,
    rejected: templates.filter((t) => !!t.twilio_content_sid && t.approval_status === 'rejected').length,
  }

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
            Manage your WhatsApp message templates. Templates must be approved by Meta before use.
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

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/30">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5',
              filter === opt.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
            {counts[opt.value] > 0 && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                filter === opt.value ? 'bg-muted text-muted-foreground' : 'bg-muted/50 text-muted-foreground'
              )}>
                {counts[opt.value]}
              </span>
            )}
          </button>
        ))}
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

        {filteredTemplates.length === 0 && (
          <div className="text-center py-8">
            <FileText className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {filter === 'all' ? 'No templates yet.' : `No ${filter} templates.`}
            </p>
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
      label: 'Draft',
      description: 'Saved locally. Not yet submitted for approval.',
      className: 'border-muted-foreground/30 text-muted-foreground bg-muted/20',
    }
  }

  switch (template.approval_status) {
    case 'approved':
      return {
        label: 'Approved',
        description: 'Approved by Meta. Ready for first-contact messaging.',
        className: 'border-[#25D366]/30 text-[#25D366] bg-[#25D366]/5',
      }
    case 'rejected':
      return {
        label: 'Rejected',
        description: 'Rejected by Meta. Edit and resubmit with a new name.',
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

const LABEL_MAP: Record<string, string> = {
  candidate_name: 'Candidate Name',
  recruiter_name: 'Recruiter Name',
  company_name: 'Company Name',
  job_title: 'Job Title',
  interview_date: 'Interview Date',
  interview_time: 'Interview Time',
  offer_details: 'Offer Details',
  portal_link: 'Portal Link',
}

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
  const submitTemplate = useSubmitWhatsAppTemplate()
  const checkStatus = useCheckWhatsAppTemplateStatus()
  const isDraft = !template.twilio_content_sid
  const isPending = !!template.twilio_content_sid && template.approval_status === 'pending'
  const isRejected = !!template.twilio_content_sid && template.approval_status === 'rejected'

  const handleSubmit = async () => {
    try {
      await submitTemplate.mutateAsync(template.id)
      toast.success('Template submitted for approval')
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit template')
    }
  }

  const handleCheckStatus = async () => {
    try {
      const result = await checkStatus.mutateAsync(template.id)
      toast.success(`Status: ${result.approval_status}`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to check status')
    }
  }

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
          {isDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSubmit}
              disabled={submitTemplate.isPending}
              className="text-xs h-7"
            >
              {submitTemplate.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Send className="h-3 w-3 mr-1" />
              )}
              Submit
            </Button>
          )}
          {isPending && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCheckStatus}
              disabled={checkStatus.isPending}
              className="text-xs h-7"
            >
              {checkStatus.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Refresh
            </Button>
          )}
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
