import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Sparkles, GripVertical, Lock, Trash2, Plus, ExternalLink, Eye, Copy, Search,
  User, Mail, Phone, FileText, Link2, Globe2, Briefcase, DollarSign, MessageSquare, Puzzle,
  Calendar as CalendarIcon, Hash, AlignLeft, ToggleLeft, List, Type, MapPin, Linkedin, Users, Building2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CurrencySelect } from '@/components/ui/currency-select'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { SectionCard, FieldLabel, FieldHint, ToggleRow, AiAssistedBadge, SalaryInput } from './_parts'
import type { CreateJobData } from '@/hooks/useJobs'
import { useJobPostings } from '@/hooks/useJobPostings'
import { useApplicationFields } from '@/hooks/useApplicationFields'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'


/* ---------------- helpers ---------------- */
function slugify(s: string) {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'pt-BR', label: 'Portuguese (BR)' },
  { value: 'it-IT', label: 'Italian' },
]

const BRAND_SWATCHES = ['#6F3FF5', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#0d0d09']

type FieldType =
  | 'text' | 'email' | 'phone' | 'file' | 'url' | 'yesno' | 'select' | 'number' | 'longtext' | 'date'
  | 'salary' | 'location' | 'linkedin' | 'recruiter' | 'employment_type' | 'work_location'

interface SmartFieldDef {
  id: string
  label: string
  type: FieldType
  icon: React.ComponentType<{ className?: string }>
  hint: string
  description: string
}

const SMART_FIELDS: SmartFieldDef[] = [
  { id: 'sf_salary',          label: 'Salary expectations', type: 'salary',          icon: DollarSign, hint: 'Currency-aware',                    description: 'Expected compensation' },
  { id: 'sf_location',        label: 'Location',            type: 'location',        icon: MapPin,     hint: 'City · state · country',            description: 'Where the candidate is based' },
  { id: 'sf_phone',           label: 'Phone',               type: 'phone',           icon: Phone,      hint: 'International format',              description: 'Contact phone number' },
  { id: 'sf_linkedin',        label: 'LinkedIn',            type: 'linkedin',        icon: Linkedin,   hint: 'Profile URL',                       description: 'LinkedIn profile' },
  { id: 'sf_employment_type', label: 'Employment type',     type: 'employment_type', icon: Briefcase,  hint: 'Full-time · part-time · contract',  description: 'Preferred employment type' },
  { id: 'sf_work_location',   label: 'Work location',       type: 'work_location',   icon: Building2,  hint: 'Remote · hybrid · on-site',         description: 'Preferred work arrangement' },
  { id: 'sf_recruiter',       label: 'Preferred recruiter', type: 'recruiter',       icon: Users,      hint: 'Team member assignment',            description: 'Routes the application to a recruiter' },
]

const BASIC_TYPES: { type: FieldType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'text',     label: 'Short text',    icon: Type },
  { type: 'longtext', label: 'Long text',     icon: AlignLeft },
  { type: 'number',   label: 'Number',        icon: Hash },
  { type: 'email',    label: 'Email',         icon: Mail },
  { type: 'url',      label: 'URL',           icon: Link2 },
  { type: 'date',     label: 'Date',          icon: CalendarIcon },
  { type: 'select',   label: 'Single select', icon: List },
  { type: 'yesno',    label: 'Yes / No',      icon: ToggleLeft },
  { type: 'file',     label: 'File upload',   icon: FileText },
]


interface AppField {
  id: string
  label: string
  type: FieldType
  hint?: string
  required: boolean
  locked?: boolean
  isSmart?: boolean
  icon: React.ComponentType<{ className?: string }>
}

const SMART_FIELD_TYPES = new Set<FieldType>(SMART_FIELDS.map((s) => s.type))

const DEFAULT_FIELDS: AppField[] = [
  { id: 'full_name', label: 'Full name', type: 'text', hint: 'Short text', required: true, locked: true, icon: User },
  { id: 'email', label: 'Email', type: 'email', hint: 'Email', required: true, locked: true, icon: Mail },
  { id: 'phone', label: 'Phone', type: 'phone', hint: 'Phone', required: true, icon: Phone },
  { id: 'resume', label: 'Resume / CV', type: 'file', hint: 'File upload · PDF, DOC', required: true, icon: FileText },
  { id: 'linkedin', label: 'LinkedIn / portfolio', type: 'url', hint: 'URL · multi-line', required: true, icon: Link2 },
  { id: 'work_auth', label: 'Are you authorized to work in the US?', type: 'yesno', hint: 'Yes / No', required: true, icon: Globe2 },
  { id: 'notice', label: 'Notice period', type: 'select', hint: 'Single-select · 6 options', required: false, icon: Briefcase },
  { id: 'salary', label: 'Salary expectations (optional)', type: 'number', hint: 'Number · currency-aware', required: false, icon: DollarSign },
  { id: 'why', label: 'Why are you interested in this role?', type: 'longtext', hint: 'Long text · 600 chars', required: true, icon: MessageSquare },
]

interface Channel {
  id: string
  letter: string
  letterBg: string
  name: string
  sub: string
  status: string
  defaultOn: boolean
  alwaysOn?: boolean
  cost?: number
}

const CHANNELS: Channel[] = [
  { id: 'careers', letter: 'A', letterBg: 'bg-[#0d0d09] text-white', name: 'Acme Talent careers page', sub: 'Your public careers page · public listing', status: 'Always on', defaultOn: true, alwaysOn: true, cost: 0 },
  { id: 'linkedin', letter: 'in', letterBg: 'bg-[#0A66C2] text-white', name: 'LinkedIn', sub: 'Slots used: 7 / 10 · auto-renew weekly', status: 'Connected · ~$0 (free slot)', defaultOn: true, cost: 0 },
  { id: 'wttj', letter: 'W', letterBg: 'bg-[#FFE74C] text-[#0d0d09]', name: 'Welcome to the Jungle', sub: 'Cross-post · Europe + remote-friendly audience', status: 'Connected · $0', defaultOn: true, cost: 0 },
  { id: 'zip', letter: 'Z', letterBg: 'bg-[#3B82F6] text-white', name: 'ZipRecruiter', sub: 'Paid sponsored placement · 30-day campaign', status: '$129 / 30 days', defaultOn: true, cost: 129 },
  { id: 'google', letter: 'G', letterBg: 'bg-white text-text-primary border border-virgilio-border', name: 'Google for Jobs', sub: 'Structured data feed · auto-syndicated', status: 'Free · auto', defaultOn: false, cost: 0 },
  { id: 'indeed', letter: 'I', letterBg: 'bg-[#003A9B] text-white', name: 'Indeed (free tier)', sub: 'Organic listing only — sponsorship requires upgrade', status: 'Not connected', defaultOn: false, cost: 0 },
]

/* ---------------- component ---------------- */
interface JobPostingStepProps {
  jobData: Partial<CreateJobData>
  onUpdate: (data: Partial<CreateJobData>) => void
  jobId: string | null
  onPostingMeta?: (meta: { channels: number; fields: number }) => void
}

export interface JobPostingStepHandle {
  /** Persist (or skip persist) and return true to allow advancing */
  savePosting: () => Promise<boolean>
}

export const JobPostingStep = React.forwardRef<JobPostingStepHandle, JobPostingStepProps>(
  function JobPostingStep({ jobData, onUpdate, jobId, onPostingMeta }, ref) {
    const { createPosting, updatePosting } = useJobPostings(jobId || '')
    const { fields: smartFieldsLibrary } = useApplicationFields()

    const setJob = <K extends keyof CreateJobData>(field: K, value: CreateJobData[K]) =>
      onUpdate({ [field]: value } as Partial<CreateJobData>)

    /* --- basics --- */
    const [publicTitle, setPublicTitle] = useState(jobData.title || '')
    const [slug, setSlug] = useState(slugify(jobData.title || ''))
    const [refId, setRefId] = useState('')
    const [language, setLanguage] = useState('en-US')
    const [deadline, setDeadline] = useState<Date | undefined>(undefined)
    const [showInSearch, setShowInSearch] = useState(true)
    const [showResponseBadge, setShowResponseBadge] = useState(true)

    /* --- compensation (commissions only — base salary lives on jobData) --- */
    const [variableEnabled, setVariableEnabled] = useState(false)
    const [commissionCurrency, setCommissionCurrency] = useState(jobData.currency || 'USD')
    const [commissionAmount, setCommissionAmount] = useState<number | undefined>(undefined)

    const salaryInvalid =
      jobData.salary_min != null &&
      jobData.salary_max != null &&
      jobData.salary_min > jobData.salary_max


    // keep slug in sync with title until user manually edits it
    const slugTouched = useRef(false)
    useEffect(() => {
      if (!slugTouched.current) setSlug(slugify(publicTitle))
    }, [publicTitle])

    /* --- description --- */
    const [description, setDescription] = useState('')
    const initedDesc = useRef(false)
    useEffect(() => {
      if (!initedDesc.current && jobData.description) {
        setDescription(jobData.description)
        initedDesc.current = true
      }
    }, [jobData.description])
    const [genLoading, setGenLoading] = useState(false)

    const handleGenerate = async () => {
      if (!jobData.title) {
        toast.error('Please fill in more details to generate a description')
        return
      }
      if (description.trim() && !window.confirm('Replace the current description with a freshly generated one?')) return
      setGenLoading(true)
      try {
        const { data, error } = await supabase.functions.invoke('generate-job-description', {
          body: { jobData },
        })
        if (error) throw error
        if (data?.description) {
          setDescription(data.description)
          toast.success('Description generated')
        }
      } catch (e: any) {
        toast.error(e?.message || 'Failed to generate description')
      } finally {
        setGenLoading(false)
      }
    }

    /* --- branding --- */
    const [brandColor, setBrandColor] = useState('#6F3FF5')
    const [bannerName, setBannerName] = useState('')
    const [teamPhotos, setTeamPhotos] = useState(true)
    const [cultureVideo, setCultureVideo] = useState(false)

    /* --- application form --- */
    const [fields, setFields] = useState<AppField[]>(DEFAULT_FIELDS)
    const [eeo, setEeo] = useState(true)
    const dragIdx = useRef<number | null>(null)
    const onDragStart = (i: number) => () => { dragIdx.current = i }
    const onDragOver = (i: number) => (e: React.DragEvent) => {
      e.preventDefault()
      const from = dragIdx.current
      if (from == null || from === i) return
      if (fields[i].locked || fields[from].locked) return
      const next = [...fields]
      const [moved] = next.splice(from, 1)
      next.splice(i, 0, moved)
      dragIdx.current = i
      setFields(next)
    }

    /* --- channels --- */
    const [channelOn, setChannelOn] = useState<Record<string, boolean>>(
      Object.fromEntries(CHANNELS.map((c) => [c.id, c.defaultOn]))
    )
    const enabledChannels = CHANNELS.filter((c) => channelOn[c.id])
    const totalCost = enabledChannels.reduce((s, c) => s + (c.cost || 0), 0)
    const paidCount = enabledChannels.filter((c) => (c.cost || 0) > 0).length
    const freeCount = enabledChannels.length - paidCount

    /* --- apply experience --- */
    const [sendConfirm, setSendConfirm] = useState(true)
    const [promise48, setPromise48] = useState(true)
    const [allowMessage, setAllowMessage] = useState(false)
    const [enableReferral, setEnableReferral] = useState(true)

    /* --- SEO --- */
    const [metaTitle, setMetaTitle] = useState('')
    const [metaDescription, setMetaDescription] = useState('')
    useEffect(() => {
      if (!metaTitle && publicTitle) setMetaTitle(publicTitle.slice(0, 60))
    }, [publicTitle]) // eslint-disable-line react-hooks/exhaustive-deps

    /* --- meta back to wizard footer --- */
    useEffect(() => {
      onPostingMeta?.({ channels: enabledChannels.length, fields: fields.length })
    }, [enabledChannels.length, fields.length, onPostingMeta])

    /* --- save --- */
    React.useImperativeHandle(ref, () => ({
      async savePosting() {
        if (!jobId) return true // nothing to wire to — skip silently
        if (!publicTitle.trim()) {
          toast.error('Public job title is required')
          return false
        }
        const details = {
          slug, reference_id: refId || null, language,
          deadline: deadline ? deadline.toISOString().slice(0, 10) : null,
          show_in_search: showInSearch, show_response_badge: showResponseBadge,
          brand_color: brandColor, banner_name: bannerName || null,
          team_photos: teamPhotos, culture_video: cultureVideo,
          application_fields: fields.map((f) => ({ id: f.id, label: f.label, type: f.type, required: f.required, locked: !!f.locked })),
          eeo_survey: eeo,
          channels: Object.entries(channelOn).filter(([, v]) => v).map(([id]) => id),
          apply_experience: { send_confirm: sendConfirm, promise_48h: promise48, allow_message: allowMessage, enable_referral: enableReferral },
          seo: { meta_title: metaTitle, meta_description: metaDescription },
          compensation: {
            variable_enabled: variableEnabled,
            commission_currency: variableEnabled ? commissionCurrency : null,
            commission_amount: variableEnabled ? commissionAmount ?? null : null,
          },
        }

        try {
          const created = await createPosting({ title: publicTitle, description, details })
          return !!created
        } catch (e: any) {
          toast.error(e?.message || 'Failed to create posting')
          return false
        }
      },
    }))

    return (
      <div className="space-y-6 pb-6">
        {/* ---------- POSTING BASICS ---------- */}
        <SectionCard
          title="Posting basics"
          trailing={<AiAssistedBadge>Pulled from step 1</AiAssistedBadge>}
        >
          <div>
            <FieldLabel required>Public job title</FieldLabel>
            <Input value={publicTitle} onChange={(e) => setPublicTitle(e.target.value)} className="mt-2 h-11" />
            <FieldHint>What candidates see at the top of the posting. Defaults to your internal title — tune for search.</FieldHint>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <FieldLabel required>URL slug</FieldLabel>
              <div className="mt-2 flex h-11 items-center rounded-xl border border-virgilio-border bg-white overflow-hidden focus-within:ring-2 focus-within:ring-virgilio-purple/30">
                <span className="px-3 text-[12.5px] text-text-tertiary bg-[#FAFAF7] h-full inline-flex items-center border-r border-virgilio-border">/jobs/</span>
                <input
                  value={slug}
                  onChange={(e) => { slugTouched.current = true; setSlug(e.target.value) }}
                  className="flex-1 min-w-0 bg-transparent px-3 text-[13px] outline-none"
                />
              </div>
              <FieldHint>your-careers-domain/jobs/{slug || '…'}</FieldHint>
            </div>
            <div>
              <FieldLabel optional>Reference ID</FieldLabel>
              <Input value={refId} onChange={(e) => setRefId(e.target.value)} className="mt-2 h-11" placeholder="e.g., DES-2026-014" />
              <FieldHint>Shown in confirmation emails.</FieldHint>
            </div>
            <div>
              <FieldLabel required>Posting language</FieldLabel>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="mt-2 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel optional>Application deadline</FieldLabel>
              <div className="mt-2">
                <DatePickerVirgilio
                  value={deadline}
                  onChange={setDeadline}
                  placeholder="Pick a date"
                  minDate={new Date()}
                  className="h-11 w-full"
                />
              </div>
              <FieldHint>Leave empty for rolling.</FieldHint>
            </div>

          </div>
          <div className="border-t border-virgilio-border pt-4 space-y-1">
            <ToggleRow
              label="Show in public job search"
              hint="When off, candidates can only apply via a direct link."
              checked={showInSearch}
              onChange={setShowInSearch}
            />
            <ToggleRow
              label="Show 'apply within 24h response' badge"
              hint="We've measured your team's avg first response at 18h — eligible."
              checked={showResponseBadge}
              onChange={setShowResponseBadge}
            />
          </div>
        </SectionCard>

        {/* ---------- COMPENSATION ---------- */}
        <SectionCard title="Compensation">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <FieldLabel required>Currency</FieldLabel>
              <div className="mt-2">
                <CurrencySelect
                  value={jobData.currency || 'USD'}
                  onChange={(v) => setJob('currency', v)}
                />
              </div>
            </div>
            <div>
              <FieldLabel required>Min salary</FieldLabel>
              <div className="mt-2">
                <SalaryInput
                  value={jobData.salary_min ?? undefined}
                  onChange={(v) => setJob('salary_min', v)}
                  placeholder="80,000"
                  invalid={salaryInvalid}
                />
              </div>
              {salaryInvalid && <FieldHint tone="error">Min must be lower than max</FieldHint>}
            </div>
            <div>
              <FieldLabel required>Max salary</FieldLabel>
              <div className="mt-2">
                <SalaryInput
                  value={jobData.salary_max ?? undefined}
                  onChange={(v) => setJob('salary_max', v)}
                  placeholder="120,000"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-virgilio-border pt-4 space-y-1">
            <ToggleRow
              label="Show salary on public posting"
              hint="Recommended — applicant quality jumps 40% on jobs that publish salary."
              checked={!!jobData.show_salary_public}
              onChange={(v) => setJob('show_salary_public', v)}
            />
            <ToggleRow
              label="Include equity"
              checked={!!jobData.include_equity}
              onChange={(v) => setJob('include_equity', v)}
            />
            <ToggleRow
              label="Include signing bonus"
              checked={!!jobData.include_signing_bonus}
              onChange={(v) => setJob('include_signing_bonus', v)}
            />
            <ToggleRow
              label="Include variable / commission"
              hint="On-target earnings, sales commission, or bonus structure."
              checked={variableEnabled}
              onChange={setVariableEnabled}
            />
          </div>

          {variableEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2">
              <div>
                <FieldLabel>Commission currency</FieldLabel>
                <div className="mt-2">
                  <CurrencySelect value={commissionCurrency} onChange={setCommissionCurrency} />
                </div>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Commission / variable amount</FieldLabel>
                <div className="mt-2">
                  <SalaryInput
                    value={commissionAmount}
                    onChange={setCommissionAmount}
                    placeholder="e.g. 20,000 OTE"
                  />
                </div>
                <FieldHint>On-target earnings or % — your call.</FieldHint>
              </div>
            </div>
          )}
        </SectionCard>


        {/* ---------- PUBLIC DESCRIPTION ---------- */}
        <SectionCard
          title="Public description"
          trailing={
            <div className="flex items-center gap-2">
              {initedDesc.current && <AiAssistedBadge>Gio rewrote</AiAssistedBadge>}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={genLoading}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-poppins font-medium text-text-secondary hover:text-text-primary"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {genLoading ? 'Rewriting…' : 'Rewrite'}
              </button>
            </div>
          }
        >
          <div>
            <FieldLabel required>Posting copy</FieldLabel>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="## About the role…"
              className="mt-2 min-h-[260px] font-mono text-[13px] leading-relaxed"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <FieldHint>Markdown supported. We've optimized your internal description for tone, inclusivity, and SEO.</FieldHint>
              <Button variant="purple" size="sm" icon={Sparkles} onClick={handleGenerate} loading={genLoading}>
                Generate with Gio
              </Button>
            </div>
          </div>
          <div className="rounded-xl bg-[#F2EBFF] p-4 flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-virgilio-purple flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-poppins font-medium text-text-primary">Inclusion score · 92/100</p>
              <p className="text-[12px] text-text-secondary mt-0.5">Strong. We scan for gendered terms and overly strict requirements.</p>
            </div>
          </div>
        </SectionCard>

        {/* ---------- BRANDING ---------- */}
        <SectionCard
          title="Branding"
          trailing={<span className="text-[11px] font-poppins font-medium text-text-tertiary uppercase tracking-[0.08em]">Inherits from workspace</span>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <FieldLabel optional>Hero banner</FieldLabel>
              <label className="mt-2 block rounded-xl border border-dashed border-virgilio-border bg-[#FAFAF7] aspect-[16/5] cursor-pointer hover:bg-[#F2EBFF] transition-colors relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}30)` }}>
                <input type="file" accept="image/*" className="sr-only"
                  onChange={(e) => setBannerName(e.target.files?.[0]?.name || '')} />
                <span className="absolute bottom-3 left-3 text-[11.5px] text-white/90 font-medium">
                  {bannerName || 'Click to upload (1600 × 480 recommended)'}
                </span>
              </label>
              <FieldHint>Falls back to workspace cover.</FieldHint>
            </div>
            <div>
              <FieldLabel>Brand color</FieldLabel>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-11 w-12 rounded-lg border border-virgilio-border cursor-pointer bg-white"
                />
                <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-11 flex-1 font-mono uppercase" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11.5px] text-text-tertiary">Swatches</span>
                {BRAND_SWATCHES.map((c) => (
                  <button key={c} type="button" onClick={() => setBrandColor(c)}
                    aria-label={`Use ${c}`}
                    className={cn('h-6 w-6 rounded-md border', brandColor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-virgilio-purple ring-offset-1' : 'border-virgilio-border')}
                    style={{ background: c }} />
                ))}
              </div>
              <FieldHint>Used for buttons and accents on the posting.</FieldHint>
            </div>
          </div>
          <div className="border-t border-virgilio-border pt-4 space-y-1">
            <ToggleRow label="Show team photos on posting" hint="3 random panel photos pulled from member profiles." checked={teamPhotos} onChange={setTeamPhotos} />
            <ToggleRow label="Embed culture video" hint="Workspace default · 'Life at the team'" checked={cultureVideo} onChange={setCultureVideo} />
          </div>
        </SectionCard>

        {/* ---------- APPLICATION FORM ---------- */}
        <SectionCard
          title="Application form"
          trailing={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" icon={Plus} dropdown>
                  Add question
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-[320px]">
                <DropdownMenuLabel className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-virgilio-purple" />
                  Smart fields
                </DropdownMenuLabel>
                {SMART_FIELDS.map((sf) => {
                  const already = fields.some((f) => f.type === sf.type)
                  const Icon = sf.icon
                  return (
                    <DropdownMenuItem
                      key={sf.id}
                      disabled={already}
                      onSelect={() => {
                        setFields((arr) => [...arr, {
                          id: `${sf.id}_${Date.now()}`,
                          label: sf.label,
                          type: sf.type,
                          required: false,
                          icon: sf.icon,
                          hint: sf.hint,
                          isSmart: true,
                        }])
                      }}
                    >
                      <Icon className="h-3.5 w-3.5 text-text-tertiary" />
                      <span className="flex-1 truncate">{sf.label}</span>
                      <Badge tone="lilac" size="xs">Smart</Badge>
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Basic question types</DropdownMenuLabel>
                {BASIC_TYPES.map((bt) => {
                  const Icon = bt.icon
                  return (
                    <DropdownMenuItem
                      key={bt.type}
                      onSelect={() => {
                        setFields((arr) => [...arr, {
                          id: `q_${Date.now()}`,
                          label: `New ${bt.label.toLowerCase()} question`,
                          type: bt.type,
                          required: false,
                          icon: bt.icon,
                        }])
                      }}
                    >
                      <Icon className="h-3.5 w-3.5 text-text-tertiary" />
                      <span className="flex-1 truncate">{bt.label}</span>
                    </DropdownMenuItem>
                  )
                })}
                {smartFieldsLibrary.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>From your library</DropdownMenuLabel>
                    {smartFieldsLibrary.map((lf) => {
                      const typeIcon: Record<string, any> = {
                        text: Type, email: Mail, number: Hash, textarea: AlignLeft,
                        select: List, checkbox: ToggleLeft, date: CalendarIcon, file: FileText, url: Link2,
                      }
                      const Icon = typeIcon[lf.field_type] || MessageSquare
                      return (
                        <DropdownMenuItem
                          key={lf.id}
                          onSelect={() => {
                            setFields((arr) => [...arr, {
                              id: `lib_${lf.id}_${Date.now()}`,
                              label: lf.field_label,
                              type: (lf.field_type as any) === 'textarea' ? 'longtext' : (lf.field_type as any),
                              required: lf.is_required,
                              icon: Icon,
                              hint: lf.help_text || undefined,
                            }])
                          }}
                        >
                          <Icon className="h-3.5 w-3.5 text-text-tertiary" />
                          <span className="flex-1 truncate">{lf.field_label}</span>
                          <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-tertiary">{lf.field_type}</span>
                        </DropdownMenuItem>
                      )
                    })}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          }

        >
          <p className="text-[12.5px] text-text-secondary -mt-1">
            What candidates fill in to apply. Drag to reorder. Keep it short — every extra field drops completion by ~6%.
          </p>
          <div className="space-y-2">
            {fields.map((f, i) => {
              const Icon = f.icon
              return (
                <div
                  key={f.id}
                  draggable={!f.locked}
                  onDragStart={onDragStart(i)}
                  onDragOver={onDragOver(i)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border border-virgilio-border bg-white px-3 py-2.5',
                    !f.locked && 'cursor-grab active:cursor-grabbing'
                  )}
                >
                  <GripVertical className={cn('h-4 w-4 text-text-tertiary shrink-0', f.locked && 'opacity-30')} />
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-[#FAFAF7] inline-flex items-center justify-center">
                    <Icon className="h-4 w-4 text-text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-poppins font-medium text-text-primary truncate">{f.label}</p>
                      {f.locked && <span className="text-[10.5px] uppercase tracking-[0.08em] font-poppins font-semibold text-virgilio-purple bg-[#EDE4FF] rounded-full px-2 py-0.5">Required by Gio</span>}
                    </div>
                    {f.hint && <p className="text-[11.5px] text-text-tertiary">{f.hint}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFields((arr) => arr.map((x) => x.id === f.id ? { ...x, required: !x.required } : x))}
                    disabled={f.locked}
                    className={cn(
                      'text-[11px] font-poppins font-medium uppercase tracking-[0.06em] rounded-full px-2.5 py-1',
                      f.required ? 'bg-[#FFF4C7] text-[#856404]' : 'bg-[#F1F0EC] text-text-secondary',
                      f.locked && 'opacity-70 cursor-not-allowed'
                    )}
                  >
                    {f.required ? 'Required' : 'Optional'}
                  </button>
                  {f.locked ? (
                    <Lock className="h-4 w-4 text-text-tertiary shrink-0" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFields((arr) => arr.filter((x) => x.id !== f.id))}
                      aria-label={`Remove ${f.label}`}
                      className="rounded-md p-1.5 text-text-tertiary hover:bg-[#F1F0EC] hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <div className="border-t border-virgilio-border pt-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#F1F0EC] inline-flex items-center justify-center">
                <Puzzle className="h-4 w-4 text-text-secondary" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-poppins font-medium text-text-primary">Demographic survey (EEO)</p>
                <p className="text-[12px] text-text-tertiary">Anonymized, optional. Appended after submit. Compliant in US, UK, EU.</p>
              </div>
              <ToggleRow label="" checked={eeo} onChange={setEeo} />
            </div>
          </div>
        </SectionCard>

        {/* ---------- WHERE TO PUBLISH ---------- */}
        <SectionCard
          title="Where to publish"
          trailing={
            <a href="/settings?tab=integrations" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-poppins font-medium text-text-secondary hover:text-text-primary">
              <ExternalLink className="h-3.5 w-3.5" />
              Manage integrations
            </a>
          }
        >
          <div className="space-y-2">
            {CHANNELS.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-virgilio-border bg-white px-3 py-3">
                <div className={cn('h-10 w-10 shrink-0 rounded-lg inline-flex items-center justify-center font-poppins font-semibold text-[13px]', c.letterBg)}>
                  {c.letter}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-poppins font-medium text-text-primary truncate">{c.name}</p>
                    {c.id === 'careers' && <span className="text-[10.5px] uppercase tracking-[0.08em] font-poppins font-semibold text-virgilio-purple bg-[#EDE4FF] rounded-full px-2 py-0.5">Recommended</span>}
                  </div>
                  <p className="text-[11.5px] text-text-tertiary truncate">{c.sub}</p>
                </div>
                <span className="text-[11.5px] text-text-tertiary text-right whitespace-nowrap mr-1">{c.status}</span>
                <ToggleRow
                  label=""
                  checked={!!channelOn[c.id]}
                  onChange={(v) => !c.alwaysOn && setChannelOn((m) => ({ ...m, [c.id]: v }))}
                  disabled={c.alwaysOn}
                />
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-[#0d0d09] text-white p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white/10 inline-flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-poppins font-medium">Posting total · ${totalCost} {totalCost > 0 && '+ 1 sourcing credit'}</p>
              <p className="text-[12px] text-white/60">Charged on publish. Cancel or pause campaigns from the posting page anytime.</p>
            </div>
            <span className="text-[11.5px] bg-white/10 rounded-full px-3 py-1">{freeCount} free, {paidCount} paid</span>
          </div>
        </SectionCard>

        {/* ---------- APPLY EXPERIENCE ---------- */}
        <SectionCard title="Apply experience">
          <ToggleRow label="Send confirmation email" hint={`From noreply@app.gogio.io · 'We received your application — here's what's next'`} checked={sendConfirm} onChange={setSendConfirm} />
          <ToggleRow label="Promise first response in 48h" hint="Posts a visible badge on the listing." checked={promise48} onChange={setPromise48} />
          <ToggleRow label="Allow candidate to message recruiter" hint="Through the candidate portal." checked={allowMessage} onChange={setAllowMessage} />
          <ToggleRow
            label="Enable referral link"
            hint={`your-careers-domain/r/${slug || 'job'} · trackable per-member.`}
            checked={enableReferral}
            onChange={setEnableReferral}
          />
        </SectionCard>

        {/* ---------- SEO & SHARING ---------- */}
        <SectionCard
          title="SEO & sharing"
          trailing={<AiAssistedBadge>Gio generated</AiAssistedBadge>}
        >
          <div>
            <FieldLabel>Meta title</FieldLabel>
            <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} maxLength={60} className="mt-2 h-11" />
            <FieldHint>Shown in search engines. {metaTitle.length}/60 chars.</FieldHint>
          </div>
          <div>
            <FieldLabel>Meta description</FieldLabel>
            <Textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} maxLength={155} className="mt-2 min-h-[88px]" />
            <FieldHint>Shown under the title in search results. {metaDescription.length}/155 chars.</FieldHint>
          </div>
          <div>
            <p className="text-[10.5px] font-poppins font-semibold uppercase tracking-[0.12em] text-text-secondary mb-2">Social card preview</p>
            <div className="rounded-xl border border-virgilio-border overflow-hidden bg-white">
              <div className="aspect-[1200/520] relative" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}40)` }}>
                <span className="absolute top-4 left-4 text-[11.5px] bg-[#0d0d09] text-white rounded-full px-2.5 py-1 font-medium">Hiring</span>
              </div>
              <div className="p-4">
                <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-tertiary">your-careers-domain</p>
                <p className="text-[14px] font-poppins font-semibold text-text-primary mt-1">{metaTitle || publicTitle || 'Job title'}</p>
                <p className="text-[12.5px] text-text-secondary mt-1 line-clamp-2">{metaDescription || 'A short description of this role.'}</p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ---------- PREVIEW TEASER ---------- */}
        <div className="rounded-2xl border border-virgilio-border bg-white p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-[#EDE4FF] inline-flex items-center justify-center">
            <Eye className="h-4 w-4 text-virgilio-purple" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-poppins font-medium text-text-primary">Preview the full posting</p>
            <p className="text-[12px] text-text-secondary">Open the candidate-facing posting in a new tab. Nothing is published until the next step.</p>
          </div>
          <Button variant="secondary" size="sm" iconRight={ExternalLink} disabled>
            Open preview
          </Button>
        </div>
      </div>
    )
  }
)
