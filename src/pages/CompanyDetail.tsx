import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow, differenceInCalendarDays, subMonths } from 'date-fns'
import {
  ArrowLeft, ChevronRight, Pencil, Plus, MoreHorizontal, Mail, Copy,
  Briefcase, Handshake, Trophy, Users, MapPin, Building2, Calendar,
  User as UserIcon, ExternalLink, Trash2, Activity as ActivityIcon, Globe, ArrowUpRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useOrganizations, type Organization } from '@/hooks/useOrganizations'
import { useDeals } from '@/hooks/useDeals'
import { useJobs } from '@/hooks/useJobs'
import { useDealStages } from '@/hooks/useDealStages'
import { useMembers } from '@/hooks/useMembers'
import { useCompanyContacts, type CompanyContact } from '@/hooks/useCompanyContacts'
import { OrganizationFormSheet } from '@/components/organizations/OrganizationFormSheet'
import { DealFormSheet } from '@/components/deals/DealFormSheet'
import { DealProfileSheet } from '@/components/deals/DealProfileSheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MetricStrip, type MetricItem } from '@/components/ui/metric-strip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/currency'

// ---------- helpers ----------
const BRAND_COLORS = ['#7C5CFA', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#6366F1']
function brandColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return BRAND_COLORS[h % BRAND_COLORS.length]
}
function initials(name: string, max = 2) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, max).map(w => w[0]?.toUpperCase() ?? '').join('') || '?'
}
function formatCompact(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${Math.round(n)}`
}
function daysInStage(updated_at: string) {
  return Math.max(0, differenceInCalendarDays(new Date(), new Date(updated_at)))
}
function statusBadge(status: Organization['status']) {
  if (status === 'active') return { tone: 'green' as const, label: 'Active' }
  if (status === 'prospect') return { tone: 'yellow' as const, label: 'Prospect' }
  return { tone: 'neutral' as const, label: 'Inactive' }
}

const SectionCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('rounded-2xl bg-white', className)} style={{ border: '1px solid #E7E8EE' }}>
    {children}
  </div>
)

// ---------- main ----------
export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { organizations, isLoading: orgsLoading, updateOrganization, deleteOrganization } = useOrganizations()
  const { data: allDeals = [] } = useDeals()
  const { jobs: allJobs = [] } = useJobs()
  const { data: dealStages = [] } = useDealStages()
  const { members } = useMembers()
  const { contacts, addContact, updateContact, setPrimary, deleteContact } = useCompanyContacts(id ?? null)

  const company = useMemo(() => organizations.find(o => o.id === id) ?? null, [organizations, id])

  const [editOpen, setEditOpen] = useState(false)
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [tab, setTab] = useState<'deals' | 'jobs' | 'contacts' | 'activity'>('deals')

  // ---- derived data ----
  const companyDeals = useMemo(
    () => allDeals.filter(d => d.organization_id === id),
    [allDeals, id],
  )
  const companyJobs = useMemo(
    () => allJobs.filter(j => j.organization_id === id),
    [allJobs, id],
  )
  const stageById = useMemo(() => new Map(dealStages.map(s => [s.id, s])), [dealStages])

  const openDeals = companyDeals.filter(d => {
    const s = d.stage_id ? stageById.get(d.stage_id) : null
    return !s || s.stage_type === 'open'
  })
  const openValue = openDeals.reduce((sum, d) => sum + (d.amount ?? 0), 0)

  const twelveMonthsAgo = subMonths(new Date(), 12)
  const wonRecent = companyDeals.filter(d => {
    const s = d.stage_id ? stageById.get(d.stage_id) : null
    return s?.stage_type === 'won' && new Date(d.updated_at) >= twelveMonthsAgo
  })

  const activeJobs = companyJobs.filter(j => j.status === 'open' || j.status === 'draft')

  // ---- candidate counts per job ----
  const { data: jobCandidateCounts = {} } = useQuery({
    queryKey: ['company-job-candidate-counts', id, companyJobs.map(j => j.id).join(',')],
    enabled: companyJobs.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select('job_id')
        .in('job_id', companyJobs.map(j => j.id))
      if (error) throw error
      const counts: Record<string, number> = {}
      ;(data ?? []).forEach((r: any) => { counts[r.job_id] = (counts[r.job_id] ?? 0) + 1 })
      return counts
    },
  })

  const owner = useMemo(() => {
    const ownerId = company?.account_owner_id ?? company?.owner_id
    return (members ?? []).find(m => m.user_id === ownerId)
  }, [members, company])

  // ---- activity feed (derived) ----
  const activity = useMemo(() => {
    if (!company) return []
    const items: { id: string; icon: any; tone: string; text: React.ReactNode; date: Date }[] = []
    items.push({
      id: 'created',
      icon: Building2, tone: 'neutral',
      text: <>Company <strong>{company.name}</strong> was created</>,
      date: new Date(company.created_at),
    })
    for (const c of contacts) {
      items.push({
        id: `contact-${c.id}`,
        icon: UserIcon, tone: 'blue',
        text: <>Contact <strong>{c.full_name}</strong> added</>,
        date: new Date(c.created_at),
      })
    }
    for (const d of companyDeals) {
      const s = d.stage_id ? stageById.get(d.stage_id) : null
      items.push({
        id: `deal-${d.id}`,
        icon: Handshake, tone: s?.stage_type === 'won' ? 'green' : s?.stage_type === 'lost' ? 'red' : 'purple',
        text: <>Deal <strong>{d.title}</strong> · {s?.name ?? 'No stage'}</>,
        date: new Date(d.updated_at),
      })
    }
    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 30)
  }, [company, contacts, companyDeals, stageById])

  // ---- handlers ----
  const handleSaveEdit = async (data: any) => {
    if (!company) return
    await updateOrganization(company.id, data)
    queryClient.invalidateQueries({ queryKey: ['company_contacts', company.id] })
  }
  const copyId = () => {
    if (!company) return
    navigator.clipboard.writeText(company.id)
    toast({ title: 'Organization ID copied' })
  }
  const deactivate = async () => {
    if (!company) return
    await updateOrganization(company.id, { status: 'inactive' })
  }
  const canDelete = companyDeals.length === 0 && companyJobs.length === 0
  const hardDelete = async () => {
    if (!company || !canDelete) return
    await deleteOrganization(company.id)
    navigate('/crm')
  }

  if (orgsLoading && !company) return <CompanyDetailSkeleton />
  if (!company) {
    return (
      <div className="min-h-screen" style={{ background: '#F6F5F1' }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/crm')}>Back to Companies</Button>
          <div className="mt-8 text-text-secondary">Company not found.</div>
        </div>
      </div>
    )
  }

  const sb = statusBadge(company.status)
  const location = [company.hq_city, company.country].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen" style={{ background: '#F6F5F1' }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 max-w-[1400px]">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-4">
          <Link to="/crm" className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Companies
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="text-text-primary font-medium truncate max-w-[280px]">{company.name}</span>
        </nav>

        {/* Header */}
        <header className="flex items-start gap-5 mb-5">
          <CompanyLogo company={company} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-poppins font-semibold tracking-[-0.04em] text-[26px] leading-tight text-text-primary truncate">
                {company.name}<span className="text-virgilio-purple">.</span>
              </h1>
              <Badge tone={sb.tone} dot size="sm">{sb.label}</Badge>
            </div>
            <div className="mt-2 flex items-center flex-wrap gap-x-5 gap-y-1.5 text-sm text-text-secondary">
              {company.industry && <MetaItem icon={Briefcase}>{company.industry}</MetaItem>}
              {location && <MetaItem icon={MapPin}>{location}</MetaItem>}
              {company.company_size && <MetaItem icon={Users}>{company.company_size} employees</MetaItem>}
              <MetaItem icon={Calendar}>Client since {format(new Date(company.created_at), 'MMM d, yyyy')}</MetaItem>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" icon={Pencil} onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="primary" icon={Plus} onClick={() => setNewDealOpen(true)}>New deal</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" icon={MoreHorizontal} iconOnly aria-label="More" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="min-w-[180px]">
                <DropdownMenuItem onClick={deactivate} disabled={company.status === 'inactive'}>
                  Deactivate company
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyId}>
                  <Copy className="w-3.5 h-3.5 mr-2" /> Copy Organization ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-virgilio-error focus:text-virgilio-error"
                  disabled={!canDelete}
                  onClick={hardDelete}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete company
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* KPI strip */}
        <div className="mb-5">
          <MetricStrip items={buildMetrics({
            openCount: openDeals.length,
            openValue,
            wonCount: wonRecent.length,
            activeJobs: activeJobs.length,
            contacts: contacts.length,
          })} />
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
          {/* Left: Tabs */}
          <SectionCard>
            <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: '#F1F0EC' }}>
              <Tabs current={tab} onChange={setTab} />
            </div>

            {tab === 'deals' && (
              <DealsTab
                deals={companyDeals}
                stages={dealStages}
                onOpenDeal={(d) => setSelectedDealId(d.id)}
                onCreateDeal={() => setNewDealOpen(true)}
              />
            )}
            {tab === 'jobs' && (
              <JobsTab
                jobs={companyJobs}
                candidateCounts={jobCandidateCounts}
                onOpenJob={(jobId) => navigate(`/jobs/${jobId}`)}
              />
            )}
            {tab === 'contacts' && (
              <ContactsTab
                companyId={company.id}
                contacts={contacts}
                onAdd={(input) => addContact.mutateAsync({ company_id: company.id, ...input })}
                onUpdate={(id, patch) => updateContact.mutateAsync({ id, ...patch })}
                onDelete={(id) => deleteContact.mutate(id)}
                onSetPrimary={(id) => setPrimary.mutate(id)}
              />
            )}
            {tab === 'activity' && <ActivityTab items={activity} />}
          </SectionCard>

          {/* Right rail */}
          <aside className="space-y-5">
            <AboutCard
              company={company}
              owner={owner}
              location={location}
              onCopyId={copyId}
            />
            <PrimaryContactCard
              contacts={contacts}
              onOpenContacts={() => setTab('contacts')}
            />
          </aside>
        </div>
      </div>

      {/* Edit sheet */}
      <OrganizationFormSheet
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleSaveEdit}
        organization={company}
        isLoading={false}
        onDelete={async (oid) => { await deleteOrganization(oid); navigate('/crm') }}
      />

      {/* New deal sheet (pre-selected company) */}
      <DealFormSheet
        open={newDealOpen}
        onOpenChange={setNewDealOpen}
        defaultOrganizationId={company.id}
      />

      {/* Deal profile */}
      <DealProfileSheet
        dealId={selectedDealId}
        open={!!selectedDealId}
        onOpenChange={(o) => !o && setSelectedDealId(null)}
      />
    </div>
  )
}

// ---------- subcomponents ----------

function CompanyLogo({ company }: { company: Organization }) {
  const size = 52
  if (company.logo_url) {
    return (
      <img
        src={company.logo_url}
        alt={`${company.name} logo`}
        className="rounded-xl object-cover shrink-0"
        style={{ width: size, height: size, border: '1px solid #E7E8EE' }}
      />
    )
  }
  return (
    <div
      className="rounded-xl flex items-center justify-center shrink-0 font-poppins font-semibold text-white text-lg"
      style={{ width: size, height: size, background: brandColor(company.name) }}
    >
      {initials(company.name)}
    </div>
  )
}

function MetaItem({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <Icon className="w-3.5 h-3.5 text-text-tertiary shrink-0" strokeWidth={2} />
      <span className="truncate">{children}</span>
    </span>
  )
}

function buildMetrics(args: {
  openCount: number; openValue: number; wonCount: number; activeJobs: number; contacts: number
}): MetricItem[] {
  return [
    {
      icon: Handshake, tone: 'purple', label: 'Open deals',
      value: String(args.openCount),
      unit: args.openValue > 0 ? ` · ${formatCompact(args.openValue)}` : undefined,
    },
    { icon: Trophy, tone: 'green', label: 'Won (12 mo)', value: args.wonCount },
    { icon: Briefcase, tone: 'yellow', label: 'Active jobs', value: args.activeJobs },
    { icon: Users, tone: 'blue', label: 'Contacts', value: args.contacts },
  ]
}

function Tabs({
  current, onChange,
}: { current: 'deals' | 'jobs' | 'contacts' | 'activity'; onChange: (t: any) => void }) {
  const tabs: { id: typeof current; label: string }[] = [
    { id: 'deals', label: 'Deals' },
    { id: 'jobs', label: 'Jobs' },
    { id: 'contacts', label: 'Contacts' },
    { id: 'activity', label: 'Activity' },
  ]
  return (
    <div className="inline-flex items-center gap-1">
      {tabs.map(t => {
        const active = current === t.id
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              'h-9 px-3 rounded-lg font-poppins text-[13px] font-medium transition-colors',
              active ? 'bg-[#F1F0EC] text-[#0d0d09]' : 'text-text-secondary hover:bg-[#FAFAF7] hover:text-text-primary',
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Deals tab ----------
function DealsTab({
  deals, stages, onOpenDeal, onCreateDeal,
}: {
  deals: any[]
  stages: any[]
  onOpenDeal: (d: any) => void
  onCreateDeal: () => void
}) {
  const stageById = new Map(stages.map(s => [s.id, s]))
  if (deals.length === 0) {
    return (
      <EmptyTab
        title="No deals yet"
        ctaLabel="Create the first deal"
        onCta={onCreateDeal}
      />
    )
  }
  return (
    <ul className="divide-y" style={{ borderColor: '#F1F0EC' }}>
      {deals.map(d => {
        const stage = d.stage_id ? stageById.get(d.stage_id) : null
        const stageColor = stage?.color || '#8B5CF6'
        const sub = [
          `${daysInStage(d.updated_at)}d in stage`,
          d.expected_close_date ? `closes ${format(new Date(d.expected_close_date), 'MMM d, yyyy')}` : null,
        ].filter(Boolean).join(' · ')
        const amount = d.base_amount ?? d.amount
        const currency = d.base_amount != null ? (d.base_currency ?? d.currency) : d.currency
        return (
          <li
            key={d.id}
            onClick={() => onOpenDeal(d)}
            className="group flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-[#FAFAF7] transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="font-poppins text-[14px] font-medium text-text-primary truncate">{d.title}</div>
              {sub && <div className="text-xs text-text-tertiary mt-0.5 truncate">{sub}</div>}
            </div>
            {stage && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 h-6 text-[11px] font-medium shrink-0"
                style={{ background: `${stageColor}1A`, color: stageColor }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: stageColor }} />
                {stage.name}
              </span>
            )}
            <div className="text-right shrink-0 min-w-[110px]">
              <span className="font-poppins tabular-nums text-[14px] font-semibold text-text-primary">
                {amount != null ? formatMoney(amount, currency || 'USD') : '—'}
              </span>
              {currency && amount != null && (
                <span className="ml-1 text-[10.5px] uppercase font-medium text-text-tertiary">{currency}</span>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </li>
        )
      })}
    </ul>
  )
}

// ---------- Jobs tab ----------
function JobsTab({
  jobs, candidateCounts, onOpenJob,
}: { jobs: any[]; candidateCounts: Record<string, number>; onOpenJob: (id: string) => void }) {
  if (jobs.length === 0) {
    return <EmptyTab title="No jobs linked yet" />
  }
  return (
    <ul className="divide-y" style={{ borderColor: '#F1F0EC' }}>
      {jobs.map(j => {
        const count = candidateCounts[j.id] ?? 0
        const stageTone =
          j.status === 'open' ? 'green' :
          j.status === 'draft' ? 'yellow' :
          j.status === 'closed' ? 'neutral' : 'neutral'
        return (
          <li
            key={j.id}
            onClick={() => onOpenJob(j.id)}
            className="group flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-[#FAFAF7] transition-colors"
          >
            <div
              className="flex items-center justify-center rounded-lg shrink-0"
              style={{ width: 36, height: 36, background: '#FEF3C7', color: '#B45309' }}
            >
              <Briefcase size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-poppins text-[14px] font-medium text-text-primary truncate">{j.title}</div>
              {j.location && <div className="text-xs text-text-tertiary mt-0.5 truncate">{j.location}</div>}
            </div>
            <Badge tone={stageTone as any} dot size="sm" className="shrink-0">
              {j.status === 'open' ? 'Open' : j.status === 'draft' ? 'Draft' : j.status === 'closed' ? 'Closed' : 'Archived'}
            </Badge>
            <div className="text-right shrink-0 min-w-[80px]">
              <span className="font-poppins tabular-nums text-[14px] font-semibold text-text-primary">{count}</span>
              <span className="ml-1 text-[11px] text-text-tertiary">{count === 1 ? 'candidate' : 'candidates'}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </li>
        )
      })}
    </ul>
  )
}

// ---------- Contacts tab ----------
function ContactsTab({
  companyId, contacts, onAdd, onUpdate, onDelete, onSetPrimary,
}: {
  companyId: string
  contacts: CompanyContact[]
  onAdd: (input: any) => Promise<any>
  onUpdate: (id: string, patch: any) => Promise<any>
  onDelete: (id: string) => void
  onSetPrimary: (id: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState({ full_name: '', role_title: '', email: '', phone: '' })

  const reset = () => { setDraft({ full_name: '', role_title: '', email: '', phone: '' }); setEditingId(null); setShowAdd(false) }
  const startEdit = (c: CompanyContact) => {
    setEditingId(c.id); setShowAdd(false)
    setDraft({ full_name: c.full_name, role_title: c.role_title ?? '', email: c.email, phone: c.phone ?? '' })
  }
  const save = async () => {
    if (!draft.full_name.trim() || !/^\S+@\S+\.\S+$/.test(draft.email)) {
      toast({ title: 'Name and a valid email are required', variant: 'destructive' })
      return
    }
    if (editingId) {
      await onUpdate(editingId, { ...draft })
    } else {
      await onAdd({ ...draft, is_primary: contacts.length === 0 })
    }
    reset()
  }

  if (contacts.length === 0 && !showAdd) {
    return (
      <div className="px-5 py-10 text-center">
        <div className="text-sm text-text-tertiary mb-4">No contacts yet — add the main person you coordinate hiring with.</div>
        <Button variant="secondary" icon={Plus} onClick={() => setShowAdd(true)}>Add contact</Button>
      </div>
    )
  }

  return (
    <>
      <ul className="divide-y" style={{ borderColor: '#F1F0EC' }}>
        {contacts.map(c => (
          <li key={c.id} className="px-5 py-3.5">
            {editingId === c.id ? (
              <InlineContactEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={reset} />
            ) : (
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback
                    className="text-[11px] font-poppins font-semibold text-white"
                    style={{ backgroundColor: brandColor(c.full_name) }}
                  >
                    {initials(c.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-poppins text-[14px] font-medium text-text-primary truncate">{c.full_name}</span>
                    {c.is_primary && <Badge tone="lilac" size="xs">Primary</Badge>}
                  </div>
                  <div className="text-xs text-text-secondary truncate">
                    {[c.role_title, c.email].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="xs" variant="ghost" icon={Mail} iconOnly aria-label="Email"
                    onClick={() => window.location.href = `mailto:${c.email}`} />
                  {!c.is_primary && (
                    <Button size="xs" variant="ghost" onClick={() => onSetPrimary(c.id)}>Make primary</Button>
                  )}
                  <Button size="xs" variant="ghost" icon={Pencil} iconOnly aria-label="Edit" onClick={() => startEdit(c)} />
                  <Button size="xs" variant="ghost" icon={Trash2} iconOnly aria-label="Remove" onClick={() => onDelete(c.id)} />
                </div>
              </div>
            )}
          </li>
        ))}
        {showAdd && (
          <li className="px-5 py-3.5">
            <InlineContactEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={reset} />
          </li>
        )}
      </ul>
      {!showAdd && (
        <div className="px-5 py-3 border-t" style={{ borderColor: '#F1F0EC' }}>
          <Button variant="ghost" size="sm" icon={Plus} onClick={() => setShowAdd(true)}>Add contact</Button>
        </div>
      )}
    </>
  )
}

function InlineContactEditor({
  draft, setDraft, onSave, onCancel,
}: {
  draft: { full_name: string; role_title: string; email: string; phone: string }
  setDraft: (d: typeof draft) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-xl border bg-[#FAFAF7] p-3 space-y-2" style={{ borderColor: '#E7E8EE' }}>
      <div className="grid grid-cols-2 gap-2">
        <input
          className="h-10 rounded-md border bg-white px-3 text-sm" style={{ borderColor: '#E7E8EE' }}
          placeholder="Full name *" value={draft.full_name}
          onChange={e => setDraft({ ...draft, full_name: e.target.value })}
        />
        <input
          className="h-10 rounded-md border bg-white px-3 text-sm" style={{ borderColor: '#E7E8EE' }}
          placeholder="Role / title" value={draft.role_title}
          onChange={e => setDraft({ ...draft, role_title: e.target.value })}
        />
        <input
          className="h-10 rounded-md border bg-white px-3 text-sm" style={{ borderColor: '#E7E8EE' }}
          placeholder="Email *" type="email" value={draft.email}
          onChange={e => setDraft({ ...draft, email: e.target.value })}
        />
        <input
          className="h-10 rounded-md border bg-white px-3 text-sm" style={{ borderColor: '#E7E8EE' }}
          placeholder="Phone" value={draft.phone}
          onChange={e => setDraft({ ...draft, phone: e.target.value })}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="button" variant="primary" size="sm" onClick={onSave}>Save contact</Button>
      </div>
    </div>
  )
}

// ---------- Activity tab ----------
function ActivityTab({
  items,
}: { items: { id: string; icon: any; tone: string; text: React.ReactNode; date: Date }[] }) {
  if (items.length === 0) {
    return <EmptyTab title="No activity yet" />
  }
  const TONE: Record<string, { bg: string; fg: string }> = {
    purple:  { bg: '#EDE4FF', fg: '#6F3FF5' },
    green:   { bg: '#D1FAE5', fg: '#12B886' },
    yellow:  { bg: '#FEF3C7', fg: '#B45309' },
    blue:    { bg: '#DBEAFE', fg: '#2563EB' },
    red:     { bg: '#FEE2E2', fg: '#B91C1C' },
    neutral: { bg: '#F1F0EC', fg: '#5A6072' },
  }
  return (
    <ul className="px-5 py-4 relative">
      <div
        className="absolute top-6 bottom-6 w-px"
        style={{ left: 'calc(1.25rem + 14px)', background: '#F1F0EC' }}
        aria-hidden
      />
      {items.map(it => {
        const t = TONE[it.tone] ?? TONE.neutral
        const Icon = it.icon
        return (
          <li key={it.id} className="relative flex items-start gap-3 py-2.5">
            <div
              className="flex items-center justify-center shrink-0 z-10"
              style={{ width: 28, height: 28, borderRadius: 8, background: t.bg, color: t.fg, border: '2px solid white' }}
            >
              <Icon size={13} />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <div className="text-sm text-text-primary">{it.text}</div>
              <div className="text-xs text-text-tertiary mt-0.5">{formatDistanceToNow(it.date, { addSuffix: true })}</div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function EmptyTab({ title, ctaLabel, onCta }: { title: string; ctaLabel?: string; onCta?: () => void }) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="text-sm text-text-secondary">{title}.</div>
      {ctaLabel && (
        <Button variant="link" className="mt-1" onClick={onCta}>
          {ctaLabel} →
        </Button>
      )}
    </div>
  )
}

// ---------- Right rail ----------
function AboutCard({
  company, owner, location, onCopyId,
}: { company: Organization; owner: any; location: string; onCopyId: () => void }) {
  const ownerName = owner
    ? `${owner.user_first_name ?? ''} ${owner.user_last_name ?? ''}`.trim() || owner.user_email
    : null
  return (
    <SectionCard>
      <div className="px-5 py-4 border-b" style={{ borderColor: '#F1F0EC' }}>
        <h3 className="font-poppins font-semibold text-[15px] text-text-primary">About</h3>
      </div>
      <dl className="px-5 py-4 space-y-3.5 text-sm">
        <Row icon={UserIcon} label="Account owner">
          {ownerName ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[9px] font-semibold text-white" style={{ background: brandColor(ownerName) }}>
                  {initials(ownerName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-text-primary font-medium">{ownerName}</span>
            </div>
          ) : <span className="text-text-tertiary">Unassigned</span>}
        </Row>
        <Row icon={Briefcase} label="Industry">
          {company.industry ?? <span className="text-text-tertiary">—</span>}
        </Row>
        <Row icon={Users} label="Company size">
          {company.company_size ? `${company.company_size} employees` : <span className="text-text-tertiary">—</span>}
        </Row>
        <Row icon={MapPin} label="Location">
          {location || <span className="text-text-tertiary">—</span>}
        </Row>
        {company.website && (
          <Row icon={Globe} label="Website">
            <a
              href={`https://${company.website.replace(/^https?:\/\//, '')}`}
              target="_blank" rel="noreferrer"
              className="text-virgilio-purple hover:underline inline-flex items-center gap-1 truncate"
            >
              {company.website}<ArrowUpRight className="w-3 h-3 shrink-0" />
            </a>
          </Row>
        )}
        <Row icon={Calendar} label="Client since">
          {format(new Date(company.created_at), 'MMM d, yyyy')}
        </Row>
        <div className="pt-1">
          <div className="text-xs text-text-tertiary mb-1">Organization ID</div>
          <button
            onClick={onCopyId}
            className="w-full inline-flex items-center justify-between gap-2 rounded-md bg-[#FAFAF7] hover:bg-[#F1F0EC] border px-2.5 py-1.5 text-left transition-colors"
            style={{ borderColor: '#E7E8EE' }}
          >
            <code className="font-mono text-[11px] text-text-secondary truncate">{company.id}</code>
            <Copy className="w-3 h-3 text-text-tertiary shrink-0" />
          </button>
        </div>
      </dl>
    </SectionCard>
  )
}

function Row({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-text-tertiary mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium mb-0.5">{label}</div>
        <div className="text-sm text-text-primary truncate">{children}</div>
      </div>
    </div>
  )
}

function PrimaryContactCard({
  contacts, onOpenContacts,
}: { contacts: CompanyContact[]; onOpenContacts: () => void }) {
  const primary = contacts.find(c => c.is_primary) ?? contacts[0] ?? null
  return (
    <SectionCard>
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#F1F0EC' }}>
        <h3 className="font-poppins font-semibold text-[15px] text-text-primary">Primary contact</h3>
        <button
          onClick={onOpenContacts}
          className="text-text-tertiary hover:text-text-primary"
          aria-label="View all contacts"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
      <div className="px-5 py-4">
        {!primary ? (
          <div className="text-sm text-text-tertiary">No contacts yet.</div>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-[12px] font-poppins font-semibold text-white" style={{ background: brandColor(primary.full_name) }}>
                {initials(primary.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-poppins text-[14px] font-medium text-text-primary truncate">{primary.full_name}</div>
              <div className="text-xs text-text-secondary truncate">{primary.role_title ?? primary.email}</div>
            </div>
            <Button
              size="sm" variant="secondary" icon={Mail} iconOnly aria-label="Email"
              onClick={() => window.location.href = `mailto:${primary.email}`}
            />
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ---------- Skeleton ----------
function CompanyDetailSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: '#F6F5F1' }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-[1400px]">
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="flex items-start gap-5 mb-5">
          <Skeleton className="h-[52px] w-[52px] rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <Skeleton className="h-[72px] w-full rounded-2xl mb-5" />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
          <Skeleton className="h-96 rounded-2xl" />
          <div className="space-y-5">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
