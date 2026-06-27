import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Building2, Globe, Sparkles, RefreshCw, MapPin, ImagePlus, Pencil, X,
  Plus, Mail, Phone, User as UserIcon, Copy, Trash2, AlertTriangle, ExternalLink, Check,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAuth } from '@/contexts/AuthContext'
import { useMembers } from '@/hooks/useMembers'
import { useDeals } from '@/hooks/useDeals'
import { useJobs } from '@/hooks/useJobs'
import { COUNTRIES } from '@/constants/countries'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import {
  Organization, CreateOrganizationData, UpdateOrganizationData,
  CompanyStatus, CompanySize,
} from '@/hooks/useOrganizations'
import { useCompanyContacts, CompanyContact } from '@/hooks/useCompanyContacts'

const COMPANY_SIZES: { value: CompanySize; label: string }[] = [
  { value: '1-10', label: '1 – 10 employees' },
  { value: '11-50', label: '11 – 50 employees' },
  { value: '51-200', label: '51 – 200 employees' },
  { value: '201-500', label: '201 – 500 employees' },
  { value: '501-1000', label: '501 – 1,000 employees' },
  { value: '1000+', label: '1,000+ employees' },
]

const INDUSTRIES = [
  'Software & SaaS', 'Financial services', 'Healthcare', 'Manufacturing',
  'Retail & e-commerce', 'Food & beverage', 'Real estate', 'Education',
  'Media & entertainment', 'Energy & utilities', 'Transportation & logistics',
  'Professional services', 'Hospitality & travel', 'Construction',
  'Telecommunications', 'Non-profit', 'Government', 'Other',
]

const BRAND_COLORS = ['#7C5CFA', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#6366F1']
function brandColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return BRAND_COLORS[h % BRAND_COLORS.length]
}
function initials(name: string, max = 2) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, max).map(w => w[0]?.toUpperCase() ?? '').join('') || '?'
}

const contactSchema = z.object({
  full_name: z.string().trim().optional().default(''),
  role_title: z.string().trim().optional().default(''),
  email: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
})

const schema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(160),
  website: z.string().trim().optional().default(''),
  logo_url: z.string().trim().optional().default(''),
  industry: z.string().optional().default(''),
  company_size: z.string().optional().default(''),
  hq_city: z.string().trim().optional().default(''),
  country: z.string().optional().default(''),
  account_owner_id: z.string().min(1, 'Account owner is required'),
  status: z.enum(['active', 'prospect', 'inactive']),
  tags: z.array(z.string()).optional().default([]),
  description: z.string().optional().default(''),
  contact: contactSchema,
}).superRefine((val, ctx) => {
  const c = val.contact
  const any = !!(c.full_name || c.role_title || c.email || c.phone)
  if (any) {
    if (!c.full_name) ctx.addIssue({ code: 'custom', path: ['contact', 'full_name'], message: 'Required when adding a contact' })
    if (!c.email) ctx.addIssue({ code: 'custom', path: ['contact', 'email'], message: 'Required when adding a contact' })
    if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) ctx.addIssue({ code: 'custom', path: ['contact', 'email'], message: 'Invalid email' })
  }
})

type FormValues = z.infer<typeof schema>

function normalizeWebsite(input: string): string {
  if (!input) return ''
  return input.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase()
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateOrganizationData | UpdateOrganizationData) => Promise<any>
  organization?: Organization | null
  isLoading: boolean
  onDelete?: (id: string) => void
}

const SectionHeader = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <div className="mb-2 flex items-center justify-between">
    <div className="font-poppins text-[11px] font-semibold tracking-[0.12em] uppercase text-text-tertiary">
      {children}
    </div>
    {right}
  </div>
)

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('rounded-2xl border border-virgilio-border bg-white p-5', className)}>{children}</div>
)

export function OrganizationFormSheet({
  isOpen, onClose, onSubmit, organization, isLoading, onDelete,
}: Props) {
  const isEdit = !!organization
  const { user } = useAuth()
  const { members } = useMembers()
  const { data: deals = [] } = useDeals()
  const { jobs = [] } = useJobs()

  const activeMembers = useMemo(
    () => (members ?? []).filter(m => m.user_id && m.user_status === 'active'),
    [members],
  )
  const ownerOptions: SearchableSelectOption[] = activeMembers.map(m => ({
    value: m.user_id!,
    label: `${m.user_first_name ?? ''} ${m.user_last_name ?? ''}`.trim() || m.user_email || 'Unknown',
  }))

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: '', website: '', logo_url: '', industry: '', company_size: '',
      hq_city: '', country: '', account_owner_id: '', status: 'active',
      tags: [], description: '',
      contact: { full_name: '', role_title: '', email: '', phone: '' },
    },
  })

  const [tagInput, setTagInput] = useState('')
  const [enriched, setEnriched] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Contacts (edit mode)
  const {
    contacts, addContact, updateContact, setPrimary, deleteContact,
  } = useCompanyContacts(organization?.id ?? null)

  const [editingContact, setEditingContact] = useState<CompanyContact | null>(null)
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactDraft, setContactDraft] = useState({ full_name: '', role_title: '', email: '', phone: '' })

  useEffect(() => {
    if (!isOpen) return
    setEnriched(false)
    setShowAddContact(false)
    setEditingContact(null)
    setContactDraft({ full_name: '', role_title: '', email: '', phone: '' })

    form.reset({
      name: organization?.name ?? '',
      website: organization?.website ?? '',
      logo_url: organization?.logo_url ?? '',
      industry: organization?.industry ?? '',
      company_size: organization?.company_size ?? '',
      hq_city: organization?.hq_city ?? '',
      country: organization?.country ?? '',
      account_owner_id: organization?.account_owner_id ?? user?.id ?? '',
      status: organization?.status ?? 'active',
      tags: organization?.tags ?? [],
      description: organization?.description ?? '',
      contact: { full_name: '', role_title: '', email: '', phone: '' },
    })
  }, [isOpen, organization, user?.id])

  const tags = form.watch('tags') ?? []
  const status = form.watch('status')

  const addTag = (raw: string) => {
    const v = raw.trim()
    if (!v) return
    if (tags.includes(v)) return
    form.setValue('tags', [...tags, v], { shouldDirty: true })
    setTagInput('')
  }
  const removeTag = (t: string) => form.setValue('tags', tags.filter(x => x !== t), { shouldDirty: true })

  const handleEnrich = async () => {
    const w = form.getValues('website')
    if (!w) {
      toast({ title: 'Add a website first', description: 'Gio needs a URL to enrich firmographics.', variant: 'destructive' })
      return
    }
    setEnriching(true)
    // Stub — wire to enrichment edge function when available
    setTimeout(() => {
      setEnriching(false)
      setEnriched(true)
      toast({ title: 'Enrichment ready', description: 'Review and edit the details before saving.' })
    }, 800)
  }

  const submit = async (values: FormValues, addAnother = false) => {
    const payload: CreateOrganizationData & UpdateOrganizationData = {
      name: values.name.trim(),
      status: values.status,
      website: normalizeWebsite(values.website) || null,
      logo_url: values.logo_url || null,
      industry: values.industry || null,
      company_size: (values.company_size as CompanySize) || null,
      hq_city: values.hq_city || null,
      country: values.country || null,
      account_owner_id: values.account_owner_id || null,
      tags: values.tags ?? [],
      description: values.description || null,
    }
    const result: any = await onSubmit(payload)

    // Add primary contact on create if filled
    if (!isEdit) {
      const c = values.contact
      const hasContact = !!(c.full_name && c.email)
      if (hasContact && result?.id) {
        try {
          await addContact.mutateAsync({
            company_id: result.id,
            full_name: c.full_name,
            role_title: c.role_title || null,
            email: c.email,
            phone: c.phone || null,
            is_primary: true,
          })
        } catch (e) { /* toast handled inside hook */ }
      }
    }

    if (addAnother) {
      form.reset({
        name: '', website: '', logo_url: '', industry: '', company_size: '',
        hq_city: '', country: '', account_owner_id: user?.id ?? '', status: 'active',
        tags: [], description: '',
        contact: { full_name: '', role_title: '', email: '', phone: '' },
      })
      setEnriched(false)
    } else {
      onClose()
    }
  }

  const handleDelete = () => {
    if (!organization) return
    onDelete?.(organization.id)
    setConfirmDelete(false)
    onClose()
  }

  const dealsCount = useMemo(
    () => deals.filter((d: any) => d.organization_id === organization?.id).length,
    [deals, organization?.id],
  )
  const jobsCount = useMemo(
    () => jobs.filter((j: any) => j.organization_id === organization?.id).length,
    [jobs, organization?.id],
  )
  const canHardDelete = dealsCount === 0 && jobsCount === 0

  const headerName = isEdit ? organization!.name : 'New company'
  const headerSubtitle = isEdit
    ? "Update this client's details. Changes apply everywhere this company appears — deals, jobs, and reports."
    : 'Add a client you recruit for. Paste their website and Gio fills in the firmographics — review before saving.'

  // ----- Contact row editor (inline) -----
  const startEditContact = (c: CompanyContact) => {
    setEditingContact(c)
    setShowAddContact(false)
    setContactDraft({
      full_name: c.full_name, role_title: c.role_title ?? '', email: c.email, phone: c.phone ?? '',
    })
  }
  const startAddContact = () => {
    setShowAddContact(true); setEditingContact(null)
    setContactDraft({ full_name: '', role_title: '', email: '', phone: '' })
  }
  const cancelContactEditor = () => {
    setShowAddContact(false); setEditingContact(null)
  }
  const saveContactEditor = async () => {
    if (!contactDraft.full_name.trim() || !/^\S+@\S+\.\S+$/.test(contactDraft.email)) {
      toast({ title: 'Name and a valid email are required', variant: 'destructive' })
      return
    }
    if (editingContact) {
      await updateContact.mutateAsync({
        id: editingContact.id,
        full_name: contactDraft.full_name,
        role_title: contactDraft.role_title,
        email: contactDraft.email,
        phone: contactDraft.phone,
      })
    } else if (organization) {
      await addContact.mutateAsync({
        company_id: organization.id,
        full_name: contactDraft.full_name,
        role_title: contactDraft.role_title,
        email: contactDraft.email,
        phone: contactDraft.phone,
        is_primary: contacts.length === 0,
      })
    }
    cancelContactEditor()
  }

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[640px] p-0 flex flex-col bg-[#FAFAF7]">
        {/* Header */}
        <div className="bg-white border-b border-virgilio-border px-6 pt-5 pb-5 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-poppins text-[10.5px] font-semibold tracking-[0.14em] uppercase text-virgilio-purple">
              CRM · Company
            </div>
            <div className="mt-1 flex items-center gap-3 flex-wrap">
              <h2 className="font-poppins font-semibold tracking-[-0.04em] text-[26px] leading-tight text-text-primary">
                {headerName}<span className="text-virgilio-purple">.</span>
              </h2>
              {isEdit && (
                <Badge
                  tone={status === 'active' ? 'green' : status === 'prospect' ? 'yellow' : 'neutral'}
                  dot size="sm"
                >
                  {status === 'active' ? 'Active' : status === 'prospect' ? 'Prospect' : 'Inactive'}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-body-sm text-text-secondary max-w-[520px]">
              {headerSubtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-[#F1F0EC] text-text-secondary"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scroll body */}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => submit(v, false))}
            className="flex-1 overflow-y-auto px-6 py-6 space-y-7"
          >
            {/* IDENTITY */}
            <section>
              <SectionHeader>Identity</SectionHeader>
              <Card>
                <div className="flex gap-4">
                  {/* Logo tile */}
                  <div className="shrink-0">
                    <Label className="mb-1.5 block text-xs font-medium text-text-secondary">Logo</Label>
                    <div className="relative">
                      <button
                        type="button"
                        className={cn(
                          'h-14 w-14 rounded-xl flex items-center justify-center',
                          isEdit && organization?.logo_url
                            ? ''
                            : 'border border-dashed border-virgilio-border bg-[#FAFAF7] hover:bg-[#F1F0EC] text-text-tertiary',
                        )}
                        style={
                          isEdit && organization
                            ? { backgroundColor: brandColor(organization.name), color: 'white' }
                            : undefined
                        }
                        onClick={() => toast({ title: 'Logo upload coming soon' })}
                      >
                        {isEdit && organization ? (
                          <span className="font-poppins font-semibold">{initials(organization.name)}</span>
                        ) : (
                          <ImagePlus className="w-5 h-5" />
                        )}
                      </button>
                      {isEdit && (
                        <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white border border-virgilio-border flex items-center justify-center shadow-sm">
                          <Pencil className="w-2.5 h-2.5 text-text-secondary" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Name + website */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Company name <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                              <Input className="h-11 pl-9" placeholder="e.g. Northwind Foods" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Website</FormLabel>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">https://</span>
                              <FormControl>
                                <Input className="h-11 pl-[60px]" placeholder="northwind.mx" {...field} />
                              </FormControl>
                            </div>
                            <Button
                              type="button"
                              variant={isEdit ? 'secondary' : 'purple'}
                              size="md"
                              icon={isEdit ? RefreshCw : Sparkles}
                              loading={enriching}
                              onClick={handleEnrich}
                            >
                              {isEdit ? 'Re-enrich' : 'Enrich'}
                            </Button>
                          </div>
                          <p className="mt-1.5 text-xs text-text-tertiary">
                            {isEdit
                              ? 'Re-run enrichment to refresh firmographics from the site.'
                              : 'Gio uses this to enrich industry, size, and HQ location.'}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </Card>
            </section>

            {/* COMPANY INFO */}
            <section>
              <SectionHeader right={enriched && !isEdit ? (
                <Badge tone="purple" size="xs" icon={Sparkles as any}>Gio enriched</Badge>
              ) : undefined}>
                Company info
              </SectionHeader>
              <Card>
                <div className={cn(
                  enriched && !isEdit && 'rounded-xl border border-[#EDE4FF] bg-[#FAF8FF] p-4 -m-1 mb-3',
                )}>
                  {enriched && !isEdit && (
                    <div className="mb-3 flex items-center gap-1.5 font-poppins text-[10.5px] font-semibold tracking-[0.14em] uppercase text-virgilio-purple">
                      <Sparkles className="w-3 h-3" /> Review & edit before saving
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="industry" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Industry</FormLabel>
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Select industry" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="company_size" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Company size</FormLabel>
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Select size" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COMPANY_SIZES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="hq_city" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">HQ city</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                            <Input className="h-11 pl-9" placeholder="e.g. Monterrey" {...field} />
                          </div>
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="country" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Country</FormLabel>
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Select country" /></SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-72">
                            {COUNTRIES.map(c => <SelectItem key={c.value} value={c.label}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                </div>
              </Card>
            </section>

            {/* ACCOUNT */}
            <section>
              <SectionHeader>Account</SectionHeader>
              <Card>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="account_owner_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Account owner <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={ownerOptions}
                          value={field.value || ''}
                          onValueChange={(v) => field.onChange(v || '')}
                          placeholder="Select an owner"
                          searchPlaceholder="Search members..."
                          emptyMessage="No members found."
                        />
                      </FormControl>
                      {!isEdit && (
                        <p className="mt-1.5 text-xs text-text-tertiary">The recruiter who manages this client.</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Status</FormLabel>
                      <div className="inline-flex rounded-xl bg-[#FAFAF7] border border-virgilio-border p-1 h-11 w-full">
                        {(['active', 'prospect', 'inactive'] as const).map(s => {
                          const active = field.value === s
                          const label = s.charAt(0).toUpperCase() + s.slice(1)
                          const dot = s === 'active' ? 'bg-[#12B886]' : s === 'prospect' ? 'bg-[#F59E0B]' : 'bg-[#9CA3AF]'
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => field.onChange(s)}
                              className={cn(
                                'flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-poppins font-medium transition-all',
                                active ? 'bg-white text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-primary',
                              )}
                            >
                              <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </FormItem>
                  )} />
                </div>

                {/* Tags */}
                <div className="mt-4">
                  <Label className="text-xs">Tags <span className="text-text-tertiary font-normal">(optional)</span></Label>
                  <div className="mt-1.5 min-h-[44px] rounded-lg border border-virgilio-border bg-white px-2 py-1.5 flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-virgilio-purple">
                    {tags.map(t => (
                      <Badge key={t} tone="purple" size="sm" onRemove={() => removeTag(t)}>{t}</Badge>
                    ))}
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                          e.preventDefault(); addTag(tagInput)
                        }
                        if (e.key === 'Backspace' && !tagInput && tags.length) removeTag(tags[tags.length - 1])
                      }}
                      onBlur={() => tagInput.trim() && addTag(tagInput)}
                      className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-text-tertiary py-1.5 px-1"
                      placeholder={tags.length ? 'Add tag…' : 'Add tag…'}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-text-tertiary">For segmenting accounts — e.g. industry, priority, region.</p>
                </div>
              </Card>
            </section>

            {/* PRIMARY CONTACT (create) OR CONTACTS (edit) */}
            {!isEdit ? (
              <section>
                <SectionHeader right={<Badge tone="lilac" size="xs">Recommended</Badge>}>
                  Primary contact
                </SectionHeader>
                <Card>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="contact.full_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Full name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                            <Input className="h-11 pl-9" placeholder="Jane Doe" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="contact.role_title" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Role / title</FormLabel>
                        <FormControl>
                          <Input className="h-11" placeholder="Head of Talent" {...field} />
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="contact.email" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                            <Input type="email" className="h-11 pl-9" placeholder="jane@northwind.mx" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="contact.phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Phone <span className="text-text-tertiary font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                            <Input className="h-11 pl-9" placeholder="+52 …" {...field} />
                          </div>
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <p className="mt-3 text-xs text-text-tertiary">
                    Add the main person you coordinate hiring with. You can add more contacts after creating the company.
                  </p>
                </Card>
              </section>
            ) : (
              <section>
                <SectionHeader right={
                  <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={startAddContact}>
                    Add contact
                  </Button>
                }>
                  Contacts ({contacts.length})
                </SectionHeader>
                <Card>
                  {contacts.length === 0 && !showAddContact ? (
                    <div className="py-6 text-center text-sm text-text-tertiary">
                      No contacts yet — add the main person you coordinate hiring with.
                    </div>
                  ) : (
                    <ul className="divide-y divide-virgilio-border -mx-1">
                      {contacts.map(c => (
                        <li key={c.id} className="px-1 py-3">
                          {editingContact?.id === c.id ? (
                            <ContactEditor
                              draft={contactDraft}
                              setDraft={setContactDraft}
                              onCancel={cancelContactEditor}
                              onSave={saveContactEditor}
                            />
                          ) : (
                            <div className="flex items-start gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback
                                  className="text-xs font-poppins font-semibold text-white"
                                  style={{ backgroundColor: brandColor(c.full_name) }}
                                >
                                  {initials(c.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-poppins text-sm font-medium text-text-primary truncate">{c.full_name}</span>
                                  {c.is_primary && <Badge tone="purple" size="xs">Primary</Badge>}
                                </div>
                                <div className="text-xs text-text-secondary truncate">
                                  {[c.role_title, c.email].filter(Boolean).join(' · ')}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {!c.is_primary && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button type="button" size="xs" variant="ghost" icon={Check} iconOnly aria-label="Set as primary"
                                        onClick={() => setPrimary.mutate(c.id)} />
                                    </TooltipTrigger>
                                    <TooltipContent>Set as primary</TooltipContent>
                                  </Tooltip>
                                )}
                                <Button type="button" size="xs" variant="ghost" icon={Pencil} iconOnly aria-label="Edit" onClick={() => startEditContact(c)} />
                                <Button type="button" size="xs" variant="ghost" icon={X} iconOnly aria-label="Remove" onClick={() => deleteContact.mutate(c.id)} />
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                      {showAddContact && (
                        <li className="px-1 py-3">
                          <ContactEditor
                            draft={contactDraft}
                            setDraft={setContactDraft}
                            onCancel={cancelContactEditor}
                            onSave={saveContactEditor}
                          />
                        </li>
                      )}
                    </ul>
                  )}
                </Card>
              </section>
            )}

            {/* NOTES */}
            <section>
              <SectionHeader>Notes</SectionHeader>
              <Card>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea rows={4} placeholder="Anything worth remembering about this client…" {...field} />
                    </FormControl>
                  </FormItem>
                )} />
              </Card>
            </section>

            {/* SYSTEM + DANGER (edit only) */}
            {isEdit && organization && (
              <>
                <section>
                  <SectionHeader>System</SectionHeader>
                  <Card>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-text-tertiary mb-1">Organization ID</div>
                        <code className="inline-block rounded-md bg-[#FAFAF7] border border-virgilio-border px-2 py-1 font-mono text-[11px] text-text-secondary truncate max-w-full">
                          {organization.id}
                        </code>
                      </div>
                      <Button
                        type="button" variant="secondary" size="sm" icon={Copy}
                        onClick={() => { navigator.clipboard.writeText(organization.id); toast({ title: 'ID copied' }) }}
                      >
                        Copy ID
                      </Button>
                    </div>
                    <div className="mt-3 text-xs text-text-tertiary">
                      Created {format(new Date(organization.created_at), 'MMM d, yyyy')}
                    </div>
                  </Card>
                </section>

                <section>
                  <SectionHeader>Danger zone</SectionHeader>
                  <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-poppins font-medium text-sm text-text-primary">Deactivate company</div>
                        <p className="text-xs text-text-secondary mt-0.5">Sets status to Inactive. Keeps deals and jobs intact.</p>
                      </div>
                      <Button
                        type="button" variant="secondary" size="sm"
                        onClick={() => { form.setValue('status', 'inactive'); toast({ title: 'Marked inactive', description: 'Click Save changes to apply.' }) }}
                      >
                        Deactivate
                      </Button>
                    </div>
                    <div className="border-t border-[#FECACA]" />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-poppins font-medium text-sm text-text-primary">Delete company</div>
                        <p className="text-xs text-text-secondary mt-0.5">
                          Permanent. Only available when there are no linked deals or jobs.
                        </p>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                type="button" variant="danger" size="sm" icon={Trash2}
                                disabled={!canHardDelete}
                                onClick={() => setConfirmDelete(true)}
                              >
                                Delete
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {!canHardDelete && (
                            <TooltipContent>
                              {dealsCount} deal{dealsCount !== 1 && 's'} · {jobsCount} job{jobsCount !== 1 && 's'} linked
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </section>
              </>
            )}
          </form>
        </Form>

        {/* Footer */}
        <div className="border-t border-virgilio-border bg-white px-6 py-3 flex items-center gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          {isEdit && organization && (
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <span className="h-3.5 w-3.5 rounded-full bg-[#F1F0EC] inline-flex items-center justify-center">
                <AlertTriangle className="w-2 h-2 text-text-tertiary" style={{ display: 'none' }} />
              </span>
              Client since <span className="text-text-secondary font-medium">{format(new Date(organization.created_at), 'MMM d, yyyy')}</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {isEdit ? (
              <>
                <Button type="button" variant="secondary" icon={ExternalLink} onClick={onClose}>
                  Open company
                </Button>
                <Button
                  type="button" variant="primary" loading={isLoading}
                  onClick={form.handleSubmit((v) => submit(v, false))}
                >
                  Save changes
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button" variant="secondary" loading={isLoading}
                  onClick={form.handleSubmit((v) => submit(v, true))}
                >
                  Save & add another
                </Button>
                <Button
                  type="button" variant="primary" icon={Check} loading={isLoading}
                  onClick={form.handleSubmit((v) => submit(v, false))}
                >
                  Create company
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Hard delete confirm */}
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this company?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes <strong>{organization?.name}</strong>. This action can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-[#B91C1C] hover:bg-[#991B1B] text-white">
                Delete permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}

// ---- inline contact editor ----
function ContactEditor({
  draft, setDraft, onSave, onCancel,
}: {
  draft: { full_name: string; role_title: string; email: string; phone: string }
  setDraft: (d: typeof draft) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-xl border border-virgilio-border bg-[#FAFAF7] p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Input className="h-10" placeholder="Full name *" value={draft.full_name}
          onChange={e => setDraft({ ...draft, full_name: e.target.value })} />
        <Input className="h-10" placeholder="Role / title" value={draft.role_title}
          onChange={e => setDraft({ ...draft, role_title: e.target.value })} />
        <Input className="h-10" placeholder="Email *" type="email" value={draft.email}
          onChange={e => setDraft({ ...draft, email: e.target.value })} />
        <Input className="h-10" placeholder="Phone" value={draft.phone}
          onChange={e => setDraft({ ...draft, phone: e.target.value })} />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="button" variant="primary" size="sm" onClick={onSave}>Save contact</Button>
      </div>
    </div>
  )
}
