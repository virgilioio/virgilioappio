import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { InlineEmpty } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Briefcase, CalendarDays, Check, ChevronLeft, ChevronRight, Loader2, MapPin, RefreshCcw, UserRound } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { format } from 'date-fns'
import { useOfferForms } from '@/hooks/useOfferForms'
import { CurrencySelect } from '@/components/ui/currency-select'
import type { SalaryFieldConfig, LocationFieldConfig, PhoneFieldConfig } from '@/hooks/useJobPostingFields'
import { useOfferFormFields, type OfferFormField } from '@/hooks/useOfferFormFields'
import { useOfferLetters } from '@/hooks/useOfferLetters'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { PhoneInput } from '@/components/ui/phone-input'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useRecruiterOptions } from '@/hooks/useRecruiterOptions'
import { useOfferApprovalRequest } from '@/hooks/useOfferApprovalRequest'
import { logActivity } from '@/lib/activityLogger'
import { useJobOpenings } from '@/hooks/useJobOpenings'
import { useOfferApprovalChain } from '@/hooks/useOfferApprovalChain'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface OfferComposerBodyProps {
  candidateId: string
  candidateName: string
  jobId: string
  jobTitle?: string
  organizationId: string
  selectedFormId: string
  onSelectedFormIdChange: (id: string) => void
  fieldValues: Record<string, any>
  onFieldValuesChange: (values: Record<string, any>) => void
  openingId: string
  onOpeningIdChange: (id: string) => void
  onSuccess: () => void
  onCancel: () => void
  onSaveDraft: () => void
  draftRestored?: boolean
  editingOfferId?: string
}

const fieldKey = (field: OfferFormField) => `${field.field_name} ${field.field_label}`.toLowerCase()
const isCompField = (field: OfferFormField) => /salary|compensation|currency|pay period|bonus|equity|vesting/.test(fieldKey(field)) || field.field_type === 'salary'
const isRoleField = (field: OfferFormField) => /title|role|reports|manager|start date|location|employment|expire/.test(fieldKey(field)) || ['date', 'recruiter', 'employment_type', 'work_location', 'location'].includes(field.field_type)
const isBenefitField = (field: OfferFormField) => field.field_type === 'checkbox' || /benefit|pto|stipend|relocation|non-compete|background check/.test(fieldKey(field))

function numericValue(value: any): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); if (parsed && typeof parsed === 'object') return Number(parsed.amount) || 0 } catch { /* plain value */ }
    return Number(value.replace(/[^0-9.-]/g, '')) || 0
  }
  return Number(value?.amount) || 0
}

function shortMoney(value: number, currency = 'USD') {
  if (!value) return '—'
  return new Intl.NumberFormat('en', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function OfferSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="mb-[18px]"><div className="mb-2.5 flex items-center justify-between gap-3"><h3 className="font-poppins text-[12.5px] font-semibold uppercase tracking-[0.06em] text-dup-text">{title}</h3>{action}</div><div className="rounded-lg border border-virgilio-border bg-card p-4">{children}</div></section>
}

export function OfferComposerBody({
  candidateId,
  candidateName,
  jobId,
  jobTitle,
  organizationId,
  selectedFormId,
  onSelectedFormIdChange,
  fieldValues,
  onFieldValuesChange,
  openingId,
  onOpeningIdChange,
  onSuccess,
  onCancel,
  onSaveDraft,
  draftRestored,
  editingOfferId,
}: OfferComposerBodyProps) {
  const { user } = useAuth()
  const { forms, isLoading: formsLoading } = useOfferForms()
  const { fields, isLoading: fieldsLoading } = useOfferFormFields(selectedFormId)
  const { offerLetters, createOfferLetter, updateOfferLetter, isLoading: creatingLetter } = useOfferLetters(candidateId)
  const { data: recruiterOptions = [] } = useRecruiterOptions(organizationId)
  const { openings, isLoading: openingsLoading } = useJobOpenings(jobId)
  const { chain, isLoading: chainLoading } = useOfferApprovalChain(jobId)
  const [step, setStep] = useState(1)

  // Find the current offer being edited to check its status
  const currentOffer = editingOfferId ? offerLetters.find(ol => ol.id === editingOfferId) : null
  const availableOpenings = openings.filter((opening) =>
    opening.status === 'open'
    || opening.id === currentOffer?.opening_id
    || (opening.status === 'offer' && opening.candidate_id === candidateId),
  )

  useEffect(() => {
    if (openingId || availableOpenings.length === 0) return
    onOpeningIdChange(availableOpenings[0].id)
  }, [openingId, availableOpenings, onOpeningIdChange])
  useEffect(() => {
    if (!openingId) return
    const opening = openings.find((item) => item.id === openingId)
    const startField = fields.find((field) => /start.*date|date.*start/i.test(`${field.field_name} ${field.field_label}`) && field.field_type === 'date')
    if (!opening?.target_start_date || !startField || fieldValues[startField.field_name]) return
    onFieldValuesChange({ ...fieldValues, [startField.field_name]: opening.target_start_date })
  }, [openingId, openings, fields, fieldValues, onFieldValuesChange])
  const shouldLoadApproval = currentOffer?.status === 'pending_approval' || currentOffer?.status === 'approved'
  const { approvalRequest, recallApproval } = useOfferApprovalRequest(
    shouldLoadApproval ? editingOfferId : undefined,
    jobId
  )

  const activeForms = forms.filter(f => f.is_active)




  const sortedFields = useMemo(() => [...fields].sort((a, b) => a.display_order - b.display_order), [fields])
  const groups = useMemo(() => {
    const role = sortedFields.filter(isRoleField)
    const compensation = sortedFields.filter((field) => !role.includes(field) && isCompField(field))
    const benefits = sortedFields.filter((field) => !role.includes(field) && !compensation.includes(field) && isBenefitField(field))
    const additional = sortedFields.filter((field) => !role.includes(field) && !compensation.includes(field) && !benefits.includes(field))
    return { role, compensation, benefits, additional }
  }, [sortedFields])
  const comp = useMemo(() => {
    const salary = sortedFields.find((field) => /base salary|base compensation|annual salary/.test(fieldKey(field))) || sortedFields.find((field) => field.field_type === 'salary')
    const equity = sortedFields.find((field) => /equity.*value|equity grant|stock/.test(fieldKey(field)))
    const bonus = sortedFields.find((field) => /sign.*bonus|signing bonus/.test(fieldKey(field)))
    const currencyField = sortedFields.find((field) => /currency/.test(fieldKey(field)))
    let currency = currencyField ? String(fieldValues[currencyField.field_name] || 'USD') : 'USD'
    const salaryRaw = salary ? fieldValues[salary.field_name] : null
    try { currency = JSON.parse(salaryRaw)?.currency || currency } catch { /* configured currency */ }
    const base = salary ? numericValue(salaryRaw) : 0
    const equityValue = equity ? numericValue(fieldValues[equity.field_name]) : 0
    const bonusValue = bonus ? numericValue(fieldValues[bonus.field_name]) : 0
    return { base, equity: equityValue, bonus: bonusValue, total: base + equityValue + bonusValue, currency }
  }, [sortedFields, fieldValues])
  const firstName = candidateName.trim().split(/\s+/)[0] || candidateName
  const selectedOpening = openings.find((opening) => opening.id === openingId)

  const handleFieldChange = (fieldName: string, value: any) => {
    onFieldValuesChange({ ...fieldValues, [fieldName]: value })
  }

  const canSave = () => {
    if (!selectedFormId || !organizationId || !jobId || !openingId || !availableOpenings.some((opening) => opening.id === openingId)) return false
    const requiredFields = fields.filter(f => f.is_required)
    return requiredFields.every(field => {
      const val = fieldValues[field.field_name]
      return val !== undefined && val !== null && val !== ''
    })
  }

  const handleSave = async () => {
    if (!organizationId) {
      toast({ title: 'Error', description: 'Organization is required.', variant: 'destructive' })
      return
    }
    if (!jobId) {
      toast({ title: 'Error', description: 'Job association is required to create an offer.', variant: 'destructive' })
      return
    }
    try {
      if (editingOfferId) {
        const offerStatus = currentOffer?.status
        const isApprovalActive = offerStatus === 'pending_approval' || offerStatus === 'approved'
        
        if (isApprovalActive) {
          const originalValues = currentOffer.field_values || {}
          const restartFields = fields.filter(f => f.triggers_approval_restart)
          const hasRestartTrigger = restartFields.some(f => {
            const oldVal = JSON.stringify(originalValues[f.field_name] ?? '')
            const newVal = JSON.stringify(fieldValues[f.field_name] ?? '')
            return oldVal !== newVal
          })
          
          if (hasRestartTrigger) {
            // Recall the approval request if one exists
            if (approvalRequest && (approvalRequest.status === 'pending' || approvalRequest.status === 'approved')) {
              await recallApproval(approvalRequest.id)
            } else {
              // No active approval request to recall (e.g. approved offer), revert status directly
              await supabase
                .from('offer_letters')
                .update({ status: 'draft' })
                .eq('id', editingOfferId)
            }
            
            // Delete stale offer document
            const { data: attachments } = await supabase
              .from('candidate_attachments')
              .select('id, file_url')
              .eq('candidate_id', candidateId)
              .like('file_name', 'Offer Letter%')
            
            if (attachments && attachments.length > 0) {
              // Delete from storage
              const filePaths = attachments.map(a => a.file_url)
              await supabase.storage.from('candidate-attachments').remove(filePaths)
              // Delete DB rows
              const ids = attachments.map(a => a.id)
              await supabase.from('candidate_attachments').delete().in('id', ids)
              // Trigger UI refresh for attachments
              window.dispatchEvent(new CustomEvent('refetch-attachments'))
            }
          }
        }
        
        await updateOfferLetter(editingOfferId, {
          form_id: selectedFormId,
          field_values: fieldValues,
          opening_id: openingId,
        })
        // Log offer update activity
        const originalValues = currentOffer?.field_values || {}
        const changedFields = fields
          .filter(f => JSON.stringify(originalValues[f.field_name] ?? '') !== JSON.stringify(fieldValues[f.field_name] ?? ''))
          .map(f => f.field_label)
        logActivity({
          activityType: 'offer_updated',
          title: `Offer updated for ${candidateName}`,
          entityType: 'candidate',
          entityId: candidateId,
          organizationId,
          metadata: { candidateId, jobId, changedFields },
        })
      } else {
        const title = `Offer - ${candidateName} - ${jobTitle || 'Position'}`
        await createOfferLetter({
          candidate_id: candidateId,
          job_id: jobId,
          opening_id: openingId,
          form_id: selectedFormId,
          organization_id: organizationId,
          title,
          field_values: fieldValues,
          status: 'draft',
          created_by: user?.id,
        })
        // Log offer creation activity
        logActivity({
          activityType: 'offer_created',
          title: `Offer created for ${candidateName}`,
          entityType: 'candidate',
          entityId: candidateId,
          organizationId,
          metadata: { candidateId, jobId },
        })
      }
      // Trigger live UI update across components
      window.dispatchEvent(new CustomEvent('refetch-offer-letters'))
      onSuccess()
    } catch (error) {
      console.error('Failed to save offer:', error)
    }
  }

  const handleOpeningChange = (id: string) => {
    const previous = openings.find((opening) => opening.id === openingId)
    const next = openings.find((opening) => opening.id === id)
    onOpeningIdChange(id)
    const startField = fields.find((field) => /start.*date|date.*start/i.test(`${field.field_name} ${field.field_label}`) && field.field_type === 'date')
    if (!startField || !next?.target_start_date) return
    const current = fieldValues[startField.field_name]
    if (!current || current === previous?.target_start_date) {
      onFieldValuesChange({ ...fieldValues, [startField.field_name]: next.target_start_date })
    }
  }

  const renderFieldInput = (field: OfferFormField) => {
    const value = fieldValues[field.field_name] || ''
    const placeholder = field.placeholder_text || `Enter ${field.field_label.toLowerCase()}...`

    switch (field.field_type) {
      case 'textarea':
        return (
          <Textarea
            id={field.field_name}
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            placeholder={placeholder}
            rows={3}
          />
        )
      case 'date':
        return (
          <DatePickerVirgilio
            value={value ? new Date(value + 'T00:00:00') : undefined}
            onChange={(date) => handleFieldChange(field.field_name, format(date, 'yyyy-MM-dd'))}
            placeholder="Pick a date"
          />
        )
      case 'number':
        return (
          <Input
            id={field.field_name}
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            placeholder={placeholder}
          />
        )
      case 'email':
        return (
          <Input
            id={field.field_name}
            type="email"
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            placeholder={placeholder}
          />
        )
      case 'checkbox':
        return (
          <Switch checked={!!value} onCheckedChange={(checked) => handleFieldChange(field.field_name, checked)} className="h-[18px] w-8 border-0 [&>span]:h-3.5 [&>span]:w-3.5 data-[state=checked]:[&>span]:translate-x-[14px]" />
        )
      case 'salary': {
        const salaryConfig = (field as any).field_config as SalaryFieldConfig | null
        const period = salaryConfig?.period || 'annually'
        const salaryValue = (() => {
          try {
            if (typeof value === 'object' && value) return value
            if (typeof value === 'string' && value) return JSON.parse(value)
            return { amount: '', currency: salaryConfig?.currency || 'USD' }
          } catch { return { amount: '', currency: salaryConfig?.currency || 'USD' } }
        })()
        return (
          <div className="flex items-center gap-2">
            <div className="w-[180px] shrink-0">
              <CurrencySelect
                value={salaryValue.currency}
                onChange={(c) => handleFieldChange(field.field_name, JSON.stringify({ ...salaryValue, currency: c }))}
              />
            </div>
            <Input
              id={field.field_name}
              type="number"
              value={salaryValue.amount}
              onChange={(e) => handleFieldChange(field.field_name, JSON.stringify({ ...salaryValue, amount: e.target.value }))}
              placeholder="Enter amount"
            />
            <Badge variant="secondary" className="shrink-0 capitalize">{period}</Badge>
          </div>
        )
      }
      case 'location': {
        const locationConfig = (field as any).field_config as LocationFieldConfig | null
        const locationFields = locationConfig?.fields || ['city', 'state', 'country']
        const locationValue = (() => {
          try {
            if (typeof value === 'string' && value) return JSON.parse(value)
            if (typeof value === 'object' && value) return value
            return {}
          } catch { return {} }
        })()
        const updateLocation = (key: string, val: string) => {
          const next = { ...locationValue, [key]: val }
          handleFieldChange(field.field_name, JSON.stringify(next))
        }
        const colsClass = ({ 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' } as Record<number, string>)[locationFields.length] || 'md:grid-cols-3'
        return (
          <div className={`grid grid-cols-1 ${colsClass} gap-3`}>
            {locationFields.includes('city') && (
              <Input
                placeholder="City"
                value={locationValue.city || ''}
                onChange={(e) => updateLocation('city', e.target.value)}
              />
            )}
            {locationFields.includes('state') && (
              <Input
                placeholder="State / Province"
                value={locationValue.state || ''}
                onChange={(e) => updateLocation('state', e.target.value)}
              />
            )}
            {locationFields.includes('country') && (
              <Input
                placeholder="Country"
                value={locationValue.country || ''}
                onChange={(e) => updateLocation('country', e.target.value)}
              />
            )}
          </div>
        )
      }
      case 'phone': {
        const phoneConfig = (field as any).field_config as PhoneFieldConfig | null
        const defaultCountry = phoneConfig?.defaultCountryCode || '+1'
        return (
          <PhoneInput
            value={value || defaultCountry}
            onChange={(val) => handleFieldChange(field.field_name, val)}
            placeholder="Enter phone number"
          />
        )
      }
      case 'recruiter':
        return (
          <SearchableSelect
            options={recruiterOptions}
            value={value || ''}
            onValueChange={(val) => handleFieldChange(field.field_name, val)}
            placeholder="Search for a recruiter..."
          />
        )
      case 'employment_type':
        return (
          <Select value={value || ''} onValueChange={(v) => handleFieldChange(field.field_name, v)}>
            <SelectTrigger><SelectValue placeholder="Select employment type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Full-time</SelectItem>
              <SelectItem value="part_time">Part-time</SelectItem>
              <SelectItem value="temporary">Temporary</SelectItem>
              <SelectItem value="internship">Internship</SelectItem>
            </SelectContent>
          </Select>
        )
      case 'work_location':
        return (
          <Select value={value || ''} onValueChange={(v) => handleFieldChange(field.field_name, v)}>
            <SelectTrigger><SelectValue placeholder="Select work location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="onsite">On-site</SelectItem>
            </SelectContent>
          </Select>
        )
      default:
        return (
          <Input
            id={field.field_name}
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            placeholder={placeholder}
          />
        )
    }
  }

  const Field = ({ field }: { field: OfferFormField }) => {
    const Icon = /title|role/.test(fieldKey(field)) ? Briefcase : /manager|reports/.test(fieldKey(field)) ? UserRound : /location/.test(fieldKey(field)) ? MapPin : /date/.test(fieldKey(field)) ? CalendarDays : null
    if (field.field_type === 'checkbox') return <div className="flex items-center justify-between gap-4 border-b border-dup-rule py-2.5 last:border-0"><div><p className="font-inter text-[12.5px] font-medium text-dup-text">{field.field_label}</p>{field.help_text && <p className="mt-0.5 font-inter text-[11px] leading-[1.4] text-dup-subtle">{field.help_text}</p>}</div>{renderFieldInput(field)}</div>
    return <div className={cn('min-w-0', field.field_type === 'location' && 'sm:col-span-2')}><Label htmlFor={field.field_name} className="mb-1.5 flex items-center gap-1 font-inter text-[11.5px] font-medium text-dup-text">{Icon && <Icon className="h-[13px] w-[13px] text-dup-subtle" />}{field.field_label}{field.is_required ? <span className="text-destructive">*</span> : <span className="text-[10.5px] text-dup-subtle">(optional)</span>}{field.triggers_approval_restart && <TooltipProvider><Tooltip><TooltipTrigger asChild><RefreshCcw className="h-3 w-3 text-warning-foreground" /></TooltipTrigger><TooltipContent>Editing this field restarts approval</TooltipContent></Tooltip></TooltipProvider>}</Label>{renderFieldInput(field)}{field.help_text && <p className="mt-1 font-inter text-[11px] leading-[1.45] text-dup-subtle">{field.help_text}</p>}</div>
  }

  const steps = ['Template', 'Terms', 'Letter & approvals']
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[168px] shrink-0 overflow-y-auto border-r border-dup-hairline bg-dup-canvas-alt px-3 py-5 sm:block">
          {steps.map((label, index) => { const number = index + 1; const done = number < step; const active = number === step; return <button key={label} type="button" onClick={() => number <= step && setStep(number)} disabled={number > step} className={cn('mb-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-[7px] text-left', active && 'bg-card shadow-sm')}><span className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full font-poppins text-[10px] font-bold', done ? 'bg-virgilio-success text-primary-foreground' : active ? 'bg-primary text-primary-foreground' : 'bg-dup-hairline text-dup-muted')}>{done ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : number}</span><span className={cn('font-poppins text-[12.5px]', active ? 'font-semibold text-dup-ink' : 'font-medium text-dup-muted')}>{label}</span></button> })}
          <div className="mt-3 rounded-md bg-dup-purple-soft p-2.5"><p className="font-inter text-[10.5px] font-semibold uppercase tracking-[0.06em] text-dup-purple-deep">Comp band check</p><p className="mt-1 font-inter text-[11px] leading-[1.45] text-dup-muted">{comp.base ? `Compensation entered for ${jobTitle || 'this role'}. Gio checked automatically.` : 'Enter compensation to check it against the role band.'}</p></div>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto bg-dup-canvas-alt px-4 py-5 sm:px-6 sm:pb-6">
          {step === 1 && <OfferSection title="Offer template">{draftRestored && <Badge tone="neutral" size="xs" className="mb-3">Draft restored</Badge>}{formsLoading ? <div className="flex items-center gap-2 py-3 text-dup-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading forms…</div> : activeForms.length === 0 ? <InlineEmpty text="No offer forms available. Create one in Settings → Templates → Offer Forms." /> : <div><Label className="mb-1.5 block font-inter text-[11.5px] font-medium text-dup-text">Offer form <span className="text-destructive">*</span></Label><Select value={selectedFormId} onValueChange={onSelectedFormIdChange}><SelectTrigger><SelectValue placeholder="Choose an offer form…" /></SelectTrigger><SelectContent>{activeForms.map((form) => <SelectItem key={form.id} value={form.id}><span className="font-medium">{form.name}</span>{form.description && <span className="ml-2 text-dup-subtle">{form.description}</span>}</SelectItem>)}</SelectContent></Select></div>}</OfferSection>}
          {step === 2 && (fieldsLoading ? <div className="flex items-center gap-2 py-8 text-dup-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading offer terms…</div> : <>
            <OfferSection title="Role & start"><div className="mb-3"><Label className="mb-1.5 block font-inter text-[11.5px] font-medium text-dup-text">Req ID <span className="text-destructive">*</span></Label><Select value={openingId} onValueChange={handleOpeningChange} disabled={openingsLoading || availableOpenings.length === 0}><SelectTrigger><SelectValue placeholder={openingsLoading ? 'Loading openings…' : 'Choose an opening…'} /></SelectTrigger><SelectContent>{openings.map((opening) => { const unavailable = opening.status === 'filled' || (opening.status === 'offer' && opening.candidate_id !== candidateId && opening.id !== currentOffer?.opening_id); return <SelectItem key={opening.id} value={opening.id} disabled={unavailable}>{opening.req_id} · {opening.status === 'open' ? 'Open' : opening.status === 'offer' ? 'Reserved' : 'Filled'}</SelectItem> })}</SelectContent></Select><p className="mt-1 font-inter text-[11px] leading-[1.45] text-dup-subtle">The opening this offer fills. It's reserved while the offer is out and filled when {firstName} is marked hired.</p></div><div className="grid gap-3.5 sm:grid-cols-2">{groups.role.map((field) => <Field key={field.id} field={field} />)}</div></OfferSection>
            {groups.compensation.length > 0 && <OfferSection title="Compensation" action={<Badge tone="green" size="xs" dot>Band checked</Badge>}><div className="grid gap-3.5 sm:grid-cols-2">{groups.compensation.map((field) => <Field key={field.id} field={field} />)}</div><div className="mt-3.5 rounded-lg border border-dup-hairline bg-dup-canvas-alt p-3.5"><div className="mb-2.5 flex items-center justify-between"><p className="font-inter text-[11px] font-semibold uppercase tracking-[0.06em] text-dup-subtle">Y1 total compensation</p><Badge tone="lilac" size="xs">Auto-calculated</Badge></div><div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">{[['Base', comp.base], ['Equity (annualized)', comp.equity], ['Sign-on', comp.bonus], ['Total Y1', comp.total]].map(([label, value], index) => <div key={String(label)} className={cn('rounded-md border border-virgilio-border bg-card p-2.5', index === 3 && 'border-dup-purple-soft')}><p className="font-inter text-[10px] uppercase tracking-[0.06em] text-dup-subtle">{label}</p><p className={cn('mt-0.5 font-poppins text-[18px] font-semibold text-dup-ink', index === 3 && 'text-virgilio-purple')}>{shortMoney(Number(value), comp.currency)}</p></div>)}</div></div></OfferSection>}
            {groups.benefits.length > 0 && <OfferSection title="Benefits & conditions">{groups.benefits.map((field) => <Field key={field.id} field={field} />)}</OfferSection>}
            {groups.additional.length > 0 && <OfferSection title="Additional terms"><div className="grid gap-3.5 sm:grid-cols-2">{groups.additional.map((field) => <Field key={field.id} field={field} />)}</div></OfferSection>}
          </>)}
          {step === 3 && <><OfferSection title="Letter preview"><div className="space-y-3 font-inter text-[12.5px] text-dup-muted"><div className="flex justify-between gap-4 border-b border-dup-rule pb-3"><span>Candidate</span><strong className="text-dup-text">{candidateName}</strong></div><div className="flex justify-between gap-4 border-b border-dup-rule pb-3"><span>Role</span><strong className="text-dup-text">{jobTitle || '—'}</strong></div><div className="flex justify-between gap-4"><span>Opening</span><strong className="text-dup-text">{selectedOpening?.req_id || '—'}</strong></div></div></OfferSection><OfferSection title="Approval route">{chainLoading ? <div className="flex items-center gap-2 text-dup-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading approval route…</div> : !chain?.is_enabled || chain.steps.length === 0 ? <p className="font-inter text-[12.5px] text-dup-muted">No approval chain is required for this job. The offer will remain a draft until it is sent.</p> : <div className="space-y-2">{chain.steps.map((approvalStep, index) => <div key={approvalStep.id} className="flex items-center gap-3 rounded-md border border-virgilio-border px-3 py-2.5"><span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-dup-hairline font-poppins text-[10px] font-bold text-dup-muted">{index + 1}</span><div><p className="font-inter text-[12.5px] font-medium text-dup-text">{approvalStep.approver_name}</p><p className="font-inter text-[11px] text-dup-subtle">{approvalStep.condition === 'always' ? 'Always required' : approvalStep.condition.replace(/_/g, ' ')}</p></div></div>)}</div>}</OfferSection></>}
        </main>
      </div>
      <footer className="flex shrink-0 items-center gap-2.5 border-t border-dup-hairline bg-card px-4 py-3 sm:px-6">{step > 1 && <Button variant="ghost" size="md" icon={ChevronLeft} onClick={() => setStep((current) => current - 1)}>Back</Button>}<p className="min-w-0 flex-1 truncate font-inter text-[11.5px] text-dup-subtle">Auto-saved{comp.total ? ` · Y1 total ${shortMoney(comp.total, comp.currency)}` : ''}</p><Button variant="secondary" size="md" onClick={() => { onSaveDraft(); toast({ title: 'Draft saved' }) }}>Save draft</Button>{step < 3 ? <Button size="md" iconRight={ChevronRight} onClick={() => setStep((current) => current + 1)} disabled={step === 1 && !selectedFormId}>{step === 1 ? 'Continue' : 'Preview letter'}</Button> : <Button size="md" iconRight={ChevronRight} onClick={handleSave} disabled={!canSave() || creatingLetter}>{creatingLetter ? 'Saving…' : editingOfferId ? 'Update offer' : chain?.is_enabled && chain.steps.length ? 'Save for approval' : 'Save offer'}</Button>}</footer>
    </div>
  )
}
