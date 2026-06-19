import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencySelect } from '@/components/ui/currency-select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { SafeHtml } from '@/components/ui/safe-html'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Sparkles,
  Wand2,
  Eye,
  ExternalLink,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useTenant } from '@/hooks/useTenant'
import { useJobPostings } from '@/hooks/useJobPostings'
import { useJobBoardIntegration } from '@/hooks/useJobBoardIntegration'
import { SheetApplicationFormBuilder } from './SheetApplicationFormBuilder'
import {
  PostingChannelsCard,
  type ChannelsValue,
} from './PostingChannelsCard'
import {
  PostingBrandingCard,
  type BrandingValue,
} from './PostingBrandingCard'

interface PostingSheetProps {
  jobId: string
  jobTitle?: string
  postingId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  readOnly?: boolean
  defaultTitle?: string
}

export function PostingSheet({
  jobId,
  jobTitle,
  postingId,
  open,
  onOpenChange,
  onSaved,
  readOnly,
  defaultTitle,
}: PostingSheetProps) {
  const { toast } = useToast()
  const { tenant } = useTenant()
  const { getPosting, createPosting, updatePosting } = useJobPostings(jobId)
  const { isEnabled: talentEnabled } = useJobBoardIntegration('talent')

  const isEdit = !!postingId
  const [localId, setLocalId] = useState<string | undefined>(postingId)
  const [isExternalUpdate, setIsExternalUpdate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generatingDesc, setGeneratingDesc] = useState(false)

  // Basics
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [referenceId, setReferenceId] = useState('')
  const [language, setLanguage] = useState('en')
  const [deadline, setDeadline] = useState<Date | undefined>()
  const [showInSearch, setShowInSearch] = useState(true)
  const [show24h, setShow24h] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [isPrimary, setIsPrimary] = useState(false)

  // Compensation & location (legacy preserved)
  const [location, setLocation] = useState('')
  const [employmentType, setEmploymentType] = useState('full_time')
  const [locationType, setLocationType] = useState('onsite')
  const [salaryCurrency, setSalaryCurrency] = useState('USD')
  const [salaryAmount, setSalaryAmount] = useState('')
  const [salaryPeriod, setSalaryPeriod] = useState('annually')
  const [showSalary, setShowSalary] = useState(false)
  const [hasCommissions, setHasCommissions] = useState(false)
  const [commissionsCurrency, setCommissionsCurrency] = useState('USD')
  const [commissionsAmount, setCommissionsAmount] = useState('')

  // Description
  const [description, setDescription] = useState('')

  // Branding
  const [branding, setBranding] = useState<BrandingValue>({})

  // Channels
  const [channels, setChannels] = useState<ChannelsValue>({
    publishToTalent: false,
    channels: {},
  })

  // Apply experience
  const [confirmationEmail, setConfirmationEmail] = useState(true)
  const [promise48h, setPromise48h] = useState(false)
  const [allowMessage, setAllowMessage] = useState(false)
  const [referralEnabled, setReferralEnabled] = useState(false)

  // SEO
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')

  // EEO
  const [eeoEnabled, setEeoEnabled] = useState(false)

  // About company collapsible (edit-mode legacy)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [compOpen, setCompOpen] = useState(false)

  useEffect(() => {
    setLocalId(postingId)
  }, [postingId])

  useEffect(() => {
    if (!open) return
    const load = async () => {
      if (postingId) {
        const p = await getPosting(postingId)
        if (p) {
          setTitle(p.title || '')
          setSlug(p.slug || '')
          setDescription(p.description || '')
          setIsActive(!!p.is_active)
          const d = (p as any).details || {}
          setReferenceId(d.reference_id || '')
          setLanguage(d.language || 'en')
          setDeadline(d.deadline ? new Date(d.deadline) : undefined)
          setShowInSearch(d.show_in_search !== false)
          setShow24h(!!d.show_24h_badge)
          setIsPrimary(!!d.is_primary)

          setLocation(d.location || '')
          setEmploymentType(d.employment_type || 'full_time')
          setLocationType(d.location_type || 'onsite')
          setSalaryCurrency(d.salary_currency || 'USD')
          setSalaryAmount(d.salary_amount != null ? String(d.salary_amount) : '')
          setSalaryPeriod(d.salary_period || 'annually')
          setShowSalary(!!d.show_salary)
          setHasCommissions(!!d.has_commissions)
          setCommissionsCurrency(d.commissions_currency || 'USD')
          setCommissionsAmount(d.commissions_amount != null ? String(d.commissions_amount) : '')

          setBranding(d.branding || {})
          setChannels({
            publishToTalent: !!(p as any).publish_to_talent,
            channels: d.channels || {},
          })
          const a = d.apply || {}
          setConfirmationEmail(a.confirmation_email !== false)
          setPromise48h(!!a.promise_48h)
          setAllowMessage(!!a.allow_message)
          setReferralEnabled(!!a.referral_enabled)
          const s = d.seo || {}
          setMetaTitle(s.meta_title || '')
          setMetaDescription(s.meta_description || '')
          setEeoEnabled(!!d.eeo_enabled)
          setIsExternalUpdate(true)
        }
      } else {
        setTitle(defaultTitle || '')
        setSlug('')
        setReferenceId('')
        setLanguage('en')
        setDeadline(undefined)
        setShowInSearch(true)
        setShow24h(false)
        setIsActive(false)
        setIsPrimary(false)
        setDescription('')
        setLocation('')
        setEmploymentType('full_time')
        setLocationType('onsite')
        setSalaryCurrency('USD')
        setSalaryAmount('')
        setSalaryPeriod('annually')
        setShowSalary(false)
        setHasCommissions(false)
        setCommissionsCurrency('USD')
        setCommissionsAmount('')
        setBranding({})
        setChannels({ publishToTalent: false, channels: {} })
        setConfirmationEmail(true)
        setPromise48h(false)
        setAllowMessage(false)
        setReferralEnabled(false)
        setMetaTitle('')
        setMetaDescription('')
        setEeoEnabled(false)
        setIsExternalUpdate(true)
      }
    }
    load()
  }, [open, postingId, getPosting, defaultTitle])

  const buildDetails = () => ({
    reference_id: referenceId || null,
    language,
    deadline: deadline ? deadline.toISOString() : null,
    show_in_search: showInSearch,
    show_24h_badge: show24h,
    is_primary: isPrimary,
    // legacy compensation & location
    location: location || null,
    employment_type: employmentType || null,
    location_type: locationType || null,
    salary_currency: salaryCurrency || null,
    salary_amount: salaryAmount ? Number(salaryAmount) : null,
    salary_period: salaryPeriod || null,
    show_salary: showSalary,
    has_commissions: hasCommissions,
    commissions_currency: hasCommissions ? commissionsCurrency : null,
    commissions_amount:
      hasCommissions && commissionsAmount ? Number(commissionsAmount) : null,
    // new
    branding,
    channels: channels.channels,
    apply: {
      confirmation_email: confirmationEmail,
      promise_48h: promise48h,
      allow_message: allowMessage,
      referral_enabled: referralEnabled,
    },
    seo: {
      meta_title: metaTitle || null,
      meta_description: metaDescription || null,
    },
    eeo_enabled: eeoEnabled,
  })

  const handleGenerateDescription = async () => {
    if (!jobId) return
    if (
      description.trim() &&
      !window.confirm('Replace the current description with a freshly generated one?')
    ) {
      return
    }
    setGeneratingDesc(true)
    try {
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle()
      if (jobError) throw jobError
      const jobData = { ...(job || {}), title: title || (job as any)?.title }
      const { data, error } = await supabase.functions.invoke('generate-job-description', {
        body: { jobData },
      })
      if (error) throw error
      if (data?.description) {
        setDescription(data.description)
        setIsExternalUpdate(true)
        toast({ title: 'Description generated', description: 'Gio refreshed the public copy.' })
      } else {
        throw new Error('No description returned')
      }
    } catch (e: any) {
      toast({
        title: 'Failed to generate description',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setGeneratingDesc(false)
    }
  }

  const save = async (publish?: boolean) => {
    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Enter a public job title', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const details = buildDetails()
      if (localId) {
        await updatePosting(localId, {
          title,
          description,
          details,
          publish_to_talent: channels.publishToTalent,
          ...(publish !== undefined ? { is_active: publish } : {}),
        } as any)
        toast({ title: 'Saved', description: 'Posting updated' })
      } else {
        const created = await createPosting({ title, description, details })
        if (created) {
          setLocalId(created.id)
          await updatePosting(created.id, {
            publish_to_talent: channels.publishToTalent,
            is_active: !!publish,
          } as any)
          toast({
            title: publish ? 'Published' : 'Saved as draft',
            description: publish ? 'Posting is now live' : 'Draft saved',
          })
        }
      }
      onSaved()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const enabledChannelsCount = useMemo(() => {
    let n = 1 // careers always
    Object.values(channels.channels).forEach((c) => {
      if (c?.enabled) n += 1
    })
    return n
  }, [channels])

  const eyebrow = isEdit ? 'EDIT POSTING' : 'NEW POSTING'
  const headerJob = jobTitle ? ` · ${jobTitle.toUpperCase()}` : ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[1040px] p-0 flex flex-col bg-[#FAFAF7]"
      >
        {/* Sticky header */}
        <header className="sticky top-0 z-10 bg-surface-primary border-b border-virgilio-border px-8 pt-6 pb-5">
          <div className="text-[10.5px] uppercase tracking-[0.06em] text-virgilio-purple font-inter">
            {eyebrow}
            <span className="text-text-tertiary">{headerJob}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <h2 className="font-poppins font-semibold text-[22px] tracking-[-0.04em] text-text-primary">
              {title || (isEdit ? 'Untitled posting' : 'Untitled posting')}
            </h2>
            <Badge tone={isActive ? 'green' : 'neutral'} size="xs" dot>
              {isActive ? 'Live' : 'Draft'}
            </Badge>
            {isEdit && isPrimary && (
              <Badge tone="lilac" size="xs">
                Primary
              </Badge>
            )}
          </div>
          <p className="text-[12.5px] text-text-secondary mt-1.5 max-w-2xl">
            {isEdit
              ? 'Tune copy, channels, and the apply experience. Changes go live as soon as you save.'
              : 'Compose a public posting in one scroll. Save as draft anytime — publish when ready.'}
          </p>
        </header>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* 1. POSTING BASICS */}
          <Section title="Posting basics" chip="Pulled from job info">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Public job title" required>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Senior Account Executive"
                  disabled={readOnly}
                />
              </FormField>
              <FormField label="URL slug" required>
                <div className="flex items-center rounded-lg border border-virgilio-border bg-surface-primary focus-within:ring-2 focus-within:ring-virgilio-purple/30">
                  <span className="px-3 text-[12.5px] text-text-tertiary font-mono border-r border-virgilio-border h-11 inline-flex items-center">
                    /jobs/
                  </span>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder={isEdit ? 'posting-slug' : 'auto-generated from title'}
                    className="border-0 focus-visible:ring-0 h-11"
                    disabled={readOnly}
                  />
                </div>
              </FormField>
              <FormField label="Reference ID">
                <Input
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  placeholder={isEdit ? 'REF-0001' : 'auto-generated'}
                  disabled={readOnly}
                />
              </FormField>
              <FormField label="Posting language">
                <Select value={language} onValueChange={setLanguage} disabled={readOnly}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">🇬🇧  English</SelectItem>
                    <SelectItem value="fr">🇫🇷  French</SelectItem>
                    <SelectItem value="es">🇪🇸  Spanish</SelectItem>
                    <SelectItem value="de">🇩🇪  German</SelectItem>
                    <SelectItem value="pt">🇵🇹  Portuguese</SelectItem>
                    <SelectItem value="it">🇮🇹  Italian</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Application deadline">
                <div className="flex items-center gap-2">
                  <DatePickerVirgilio
                    value={deadline}
                    onChange={setDeadline}
                    placeholder="No deadline · open until filled"
                    className="flex-1"
                  />
                  {deadline && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeadline(undefined)}
                      disabled={readOnly}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </FormField>
            </div>

            <div className="divide-y divide-virgilio-border/60 border-t border-virgilio-border/60 mt-4">
              <ToggleRow
                title="Show in public job search"
                helper="Appears on your careers page and indexed sites"
                checked={showInSearch}
                onChange={setShowInSearch}
                disabled={readOnly}
              />
              <ToggleRow
                title="Show 'apply within 24h response' badge"
                helper="Promises a first response within 24 hours"
                checked={show24h}
                onChange={setShow24h}
                disabled={readOnly}
              />
            </div>

            <Collapsible open={compOpen} onOpenChange={setCompOpen} className="mt-4">
              <CollapsibleTrigger className="flex items-center gap-1.5 text-[12.5px] text-text-secondary hover:text-text-primary">
                {compOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Compensation & location
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Location">
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., New York, NY" disabled={readOnly} />
                  </FormField>
                  <FormField label="Employment type">
                    <Select value={employmentType} onValueChange={setEmploymentType} disabled={readOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full-time</SelectItem>
                        <SelectItem value="part_time">Part-time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="internship">Internship</SelectItem>
                        <SelectItem value="temporary">Temporary</SelectItem>
                        <SelectItem value="freelance">Freelance</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Location type">
                    <Select value={locationType} onValueChange={setLocationType} disabled={readOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="onsite">On-site</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                        <SelectItem value="remote">Remote</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField label="Salary currency">
                    <CurrencySelect value={salaryCurrency} onChange={setSalaryCurrency} disabled={readOnly} />
                  </FormField>
                  <FormField label="Salary amount">
                    <Input type="number" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} placeholder="120000" disabled={readOnly} />
                  </FormField>
                  <FormField label="Period">
                    <Select value={salaryPeriod} onValueChange={setSalaryPeriod} disabled={readOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox id="show-salary" checked={showSalary} onCheckedChange={(c) => setShowSalary(!!c)} disabled={readOnly} />
                    <Label htmlFor="show-salary">Show salary on posting</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="has-commissions" checked={hasCommissions} onCheckedChange={(c) => setHasCommissions(!!c)} disabled={readOnly} />
                    <Label htmlFor="has-commissions">+ Commissions</Label>
                  </div>
                </div>
                {hasCommissions && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Commissions currency">
                      <CurrencySelect value={commissionsCurrency} onChange={setCommissionsCurrency} disabled={readOnly} />
                    </FormField>
                    <FormField label="Average commissions">
                      <Input type="number" value={commissionsAmount} onChange={(e) => setCommissionsAmount(e.target.value)} placeholder="15000" disabled={readOnly} />
                    </FormField>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </Section>

          {/* 2. PUBLIC DESCRIPTION */}
          <Section
            title="Public description"
            chip={isEdit ? 'Gio rewrote · 2d ago' : 'Gio will draft'}
          >
            <RichTextEditor
              value={description}
              onChange={(html) => setDescription(html)}
              placeholder={
                isEdit
                  ? 'Polish the public copy of this posting.'
                  : "Click 'Draft from job' to generate from the job information."
              }
              minHeight="240px"
              isExternalUpdate={isExternalUpdate}
              onExternalUpdateComplete={() => setIsExternalUpdate(false)}
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="purple"
                  size="sm"
                  icon={Sparkles}
                  disabled={readOnly}
                  loading={generatingDesc}
                  onClick={handleGenerateDescription}
                >
                  {isEdit ? 'Rewrite with Gio' : 'Draft from job'}
                </Button>
                <Button variant="ghost" size="sm" icon={Wand2} disabled={readOnly}>
                  {isEdit ? 'Improve clarity' : 'Generate with Gio'}
                </Button>
              </div>
              {isEdit && (
                <div className="text-[12px] text-text-secondary">
                  Inclusion score · <span className="text-virgilio-purple font-medium">82 / 100</span>
                </div>
              )}
            </div>
            {isEdit && (
              <Alert className="mt-3 bg-[#FAF8FF] border-virgilio-purple/20">
                <Sparkles className="h-4 w-4 text-virgilio-purple" />
                <AlertDescription className="text-[12.5px] text-text-secondary">
                  Gio spotted 3 phrases that could be more inclusive.{' '}
                  <button className="text-virgilio-purple font-medium hover:underline">
                    See suggestions →
                  </button>
                </AlertDescription>
              </Alert>
            )}
          </Section>

          {/* 3. BRANDING */}
          <Section title="Branding" chip="Inherits from workspace">
            <PostingBrandingCard
              value={branding}
              onChange={setBranding}
              workspaceColor={(tenant as any)?.brand_color}
              readOnly={readOnly}
            />
            {tenant?.about && (
              <Collapsible open={aboutOpen} onOpenChange={setAboutOpen} className="mt-5 pt-4 border-t border-virgilio-border/60">
                <CollapsibleTrigger className="flex items-center gap-1.5 text-[12.5px] text-text-secondary hover:text-text-primary">
                  {aboutOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  About {tenant.name} (appears on every posting)
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <SafeHtml
                    content={tenant.about}
                    className="prose prose-sm text-text-secondary max-w-none text-[13px]"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={ExternalLink}
                    onClick={() => window.open('/settings?tab=organization', '_blank')}
                    className="mt-2"
                  >
                    Edit in workspace settings
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            )}
          </Section>

          {/* 4. APPLICATION FORM */}
          {localId ? (
            <SheetApplicationFormBuilder
              postingId={localId}
              readOnly={readOnly}
              eeoEnabled={eeoEnabled}
              onEeoChange={setEeoEnabled}
            />
          ) : (
            <Section title="Application form">
              <Alert className="bg-[#FAFAF7] border-virgilio-border">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-[12.5px]">
                  Save the draft to start adding custom questions.
                </AlertDescription>
              </Alert>
            </Section>
          )}

          {/* 5. WHERE TO PUBLISH */}
          <Section
            title="Where to publish"
            chip="↗ Manage integrations"
            chipHref="/settings?tab=job-boards"
          >
            <PostingChannelsCard value={channels} onChange={setChannels} readOnly={readOnly} />
            {!talentEnabled && (
              <Alert className="mt-3">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-[12.5px]">
                  Enable Talent.com integration in{' '}
                  <a href="/settings?tab=job-boards" className="underline" target="_blank" rel="noopener noreferrer">
                    Settings &gt; Workspace &gt; Job Boards
                  </a>
                </AlertDescription>
              </Alert>
            )}
          </Section>

          {/* 6. APPLY EXPERIENCE */}
          <Section title="Apply experience">
            <div className="divide-y divide-virgilio-border/60">
              <ToggleRow
                title="Send confirmation email"
                helper={`From ${tenant?.name || 'workspace'} · "We received your application…"`}
                checked={confirmationEmail}
                onChange={setConfirmationEmail}
                disabled={readOnly}
              />
              <ToggleRow
                title="Promise first response within 48h"
                helper="Shows a badge on the apply page and pings recruiter"
                checked={promise48h}
                onChange={setPromise48h}
                disabled={readOnly}
              />
              <ToggleRow
                title="Allow candidate to message recruiter"
                helper="Adds a chat thread after they apply"
                checked={allowMessage}
                onChange={setAllowMessage}
                disabled={readOnly}
              />
              <ToggleRow
                title="Enable referral link"
                helper={
                  referralEnabled
                    ? `${(tenant?.name || 'acme').toLowerCase()}.gio.com/r/${slug || 'ref'}`
                    : 'Generates a trackable URL per teammate'
                }
                checked={referralEnabled}
                onChange={setReferralEnabled}
                disabled={readOnly}
              />
            </div>
          </Section>

          {/* 7. SEO & SHARING */}
          <Section
            title="SEO & sharing"
            chip={!isEdit ? 'Will auto-generate' : undefined}
          >
            <div className="space-y-4">
              <FormField label="Meta title" helpText={`${metaTitle.length} / 60`}>
                <Input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="Auto-generates from public title"
                  maxLength={80}
                  disabled={readOnly}
                />
              </FormField>
              <FormField label="Meta description" helpText={`${metaDescription.length} / 155`}>
                <Textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Auto-generates from public description"
                  rows={3}
                  maxLength={200}
                  disabled={readOnly}
                />
              </FormField>
            </div>
          </Section>

          <div className="h-2" />
        </div>

        {/* Sticky footer */}
        <footer className="sticky bottom-0 bg-surface-primary border-t border-virgilio-border px-8 py-4 flex items-center gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <div className="flex-1 text-[12px] text-text-secondary">
            Posting to <span className="font-medium text-text-primary">{enabledChannelsCount}</span>{' '}
            {enabledChannelsCount === 1 ? 'channel' : 'channels'}
            {deadline && (
              <>
                {' · closes '}
                <span className="font-medium text-text-primary">{format(deadline, 'MMM d')}</span>
              </>
            )}
          </div>
          {!readOnly && (
            <>
              <Button variant="secondary" icon={Eye} disabled={!title.trim() || saving}>
                Preview posting
              </Button>
              {isEdit ? (
                <Button onClick={() => save()} loading={saving}>
                  Save changes
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => save(false)} loading={saving}>
                    Save as draft
                  </Button>
                  <Button onClick={() => save(true)} loading={saving}>
                    Publish posting
                  </Button>
                </>
              )}
            </>
          )}
        </footer>
      </SheetContent>
    </Sheet>
  )
}

/* ---------------- helpers ---------------- */

function Section({
  title,
  chip,
  chipHref,
  children,
}: {
  title: string
  chip?: string
  chipHref?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-tertiary font-inter">
          {title}
        </div>
        {chip &&
          (chipHref ? (
            <a
              href={chipHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-full bg-[#EDE4FF] text-virgilio-purple text-[11.5px] inline-flex items-center gap-1 hover:bg-[#E2D6FF] transition"
            >
              <Sparkles className="h-3 w-3" />
              {chip}
            </a>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-[#EDE4FF] text-virgilio-purple text-[11.5px] inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {chip}
            </span>
          ))}
      </div>
      <div className="bg-surface-primary rounded-xl border border-virgilio-border p-6">{children}</div>
    </section>
  )
}

function ToggleRow({
  title,
  helper,
  checked,
  onChange,
  disabled,
}: {
  title: string
  helper: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="min-w-0 pr-4">
        <div className="font-poppins font-medium text-[13.5px] tracking-[-0.01em] text-text-primary">
          {title}
        </div>
        <div className="text-[12.5px] text-text-secondary">{helper}</div>
      </div>
      <Switch checked={checked} onCheckedChange={(v) => onChange(!!v)} disabled={disabled} />
    </div>
  )
}
