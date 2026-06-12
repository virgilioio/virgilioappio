import { useMemo, useState, useEffect, type CSSProperties, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ExternalLink, CheckCircle2, XCircle, Clock,
  Briefcase, Users, UserCheck, Lightbulb, Copy, Check, CalendarPlus, Sparkles, CreditCard, Ban,
  UserPlus, ArrowRightLeft, Video, Upload, FileText, Download, Minus, Plus,
  CircleDollarSign, Mail, Eye, PencilLine,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { format, formatDistanceToNowStrict, differenceInCalendarDays, isToday, isYesterday } from 'date-fns'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabaseClient'
import { useSaaSCustomer } from '@/hooks/useSaaSCustomer'
import { useSaaSCustomerMembers } from '@/hooks/useSaaSCustomerMembers'
import { useSaaSCustomerOnboarding } from '@/hooks/useSaaSCustomerOnboarding'
import {
  useSuspendOrganization, useExtendTrial,
} from '@/hooks/useSaaSAdminActions'
import { useChangePlan } from '@/hooks/useChangePlan'
import { useAssignTenantCredits } from '@/hooks/useAssignTenantCredits'
import { calculateCustomerHealth, type CustomerHealthResult } from '@/utils/customerHealth'

import { SuspendOrganizationDialog } from '@/components/settings/SuspendOrganizationDialog'
import { ExtendTrialDialog } from '@/components/settings/ExtendTrialDialog'
import { ChangePlanDialog } from '@/components/settings/ChangePlanDialog'
import { AssignCreditsDialog } from '@/components/settings/AssignCreditsDialog'

// ─────────────────────────────────────────────────────────────────
// design tokens
// ─────────────────────────────────────────────────────────────────
const CARD: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E7E8EE',
  borderRadius: 12,
  marginBottom: 14,
  overflow: 'hidden',
}
const SEP: CSSProperties = { borderBottom: '1px solid #F1F0EC' }
const NOIR = '#0d0d09'
const CREAM = '#fffcf9'
const MUTED = '#8B8F9E'
const TEXT = '#1F2230'
const SUBTEXT = '#5A6072'
const HAIRLINE = '#F1F0EC'

const CHIP_TONES = {
  green:  { bg: '#D1FAE5', fg: '#0B7A57' },
  amber:  { bg: '#FEF3C7', fg: '#92400E' },
  blue:   { bg: '#DBEAFE', fg: '#1D4ED8' },
  purple: { bg: '#EDE4FF', fg: '#5B21B6' },
  gray:   { bg: '#F1F0EC', fg: '#5A6072' },
  red:    { bg: '#FEE2E2', fg: '#B91C1C' },
} as const
type ChipTone = keyof typeof CHIP_TONES

// ─────────────────────────────────────────────────────────────────
// primitives
// ─────────────────────────────────────────────────────────────────
function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  const t = CHIP_TONES[tone]
  return (
    <span
      className="inline-flex items-center font-inter whitespace-nowrap"
      style={{
        background: t.bg, color: t.fg, borderRadius: 999,
        padding: '2px 8px', fontSize: 10, fontWeight: 600, lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  )
}

function CardHeader({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4" style={{ ...SEP, padding: '14px 18px' }}>
      <div className="min-w-0">
        <h3 className="font-poppins font-semibold m-0" style={{ color: NOIR, fontSize: 13.5, letterSpacing: '-0.01em', lineHeight: 1.2 }}>{title}</h3>
        {desc && <p className="font-inter m-0" style={{ color: MUTED, fontSize: 11.5, marginTop: 3, lineHeight: 1.45 }}>{desc}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

function Row({ children, last, style }: { children: ReactNode; last?: boolean; style?: CSSProperties }) {
  return (
    <div
      className="flex items-center gap-3"
      style={{ padding: '10px 18px', borderBottom: last ? 'none' : `1px solid ${HAIRLINE}`, ...style }}
    >
      {children}
    </div>
  )
}

const NOIR_BTN: CSSProperties = {
  background: NOIR, color: CREAM, borderRadius: 9, padding: '0 14px', height: 32,
  fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, display: 'inline-flex',
  alignItems: 'center', gap: 6, border: `1px solid ${NOIR}`, cursor: 'pointer',
}
const SEC_BTN: CSSProperties = {
  background: '#FFFFFF', color: SUBTEXT, borderRadius: 9, padding: '0 12px', height: 32,
  fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, display: 'inline-flex',
  alignItems: 'center', gap: 6, border: '1px solid #E7E8EE', cursor: 'pointer',
}

// ─────────────────────────────────────────────────────────────────
// MetricStrip (5 cells, with icons + deltas)
// ─────────────────────────────────────────────────────────────────
interface MetricCell {
  icon: LucideIcon; iconBg: string; iconColor: string
  label: string; value: string | number; suffix?: string
  delta?: { text: string; tone: 'green' | 'amber' }
  muted?: boolean
}
function MetricStrip({ cells }: { cells: MetricCell[] }) {
  return (
    <section style={CARD} className="flex">
      {cells.map((c, i) => {
        const Icon = c.icon
        return (
          <div key={c.label} className="flex items-center gap-2.5"
               style={{ flex: 1, padding: '12px 16px', minHeight: 56, borderLeft: i > 0 ? `1px solid ${HAIRLINE}` : undefined }}>
            <div className="flex items-center justify-center shrink-0"
                 style={{ width: 28, height: 28, borderRadius: 8, background: c.iconBg }}>
              <Icon size={14} strokeWidth={2} color={c.iconColor} />
            </div>
            <div className="min-w-0">
              <div className="font-inter" style={{ fontSize: 11, fontWeight: 500, color: MUTED }}>{c.label}</div>
              <div className="flex items-baseline gap-2" style={{ marginTop: 2 }}>
                <span className="font-poppins tabular-nums"
                      style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em',
                               color: c.muted ? '#B5B9C4' : NOIR, lineHeight: 1.1 }}>
                  {c.value}
                </span>
                {c.suffix && <span className="font-inter" style={{ fontSize: 11.5, color: SUBTEXT }}>{c.suffix}</span>}
                {c.delta && (
                  <span className="font-inter inline-flex items-center gap-0.5"
                        style={{ fontSize: 10.5, fontWeight: 600,
                                 color: c.delta.tone === 'green' ? '#12B886' : '#B45309' }}>
                    {c.delta.tone === 'green' && <span style={{ fontSize: 10 }}>↑</span>}
                    {c.delta.text}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        height: 28, padding: '0 12px', borderRadius: 999, fontFamily: 'Inter, sans-serif',
        fontSize: 11.5, fontWeight: 500,
        background: active ? NOIR : '#FFFFFF', color: active ? CREAM : TEXT,
        border: `1px solid ${active ? NOIR : '#E7E8EE'}`, cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────
const initials = (s: string) =>
  s.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

function timeAgoShort(iso?: string | null) {
  if (!iso) return 'never'
  try { return formatDistanceToNowStrict(new Date(iso), { addSuffix: true }) }
  catch { return '—' }
}

function CopyBtn({ value, title = 'Copy' }: { value: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button type="button" title={title} aria-label={title}
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: copied ? '#0B7A57' : '#8B8F9E' }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────
// Health criteria detail mapping
// ─────────────────────────────────────────────────────────────────
const HEALTH_WHY: Record<string, string> = {
  'Recent Activity': 'Active accounts touch the product weekly',
  'Declining Activity': 'Weeks without activity is a top churn signal',
  'No Recent Activity': 'Nothing in the last 30 days — the #1 churn predictor',
  'Jobs Created': 'Jobs created → product fit',
  'No Jobs Created': 'No jobs in 30 days — likely not getting value',
  'Candidates Added': 'Candidates flowing in → recruiting workflow is live',
  'No Candidates Added': 'No candidates added — workflow not started',
  'Team Size': 'Multiple users means stickiness',
  'No Active Members': 'Only one active member — bus factor',
  'Account Status': 'Suspended accounts cannot use the product',
}

// ─────────────────────────────────────────────────────────────────
// Activity feed bucketing
// ─────────────────────────────────────────────────────────────────
type FeedFilter = 'all' | 'jobs' | 'candidates' | 'interviews' | 'documents' | 'team' | 'platform'

const PLATFORM_TYPES = new Set([
  'trial_started', 'trial_extended',
  'plan_changed', 'plan_converted', 'subscription_converted',
  'payment_succeeded', 'payment_failed',
  'credits_purchased', 'credits_granted',
  'workspace_suspended', 'workspace_reactivated',
])

function feedCategory(type: string): FeedFilter {
  if (PLATFORM_TYPES.has(type)) return 'platform'
  if (type.startsWith('job_')) return 'jobs'
  if (type.startsWith('interview')) return 'interviews'
  if (type === 'candidate_attachment_uploaded') return 'documents'
  if (type.startsWith('candidate_')) return 'candidates'
  if (type.startsWith('member_')) return 'team'
  return 'all'
}

const FEED_ICON_MAP: Record<FeedFilter, { icon: LucideIcon; bg: string; fg: string }> = {
  all:        { icon: FileText,       bg: '#F1F0EC', fg: SUBTEXT },
  jobs:       { icon: Briefcase,      bg: '#EDE4FF', fg: '#6F3FF5' },
  candidates: { icon: UserPlus,       bg: '#D1FAE5', fg: '#12B886' },
  interviews: { icon: Video,          bg: '#FCE7F3', fg: '#BE185D' },
  documents:  { icon: Upload,         bg: '#DBEAFE', fg: '#2563EB' },
  team:       { icon: Users,          bg: '#F1F0EC', fg: SUBTEXT },
  platform:   { icon: CreditCard,     bg: '#E0E7FF', fg: '#4F46E5' },
}

function stageIconOverride(type: string) {
  if (type === 'candidate_stage_changed' || type === 'candidate_status_changed') {
    return { icon: ArrowRightLeft, bg: '#FEF3C7', fg: '#B45309' }
  }
  return null
}

function dayLabel(d: Date) {
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d')
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────
export function SaaSCustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: customer, isLoading } = useSaaSCustomer(id!)

  const [tab, setTab] = useState<'overview' | 'members' | 'billing' | 'activity'>('overview')
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all')

  const [suspendOpen, setSuspendOpen] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)

  const suspendMutation = useSuspendOrganization()
  const extendMutation = useExtendTrial()
  const changeMutation = useChangePlan()
  const assignMutation = useAssignTenantCredits()

  const { data: sub } = useQuery({
    queryKey: ['tenant-subscription', customer?.tenant_id],
    queryFn: async () => {
      if (!customer?.tenant_id) return null
      const { data, error } = await supabase
        .from('tenant_subscriptions').select('*')
        .eq('tenant_id', customer.tenant_id).single()
      if (error) throw error
      return data as any
    },
    enabled: !!customer?.tenant_id,
  })

  const { data: creditUsage } = useQuery({
    queryKey: ['sourcing-credits-usage', customer?.tenant_id],
    queryFn: async () => {
      if (!customer?.tenant_id) return null
      const { data, error } = await supabase
        .from('sourcing_credits_usage').select('*')
        .eq('tenant_id', customer.tenant_id)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw error
      return data as any
    },
    enabled: !!customer?.tenant_id,
  })

  const { data: creditPurchases } = useQuery({
    queryKey: ['credit-purchases', customer?.tenant_id],
    queryFn: async () => {
      if (!customer?.tenant_id) return []
      const { data, error } = await supabase
        .from('credit_purchases').select('*')
        .eq('tenant_id', customer.tenant_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as any[]
    },
    enabled: !!customer?.tenant_id,
  })

  const health: CustomerHealthResult = useMemo(() => {
    if (!customer) return { status: 'inactive', reasons: [], recommendation: '' }
    return calculateCustomerHealth({
      status: customer.status,
      last_active_at: customer.last_active_at,
      jobs_created_30d: customer.jobs_created_30d,
      candidates_added_30d: customer.candidates_added_30d,
      members_active_count: customer.members_active_count,
    })
  }, [customer])

  // ── Seat stepper mutation
  const seatMutation = useMutation({
    mutationFn: async (newSeatCount: number) => {
      const { data, error } = await supabase.functions.invoke('update-seat-quantity', {
        body: { tenantId: customer!.tenant_id, newSeatCount },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Seats updated')
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] })
      queryClient.invalidateQueries({ queryKey: ['saas-customer'] })
    },
    onError: (e: Error) => toast.error('Failed to update seats', { description: e.message }),
  })

  if (isLoading) return <div style={{ padding: 32, textAlign: 'center', color: MUTED, fontFamily: 'Inter' }}>Loading…</div>
  if (!customer) return <div style={{ padding: 32, textAlign: 'center', color: MUTED, fontFamily: 'Inter' }}>Customer not found</div>

  const ownerName = customer.owner_details
    ? `${customer.owner_details.first_name || ''} ${customer.owner_details.last_name || ''}`.trim() || customer.owner_details.email || 'Unknown'
    : 'Unknown'
  const ownerEmail = customer.owner_details?.email || ''

  const seats = sub?.seat_quantity ?? 1
  const interval = sub?.billing_interval as 'month' | 'year' | null | undefined
  const billingStatus = (sub?.billing_status || customer.status || '').toString()

  // ── Header chips
  const statusChip = (() => {
    if (billingStatus === 'trialing' || billingStatus === 'pending_trial')
      return <Chip tone="blue">Trialing</Chip>
    if (customer.status === 'suspended' || billingStatus === 'locked')
      return <Chip tone="gray">Locked</Chip>
    if (billingStatus === 'past_due') return <Chip tone="amber">Past due</Chip>
    return <Chip tone="green">Active</Chip>
  })()

  const isTrialing = billingStatus === 'trialing' || billingStatus === 'pending_trial'
  const trialEndIso: string | null = sub?.trial_ends_at || customer.trial_end_date || null
  const trialStartIso: string | null = sub?.trial_started_at || null
  const trialLen = trialStartIso && trialEndIso
    ? Math.max(1, differenceInCalendarDays(new Date(trialEndIso), new Date(trialStartIso)))
    : 14
  const daysIntoTrial = trialStartIso
    ? Math.max(0, differenceInCalendarDays(new Date(), new Date(trialStartIso)))
    : null
  const daysLeftTrial = trialEndIso
    ? differenceInCalendarDays(new Date(trialEndIso), new Date())
    : null

  // ── Digest
  const digest: ReactNode = (() => {
    const name = <strong style={{ color: NOIR, fontWeight: 600 }}>{customer.name}</strong>
    const lastActive = customer.last_active_at
      ? formatDistanceToNowStrict(new Date(customer.last_active_at), { addSuffix: false })
      : null
    if (customer.status === 'suspended') {
      return <>
        {name} was <strong style={{ color: NOIR }}>locked on {customer.suspended_at ? format(new Date(customer.suspended_at), 'MMM d') : '—'}</strong>
        {customer.suspended_reason ? <> after {customer.suspended_reason}</> : null}.
        Last real activity was {lastActive || 'over 30 days'} ago — <strong style={{ color: NOIR }}>likely churned.</strong>
      </>
    }
    if (isTrialing && health.status !== 'healthy') {
      const stalled = customer.jobs_created_30d === 0 && customer.candidates_added_30d === 0
      return <>
        {name} is <strong style={{ color: NOIR }}>{daysIntoTrial ?? 0} {(daysIntoTrial ?? 0) === 1 ? 'day' : 'days'} into a {trialLen}-day trial</strong>
        {stalled ? <> and hasn't created a job or added a candidate</> : <> with {customer.jobs_created_30d} job{customer.jobs_created_30d === 1 ? '' : 's'} and {customer.candidates_added_30d} candidate{customer.candidates_added_30d === 1 ? '' : 's'}</>}.
        {lastActive ? <> The owner was last seen {lastActive} ago — </> : <> No owner activity yet — </>}
        <strong style={{ color: NOIR }}>a check-in could unblock them before the trial goes cold.</strong>
      </>
    }
    if (health.status === 'healthy') {
      return <>
        {name} is <strong style={{ color: NOIR }}>healthy and growing</strong> — {customer.jobs_total} active job{customer.jobs_total === 1 ? '' : 's'}, {customer.candidates_added_30d} new candidate{customer.candidates_added_30d === 1 ? '' : 's'} this month, all {customer.members_active_count} seat{customer.members_active_count === 1 ? '' : 's'} in weekly use. <strong style={{ color: NOIR }}>No action needed.</strong>
      </>
    }
    return <>
      {name} has {customer.jobs_total} job{customer.jobs_total === 1 ? '' : 's'} and {customer.members_active_count} active member{customer.members_active_count === 1 ? '' : 's'}.
      {lastActive ? <> Last activity {lastActive} ago — </> : <> No activity recorded — </>}
      <strong style={{ color: NOIR }}>monitor for engagement.</strong>
    </>
  })()

  // ── Health metric (passing count) — still shown in Health signals card
  const passingCount = health.reasons.filter(r => r.passed).length
  const totalSignals = health.reasons.length || 1

  // ── Money cell (replaces Health in metric strip)
  const pricePerSeat = interval === 'year' ? 49 : 5
  const moneyCell: MetricCell = (() => {
    if (isTrialing) {
      const monthly = seats * 5 // seats × monthly seat price
      return {
        icon: CircleDollarSign, iconBg: '#D1FAE5', iconColor: '#0B7A57',
        label: 'Plan value',
        value: `$${monthly.toLocaleString()}`, suffix: '/mo',
        delta: { text: '$0 collected', tone: 'amber' },
      }
    }
    if (interval === 'year') {
      const arr = seats * pricePerSeat
      return {
        icon: CircleDollarSign, iconBg: '#D1FAE5', iconColor: '#0B7A57',
        label: 'ARR', value: `$${arr.toLocaleString()}`, suffix: '/yr',
      }
    }
    const mrr = seats * pricePerSeat
    return {
      icon: CircleDollarSign, iconBg: '#D1FAE5', iconColor: '#0B7A57',
      label: 'MRR', value: `$${mrr.toLocaleString()}`, suffix: '/mo',
    }
  })()

  // ── Trial / renewal cell
  const trialOrRenewal: MetricCell = (() => {
    if (customer.status === 'suspended') {
      return {
        icon: Clock, iconBg: '#F1F0EC', iconColor: SUBTEXT, label: 'Locked',
        value: customer.suspended_at ? format(new Date(customer.suspended_at), 'MMM d') : '—',
      }
    }
    if (isTrialing && trialEndIso) {
      return {
        icon: Clock, iconBg: '#DBEAFE', iconColor: '#2563EB', label: 'Trial ends',
        value: format(new Date(trialEndIso), 'MMM d'),
        delta: daysLeftTrial !== null
          ? { text: `${Math.max(0, daysLeftTrial)} days left`, tone: 'amber' }
          : undefined,
      }
    }
    const renew = sub?.current_period_end_at
    return {
      icon: Clock, iconBg: '#DBEAFE', iconColor: '#2563EB', label: 'Renews',
      value: renew ? format(new Date(renew), 'MMM d') : '—',
      muted: !renew,
    }
  })()

  // ── Activity day groups
  const filteredFeed = (customer.recent_activities || []).filter((a: any) =>
    feedFilter === 'all' ? true : feedCategory(a.activity_type) === feedFilter
  )
  const groupedFeed: Record<string, any[]> = {}
  filteredFeed.forEach((a: any) => {
    const k = dayLabel(new Date(a.created_at))
    if (!groupedFeed[k]) groupedFeed[k] = []
    groupedFeed[k].push(a)
  })
  const firstGroupKey = Object.keys(groupedFeed)[0]

  return (
    <div style={{ background: '#F6F5F1', minHeight: '100%' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 28px' }}>

        {/* Breadcrumb */}
        <button onClick={() => navigate('/settings?tab=platform-saas-customers')}
          className="font-inter inline-flex items-center gap-1.5"
          style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', padding: 0, marginBottom: 14 }}>
          <ArrowLeft size={12} /> Settings · Platform · SaaS customers
        </button>

        {/* Header row */}
        <div className="flex items-start gap-3.5" style={{ marginBottom: 12 }}>
          <div className="flex items-center justify-center shrink-0"
            style={{ width: 44, height: 44, borderRadius: 10, background: '#EDE4FF',
                     color: '#5B21B6', fontFamily: 'Poppins', fontWeight: 600, fontSize: 15 }}>
            {initials(customer.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-poppins m-0"
                  style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.04em', color: NOIR, lineHeight: 1.1 }}>
                {customer.name}<span style={{ color: '#D7C5FB' }}>.</span>
              </h1>
              {statusChip}
              {(health.status === 'churn-risk' || health.status === 'at-risk') && (
                <span className="inline-flex items-center gap-1.5 font-inter"
                      style={{ fontSize: 11, fontWeight: 600,
                               color: health.status === 'churn-risk' ? '#DC2626' : '#B45309' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999,
                                 background: health.status === 'churn-risk' ? '#DC2626' : '#F59E0B' }} />
                  {health.status === 'churn-risk' ? 'High' : 'At risk'}
                </span>
              )}
              <Chip tone="gray">{seats} seat{seats === 1 ? '' : 's'} · {interval === 'year' ? 'Annual' : 'Monthly'}</Chip>
              <Chip tone="gray">{(customer.signup_source || 'self_serve').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Chip>
            </div>
            <div className="font-inter" style={{ marginTop: 6, color: MUTED, fontSize: 11.5 }}>
              Owner {ownerName}
              {ownerEmail && <> · {ownerEmail}</>}
              {' · '}{isTrialing ? 'signed up' : 'customer since'} {format(new Date(customer.created_at), 'MMM d, yyyy')}
              {customer.last_active_at && <> · last active {timeAgoShort(customer.last_active_at)}</>}
            </div>
          </div>
          {sub?.stripe_customer_id && (
            <button onClick={() => window.open(`https://dashboard.stripe.com/customers/${sub.stripe_customer_id}`, '_blank')}
                    style={SEC_BTN}>
              <ExternalLink size={12} /> Open in Stripe
            </button>
          )}
        </div>

        {/* Digest */}
        <p className="font-inter" style={{ color: SUBTEXT, fontSize: 13.5, lineHeight: 1.55, maxWidth: 760, margin: '0 0 14px' }}>
          {digest}
        </p>

        {/* Metric strip */}
        <MetricStrip cells={[
          moneyCell,
          trialOrRenewal,
          {
            icon: Briefcase, iconBg: '#EDE4FF', iconColor: '#6F3FF5',
            label: 'Jobs', value: customer.jobs_total ?? 0, muted: (customer.jobs_total ?? 0) === 0,
            delta: customer.jobs_created_30d > 0 ? { text: `${customer.jobs_created_30d} this month`, tone: 'green' } : undefined,
          },
          {
            icon: Users, iconBg: '#D1FAE5', iconColor: '#12B886',
            label: 'Candidates', value: customer.candidates_total ?? 0,
            muted: (customer.candidates_total ?? 0) === 0,
            delta: customer.candidates_added_30d > 0 ? { text: `${customer.candidates_added_30d} this month`, tone: 'green' } : undefined,
          },
          {
            icon: UserCheck, iconBg: '#F1F0EC', iconColor: TEXT,
            label: 'Active members', value: customer.members_active_count ?? 0,
            muted: (customer.members_active_count ?? 0) === 0,
          },
        ]} />


        {/* Tabs */}
        <div className="flex items-center" style={{ gap: 6, margin: '14px 0' }}>
          <Pill active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</Pill>
          <Pill active={tab === 'members'} onClick={() => setTab('members')}>Members</Pill>
          <Pill active={tab === 'billing'} onClick={() => setTab('billing')}>Billing</Pill>
          <Pill active={tab === 'activity'} onClick={() => setTab('activity')}>Activity</Pill>
        </div>

        {tab === 'overview' && (
          <OverviewTab
            customer={customer}
            health={health}
            sub={sub}
            ownerName={ownerName}
            ownerEmail={ownerEmail}
            isTrialing={isTrialing}
            firstGroupKey={firstGroupKey}
            groupedFeed={groupedFeed}
            onExtend={() => setExtendOpen(true)}
            onGrant={() => setAssignOpen(true)}
            onChange={() => setChangeOpen(true)}
            onSuspend={() => setSuspendOpen(true)}
            onSwitchActivity={() => setTab('activity')}
          />
        )}

        {tab === 'members' && <MembersTab tenantId={customer.tenant_id} />}

        {tab === 'billing' && (
          <BillingTab
            customer={customer}
            sub={sub}
            creditUsage={creditUsage}
            creditPurchases={creditPurchases || []}
            seats={seats}
            interval={interval}
            isTrialing={isTrialing}
            trialEndIso={trialEndIso}
            trialStartIso={trialStartIso}
            daysLeftTrial={daysLeftTrial}
            onGrant={() => setAssignOpen(true)}
            onChange={() => setChangeOpen(true)}
            seatMutation={seatMutation}
          />
        )}

        {tab === 'activity' && (
          <ActivityTab
            feedFilter={feedFilter}
            setFeedFilter={setFeedFilter}
            groupedFeed={groupedFeed}
          />
        )}
      </div>

      {/* Dialogs */}
      <SuspendOrganizationDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        onConfirm={(reason) => { suspendMutation.mutate({ tenantId: customer.tenant_id, reason }); setSuspendOpen(false) }}
        organizationName={customer.name}
        isPending={suspendMutation.isPending}
      />
      <ExtendTrialDialog
        open={extendOpen}
        onOpenChange={setExtendOpen}
        onConfirm={(d) => { extendMutation.mutate({ tenantId: customer.tenant_id, newEndDate: d }); setExtendOpen(false) }}
        organizationName={customer.name}
        currentTrialEnd={trialEndIso ? new Date(trialEndIso) : null}
        isPending={extendMutation.isPending}
      />
      <ChangePlanDialog
        open={changeOpen}
        onOpenChange={setChangeOpen}
        onConfirm={(newInterval, newSeats) => { changeMutation.mutate({ tenantId: customer.tenant_id, newInterval, newSeats }); setChangeOpen(false) }}
        organizationName={customer.name}
        currentSeats={seats}
        currentInterval={interval || null}
        isPending={changeMutation.isPending}
      />
      <AssignCreditsDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onConfirm={(collectLimit, resetUsage) => {
          assignMutation.mutate({ tenantId: customer.tenant_id, collectCreditsLimit: collectLimit, resetUsage })
          setAssignOpen(false)
        }}
        tenantName={customer.name}
        currentCollectLimit={creditUsage?.collect_credits_limit}
        isPending={assignMutation.isPending}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// OVERVIEW TAB
// ─────────────────────────────────────────────────────────────────
function OverviewTab({
  customer, health, sub, ownerName, ownerEmail, isTrialing,
  firstGroupKey, groupedFeed,
  onExtend, onGrant, onChange, onSuspend, onSwitchActivity,
}: any) {
  const onboarding = useSaaSCustomerOnboarding(customer.tenant_id)
  const queryClient = useQueryClient()

  // ── Notes & touchpoints
  const { data: notes = [] } = useQuery({
    queryKey: ['tenant-notes', customer.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_notes')
        .select('id, body, created_at, author_id')
        .eq('tenant_id', customer.tenant_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      const ids = Array.from(new Set((data || []).map((n: any) => n.author_id)))
      let authors: Record<string, { first_name: string | null; last_name: string | null; email: string | null }> = {}
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', ids)
        ;(profs || []).forEach((p: any) => { authors[p.user_id] = p })
      }
      return (data || []).map((n: any) => ({ ...n, author: authors[n.author_id] }))
    },
    enabled: !!customer.tenant_id,
  })
  const [noteBody, setNoteBody] = useState('')
  const addNote = useMutation({
    mutationFn: async (body: string) => {
      const { data: u } = await supabase.auth.getUser()
      if (!u.user) throw new Error('Not authenticated')
      const { error } = await supabase.from('tenant_notes').insert({
        tenant_id: customer.tenant_id, author_id: u.user.id, body,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setNoteBody('')
      queryClient.invalidateQueries({ queryKey: ['tenant-notes', customer.tenant_id] })
    },
    onError: (e: Error) => toast.error('Failed to save note', { description: e.message }),
  })

  // ── Journey: interleave milestones + onboarding steps
  type MilestoneRow = { kind: 'milestone'; label: string; date: string | null; state: 'done' | 'next' | 'pending' }
  type StepRow = { kind: 'step'; label: string; completed: boolean }
  const journey: (MilestoneRow | StepRow)[] = []

  journey.push({
    kind: 'milestone',
    label: `Signed up · ${(customer.signup_source || 'self_serve').replace(/_/g, ' ')}`,
    date: customer.created_at, state: 'done',
  })
  if (sub?.trial_started_at)
    journey.push({ kind: 'milestone', label: 'Trial started', date: sub.trial_started_at, state: 'done' })

  if (isTrialing && !onboarding.isComplete) {
    onboarding.tasks.forEach(t => journey.push({ kind: 'step', label: t.title, completed: t.completed }))
  } else if (onboarding.isComplete) {
    journey.push({
      kind: 'milestone',
      label: `Getting started completed · ${onboarding.completedCount} of ${onboarding.totalCount} steps`,
      date: onboarding.completedAt || sub?.trial_started_at || customer.created_at,
      state: 'done',
    })
  }

  if (sub?.current_period_start && !isTrialing)
    journey.push({ kind: 'milestone', label: 'Converted to paid', date: sub.current_period_start, state: 'done' })
  if (customer.first_job_at)
    journey.push({ kind: 'milestone', label: 'First job created', date: customer.first_job_at, state: 'done' })
  if (isTrialing && sub?.trial_ends_at)
    journey.push({ kind: 'milestone', label: 'Trial ends', date: sub.trial_ends_at, state: 'next' })
  if (sub?.current_period_end_at && !isTrialing)
    journey.push({ kind: 'milestone', label: 'Renewal', date: sub.current_period_end_at, state: 'next' })

  const passing = health.reasons.filter((r: any) => r.passed).length
  const total = health.reasons.length

  return (
    <div className="grid gap-[14px]" style={{ gridTemplateColumns: 'minmax(0,1fr) 330px' }}>
      {/* LEFT */}
      <div>
        {/* Health signals */}
        <section style={CARD}>
          <CardHeader title="Health signals" desc="Derived from usage — recomputed daily."
            action={<Chip tone={passing === total ? 'green' : 'amber'}>{passing} of {total} healthy</Chip>} />
          <div>
            {health.reasons.map((r: any, i: number) => (
              <Row key={i} last={i === health.reasons.length - 1}>
                <div className="flex items-center justify-center shrink-0"
                  style={{ width: 22, height: 22, borderRadius: 999,
                           background: r.passed ? '#D1FAE5' : '#FEE2E2' }}>
                  {r.passed
                    ? <CheckCircle2 size={13} color="#0B7A57" strokeWidth={2.25} />
                    : <XCircle size={13} color="#DC2626" strokeWidth={2.25} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-inter" style={{ fontSize: 12.5, fontWeight: 600, color: NOIR }}>{r.label}</div>
                  <div className="font-inter" style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>
                    {HEALTH_WHY[r.label] || r.detail}
                  </div>
                </div>
              </Row>
            ))}
          </div>
          <div style={{ padding: 12 }}>
            {passing === total ? (
              <div className="font-inter" style={{ fontSize: 11, color: '#B5B9C4' }}>No recommendation — all signals healthy.</div>
            ) : (
              <div className="flex items-start gap-2"
                   style={{ background: '#F6F5F1', borderRadius: 9, padding: '10px 13px' }}>
                <Lightbulb size={14} color="#6F3FF5" style={{ marginTop: 1 }} />
                <div className="font-inter" style={{ fontSize: 11.5, color: SUBTEXT, lineHeight: 1.5 }}>
                  {health.recommendation}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Journey */}
        <section style={CARD}>
          <CardHeader
            title="Journey"
            desc="Milestones and getting-started steps, in order."
            action={isTrialing && !onboarding.isComplete
              ? <Chip tone="amber">{onboarding.completedCount} of {onboarding.totalCount} steps done</Chip>
              : undefined}
          />
          <div>
            {journey.map((it, i) => {
              const last = i === journey.length - 1
              if (it.kind === 'milestone') {
                return (
                  <Row key={i} last={last}
                       style={{ opacity: it.state === 'pending' ? 0.5 : 1 }}>
                    <span className="shrink-0"
                      style={{
                        width: 9, height: 9, borderRadius: 999,
                        background: it.state === 'done' ? '#D7C5FB' : it.state === 'next' ? NOIR : 'transparent',
                        border: it.state === 'pending' ? '1.5px solid #D2D4DC' : 'none',
                      }} />
                    <div className="flex-1 min-w-0 font-inter"
                         style={{ fontSize: 12.5, fontWeight: it.state === 'next' ? 600 : 500, color: NOIR }}>
                      {it.label}
                    </div>
                    {it.state === 'next' && <Chip tone="amber">upcoming</Chip>}
                    <span className="font-inter shrink-0" style={{ fontSize: 11, color: MUTED }}>
                      {it.date ? format(new Date(it.date), 'MMM d, yyyy') : '—'}
                    </span>
                  </Row>
                )
              }
              // Step row (indented)
              return (
                <div key={i} className="flex items-center gap-3"
                     style={{ padding: '8px 18px 8px 38px',
                              borderBottom: last ? 'none' : `1px solid ${HAIRLINE}`,
                              opacity: it.completed ? 0.55 : 1 }}>
                  <span className="shrink-0 flex items-center justify-center"
                    style={{
                      width: 16, height: 16, borderRadius: 999,
                      background: it.completed ? '#EDE4FF' : 'transparent',
                      border: it.completed ? 'none' : '1.5px solid #D2D4DC',
                    }}>
                    {it.completed && <Check size={10} color="#6F3FF5" strokeWidth={2.5} />}
                  </span>
                  <span className="font-inter flex-1"
                    style={{ fontSize: 12, fontWeight: 500, color: NOIR,
                             textDecoration: it.completed ? 'line-through' : 'none' }}>
                    {it.label}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Latest activity */}
        <section style={CARD}>
          <CardHeader title="Latest activity" desc="Most recent events in this workspace."
            action={
              <button onClick={onSwitchActivity}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer',
                               fontFamily: 'Inter', fontSize: 11.5, fontWeight: 500, color: '#6F3FF5' }}>
                View all →
              </button>
            } />
          <div>
            {!firstGroupKey ? (
              <div className="font-inter" style={{ padding: '24px 18px', color: MUTED, fontSize: 12, textAlign: 'center' }}>
                No recent activity.
              </div>
            ) : (
              <>
                <div className="font-inter uppercase" style={{ padding: '10px 18px', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', color: MUTED }}>
                  {firstGroupKey}
                </div>
                {groupedFeed[firstGroupKey].slice(0, 5).map((a: any, i: number, arr: any[]) => (
                  <FeedEventRow key={a.id} a={a} last={i === arr.length - 1} />
                ))}
              </>
            )}
          </div>
        </section>
      </div>

      {/* RIGHT */}
      <div>
        {/* Quick actions */}
        <section style={CARD}>
          <CardHeader title="Quick actions" />
          <div className="grid grid-cols-2 gap-2" style={{ padding: '12px 14px' }}>
            <QuickBtn
              icon={Mail}
              label="Email owner"
              onClick={() => {
                if (ownerEmail) window.location.href = `mailto:${ownerEmail}`
                else toast.error('No owner email on file')
              }}
            />
            <QuickBtn
              icon={Eye}
              label="View as tenant"
              onClick={() => toast("Impersonation isn't available yet.")}
            />
            {isTrialing ? (
              <QuickBtn icon={CalendarPlus} label="Extend trial" onClick={onExtend} />
            ) : (
              <QuickBtn icon={CreditCard} label="Change plan" onClick={onChange} />
            )}
            <QuickBtn icon={Sparkles} label="Grant credits" onClick={onGrant} />
          </div>
        </section>

        {/* Owner */}
        <section style={CARD}>
          <CardHeader title="Owner" />
          <div style={{ padding: '12px 14px' }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center shrink-0"
                style={{ width: 32, height: 32, borderRadius: 999, background: '#EDE4FF',
                         color: '#5B21B6', fontFamily: 'Inter', fontWeight: 600, fontSize: 11.5 }}>
                {initials(ownerName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-inter truncate" style={{ fontSize: 12.5, fontWeight: 600, color: NOIR }}>{ownerName}</div>
                <div className="font-inter truncate" style={{ fontSize: 11, color: MUTED }}>{ownerEmail || '—'}</div>
              </div>
              {ownerEmail && <CopyBtn value={ownerEmail} title="Copy email" />}
            </div>
            <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 10 }}>
              <Chip tone="gray">{(customer.organization_type || 'client').replace(/_/g, ' ')}</Chip>
              <Chip tone="gray">{(customer.signup_source || 'self_serve').replace(/_/g, ' ')}</Chip>
            </div>
          </div>
        </section>

        {/* Notes & touchpoints */}
        <section style={CARD}>
          <CardHeader title="Notes & touchpoints" desc="Internal — only platform admins see this." />
          <div style={{ padding: '12px 14px 4px' }}>
            <div className="flex items-center gap-2"
                 style={{ height: 34, borderRadius: 9, border: '1px solid #E7E8EE',
                          padding: '0 10px', background: '#FFFFFF' }}>
              <PencilLine size={12} color="#B5B9C4" />
              <input
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && noteBody.trim() && !addNote.isPending) {
                    e.preventDefault()
                    addNote.mutate(noteBody.trim())
                  }
                }}
                placeholder="Log a note or touchpoint…"
                className="font-inter flex-1 outline-none bg-transparent"
                style={{ fontSize: 11.5, color: TEXT }}
              />
            </div>
          </div>
          <div>
            {notes.length === 0 ? (
              <div className="font-inter" style={{ padding: '10px 18px 14px', fontSize: 11.5, color: '#B5B9C4' }}>
                No touchpoints yet — nobody has reached out to this account.
              </div>
            ) : notes.map((n: any, i: number) => {
              const a = n.author
              const authorName = a
                ? `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || 'Unknown'
                : 'Unknown'
              return (
                <div key={n.id}
                     style={{ padding: '10px 18px',
                              borderTop: `1px solid ${HAIRLINE}` }}>
                  <div className="font-inter flex items-baseline gap-1.5">
                    <span style={{ fontSize: 11, fontWeight: 600, color: TEXT }}>{authorName}</span>
                    <span style={{ fontSize: 10.5, color: '#B5B9C4' }}>· {timeAgoShort(n.created_at)}</span>
                  </div>
                  <div className="font-inter" style={{ fontSize: 11.5, color: SUBTEXT, lineHeight: 1.5, marginTop: 2 }}>
                    {n.body}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Danger zone */}
        <section style={CARD}>
          <CardHeader title="Danger zone" />
          <div className="flex items-center gap-3" style={{ padding: '12px 14px' }}>
            <span className="font-inter flex-1" style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
              Suspending blocks all members immediately. Data is kept.
            </span>
            <button
              type="button"
              onClick={onSuspend}
              className="font-inter inline-flex items-center justify-center gap-1.5"
              style={{
                height: 30, borderRadius: 9, fontSize: 11.5, fontWeight: 600,
                background: '#FFFFFF', border: '1px solid #FCA5A5',
                color: '#DC2626', cursor: 'pointer', padding: '0 12px',
              }}>
              <Ban size={12} color="#DC2626" />
              Suspend
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function QuickBtn({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="font-inter inline-flex items-center justify-center gap-1.5"
      style={{
        height: 34, borderRadius: 9, fontSize: 11.5, fontWeight: 600,
        background: '#FFFFFF', border: '1px solid #E7E8EE',
        color: NOIR, cursor: 'pointer',
      }}>
      <Icon size={12} color={NOIR} />
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────
// MEMBERS TAB
// ─────────────────────────────────────────────────────────────────
function MembersTab({ tenantId }: { tenantId: string }) {
  const { data: members = [], isLoading } = useSaaSCustomerMembers(tenantId)

  const roleChip = (role: string) => {
    const r = (role || '').toLowerCase()
    if (r === 'admin' || r === 'owner') return <Chip tone="blue">Admin</Chip>
    if (r === 'recruiter') return <Chip tone="purple">Recruiter</Chip>
    if (r === 'hiring_manager') return <Chip tone="amber">Hiring Manager</Chip>
    return <Chip tone="gray">{role}</Chip>
  }
  const memberState = (m: any): { tone: ChipTone; label: string } => {
    const s = (m.user_status || '').toLowerCase()
    const hasProfile = !!m.profile
    if (s === 'active') return { tone: 'green', label: 'Active' }
    if (s === 'invited' || (!hasProfile && (s === 'pending' || !s))) return { tone: 'amber', label: 'Invited' }
    if (s === 'deactivated' || s === 'inactive') return { tone: 'gray', label: 'Deactivated' }
    return { tone: 'gray', label: s || 'Inactive' }
  }

  const activeCount = members.filter((m: any) => (m.user_status || '').toLowerCase() === 'active').length
  const invitedCount = members.filter((m: any) => {
    const s = (m.user_status || '').toLowerCase()
    return s === 'invited' || (!m.profile && (s === 'pending' || !s))
  }).length

  return (
    <section style={CARD}>
      <CardHeader title="Team members" desc="Everyone in this workspace, with their last activity."
        action={
          <Chip tone="gray">
            {activeCount} active{invitedCount > 0 ? ` · ${invitedCount} invited` : ''}
          </Chip>
        } />
      <div>
        {isLoading ? (
          <div style={{ padding: 24, textAlign: 'center', color: MUTED, fontFamily: 'Inter', fontSize: 12 }}>Loading…</div>
        ) : members.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: MUTED, fontFamily: 'Inter', fontSize: 12 }}>No members yet.</div>
        ) : members.map((m, i) => {
          const name = m.profile
            ? `${m.profile.first_name || ''} ${m.profile.last_name || ''}`.trim() || m.profile.email || m.invited_email || 'Unknown'
            : m.invited_email || 'Pending invite'
          const email = m.profile?.email || m.invited_email || ''
          const state = memberState(m)
          const isInvited = state.label === 'Invited'
          const lastIso = m.updated_at
          const isNow = !isInvited && lastIso ? (Date.now() - new Date(lastIso).getTime()) < 5 * 60 * 1000 : false
          return (
            <Row key={m.id} last={i === members.length - 1}>
              <div className="flex items-center justify-center shrink-0"
                style={{ width: 28, height: 28, borderRadius: 999, background: '#EDE4FF',
                         color: '#5B21B6', fontFamily: 'Inter', fontWeight: 600, fontSize: 11 }}>
                {initials(name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-inter truncate" style={{ fontSize: 12.5, fontWeight: 600, color: NOIR }}>{name}</div>
                <div className="font-inter truncate" style={{ fontSize: 10.5, color: MUTED }}>{email}</div>
              </div>
              {roleChip(m.system_role)}
              <Chip tone={state.tone}>{state.label}</Chip>
              <span className="font-inter shrink-0"
                style={{ fontSize: 11, color: isNow ? '#0B7A57' : MUTED, fontWeight: isNow ? 600 : 400, minWidth: 90, textAlign: 'right' }}>
                {isInvited ? '—' : isNow ? 'now' : lastIso ? timeAgoShort(lastIso) : '—'}
              </span>
            </Row>
          )
        })}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────
// BILLING TAB
// ─────────────────────────────────────────────────────────────────
function BillingTab({
  customer, sub, creditUsage, creditPurchases, seats, interval, isTrialing,
  trialEndIso, trialStartIso, daysLeftTrial, onGrant, onChange, seatMutation,
}: any) {
  const pricePerSeat = interval === 'year' ? 49 : 5
  const total = seats * pricePerSeat
  const collectLimit = creditUsage?.collect_credits_limit ?? 0
  const bonusPurchased = sub?.bonus_credits_purchased || 0
  const bonusUsed = sub?.bonus_credits_used || 0
  const bonusAvail = bonusPurchased - bonusUsed
  const totalAvailable = (creditUsage?.collect_credits_limit || 0) - (creditUsage?.collect_credits_used || 0) + bonusAvail
  const totalPurchased = bonusPurchased
  const totalUsed = (creditUsage?.collect_credits_used || 0) + bonusUsed

  const [seatVal, setSeatVal] = useState(seats)
  useEffect(() => { setSeatVal(seats) }, [seats])

  const billingStatus = (sub?.billing_status || customer.status || 'active').toString()
  const statusChip = (() => {
    if (billingStatus === 'trialing' || billingStatus === 'pending_trial') return <Chip tone="blue">Trialing</Chip>
    if (billingStatus === 'past_due') return <Chip tone="amber">Past due</Chip>
    if (customer.status === 'suspended' || billingStatus === 'locked') return <Chip tone="gray">Locked</Chip>
    return <Chip tone="green">Active</Chip>
  })()

  // Stripe invoices
  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ['stripe-invoices', sub?.stripe_customer_id],
    queryFn: async () => {
      if (!sub?.stripe_customer_id) return []
      const { data, error } = await supabase.functions.invoke('get-stripe-invoices', {
        body: { customerId: sub.stripe_customer_id, limit: 10 },
      })
      if (error) throw error
      return (data?.invoices || []) as any[]
    },
    enabled: !!sub?.stripe_customer_id,
    staleTime: 5 * 60 * 1000,
  })

  const lvRow = (label: string, value: ReactNode, last?: boolean) => (
    <Row last={last}>
      <span className="font-inter" style={{ fontSize: 11.5, fontWeight: 600, color: NOIR, width: 170, flexShrink: 0 }}>{label}</span>
      <span className="font-inter flex-1" style={{ fontSize: 12, color: SUBTEXT }}>{value}</span>
    </Row>
  )

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Subscription */}
      <section style={CARD}>
        <CardHeader
          title="Subscription"
          desc={`${seats} seat${seats === 1 ? '' : 's'} × $${pricePerSeat}/${interval === 'year' ? 'yr' : 'mo'} = $${total}/${interval === 'year' ? 'year' : 'month'}`}
          action={statusChip}
        />
        <div>
          {lvRow('Plan', `Gio ATS · per-seat · ${interval === 'year' ? 'annual' : 'monthly'}`)}
          {isTrialing && trialEndIso && (
            <Row>
              <span className="font-inter" style={{ fontSize: 11.5, fontWeight: 600, color: NOIR, width: 170, flexShrink: 0 }}>Trial period</span>
              <span className="font-inter" style={{ fontSize: 12, color: SUBTEXT, marginRight: 8 }}>
                {trialStartIso ? format(new Date(trialStartIso), 'MMM d') : '—'} – {format(new Date(trialEndIso), 'MMM d, yyyy')}
              </span>
              {daysLeftTrial !== null && <Chip tone="amber">{Math.max(0, daysLeftTrial)} days left</Chip>}
            </Row>
          )}
          {lvRow('Current period',
            sub?.current_period_start && sub?.current_period_end_at
              ? `${format(new Date(sub.current_period_start), 'MMM d')} – ${format(new Date(sub.current_period_end_at), 'MMM d, yyyy')}`
              : '—')}
          {lvRow('Monthly credit pool',
            collectLimit > 0
              ? `${(collectLimit + bonusAvail).toLocaleString()} credits (${collectLimit.toLocaleString()} plan${bonusAvail > 0 ? ` + ${bonusAvail.toLocaleString()} bonus` : ''})`
              : 'Not configured',
            true)}
        </div>
      </section>

      {/* Credits */}
      <section style={CARD}>
        <CardHeader title="Credits" desc="Sourcing credit balance & purchases."
          action={<button style={SEC_BTN} onClick={onGrant}><Sparkles size={12} />Grant credits</button>} />
        <div className="flex" style={{ padding: '14px 0' }}>
          {[
            { label: 'Available balance', value: totalAvailable },
            { label: 'Total purchased', value: totalPurchased },
            { label: 'Total used', value: totalUsed },
          ].map((c, i) => (
            <div key={c.label} className="flex-1" style={{ padding: '0 18px', borderLeft: i > 0 ? `1px solid ${HAIRLINE}` : undefined }}>
              <div className="font-inter" style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>{c.label}</div>
              <div className="font-poppins tabular-nums" style={{ fontSize: 19, fontWeight: 600, color: c.value === 0 ? '#B5B9C4' : NOIR, marginTop: 2 }}>
                {c.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          {creditPurchases.length === 0 ? (
            <div className="font-inter" style={{ padding: '14px 18px', textAlign: 'center', color: MUTED, fontSize: 12 }}>
              No credit purchases yet.
            </div>
          ) : creditPurchases.map((p: any, i: number) => (
            <Row key={p.id} last={i === creditPurchases.length - 1}>
              <span className="font-inter flex-1" style={{ fontSize: 12.5, color: NOIR, fontWeight: 500 }}>
                {p.credits?.toLocaleString() || 0} credits
              </span>
              <span className="font-poppins tabular-nums" style={{ fontSize: 12.5, fontWeight: 600, color: NOIR }}>
                ${((p.amount_cents || p.amount || 0) / (p.amount_cents ? 100 : 1)).toFixed(2)}
              </span>
              <span className="font-inter" style={{ fontSize: 11, color: MUTED, minWidth: 90, textAlign: 'right' }}>
                {format(new Date(p.created_at), 'MMM d, yyyy')}
              </span>
            </Row>
          ))}
        </div>
      </section>

      {/* Seats */}
      <section style={CARD}>
        <CardHeader title="Seats" desc="Adjusting applies immediately and prorates billing." />
        <Row last>
          <div>
            <div className="font-inter" style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>Current seats</div>
            <div className="font-poppins tabular-nums" style={{ fontSize: 19, fontWeight: 600, color: NOIR, marginTop: 2 }}>{seats}</div>
          </div>
          <div style={{ width: 1, height: 32, background: HAIRLINE, margin: '0 18px' }} />
          <div className="flex-1">
            <div className="font-inter" style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>Maximum allowed</div>
            <div className="font-poppins tabular-nums" style={{ fontSize: 19, fontWeight: 600, color: sub?.max_users ? NOIR : '#B5B9C4', marginTop: 2 }}>
              {sub?.max_users || '—'}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              disabled={seatVal <= 1 || seatMutation.isPending}
              onClick={() => { const n = seatVal - 1; setSeatVal(n); seatMutation.mutate(n) }}
              style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E7E8EE', background: '#FFFFFF', cursor: seatVal <= 1 ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: NOIR }}>
              <Minus size={12} />
            </button>
            <div className="font-poppins tabular-nums" style={{ width: 40, height: 28, borderRadius: 8, border: '1px solid #E7E8EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: NOIR }}>
              {seatVal}
            </div>
            <button
              disabled={seatMutation.isPending}
              onClick={() => { const n = seatVal + 1; setSeatVal(n); seatMutation.mutate(n) }}
              style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E7E8EE', background: '#FFFFFF', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: NOIR }}>
              <Plus size={12} />
            </button>
          </div>
        </Row>
      </section>

      {/* Stripe */}
      <section style={CARD}>
        <CardHeader title="Stripe" desc="Managed in Stripe — Gio never stores card details."
          action={sub?.stripe_customer_id
            ? <button style={SEC_BTN} onClick={() => window.open(`https://dashboard.stripe.com/customers/${sub.stripe_customer_id}`, '_blank')}><ExternalLink size={12} />Open in Stripe</button>
            : undefined} />
        <Row>
          <span className="font-inter" style={{ fontSize: 11.5, fontWeight: 600, color: NOIR, width: 170, flexShrink: 0 }}>Customer ID</span>
          <span className="flex-1 inline-flex items-center gap-1.5" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: SUBTEXT }}>
            {sub?.stripe_customer_id || '—'}
            {sub?.stripe_customer_id && <CopyBtn value={sub.stripe_customer_id} />}
          </span>
        </Row>
        <Row last>
          <span className="font-inter" style={{ fontSize: 11.5, fontWeight: 600, color: NOIR, width: 170, flexShrink: 0 }}>Subscription ID</span>
          <span className="flex-1 inline-flex items-center gap-1.5" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: sub?.stripe_subscription_id ? SUBTEXT : '#B5B9C4' }}>
            {sub?.stripe_subscription_id || 'Not set — created on conversion'}
            {sub?.stripe_subscription_id && <CopyBtn value={sub.stripe_subscription_id} />}
          </span>
        </Row>
      </section>

      {/* Payment history */}
      <section style={CARD}>
        <CardHeader title="Payment history" desc="Invoices from Stripe." />
        <div>
          {invLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: MUTED, fontFamily: 'Inter', fontSize: 12 }}>Loading…</div>
          ) : invoices.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', color: MUTED, fontFamily: 'Inter', fontSize: 12 }}>No payments yet.</div>
          ) : invoices.map((inv, i) => {
            const amt = new Intl.NumberFormat('en-US', { style: 'currency', currency: (inv.currency || 'usd').toUpperCase() }).format((inv.amount || 0) / 100)
            return (
              <Row key={inv.id} last={i === invoices.length - 1}>
                <span className="font-inter flex-1 truncate" style={{ fontSize: 12.5, color: NOIR, fontWeight: 500 }}>
                  {`Invoice ${format(new Date((inv.period_start || inv.created) * 1000), 'MMM yyyy')}`}
                </span>
                <span className="font-poppins tabular-nums" style={{ fontSize: 12.5, fontWeight: 600, color: NOIR }}>{amt}</span>
                {inv.status === 'paid' ? <Chip tone="green">Paid</Chip> : <Chip tone="amber">{inv.status}</Chip>}
                <span className="font-inter" style={{ fontSize: 11, color: MUTED, minWidth: 90, textAlign: 'right' }}>
                  {format(new Date(inv.created * 1000), 'MMM d, yyyy')}
                </span>
                {inv.invoice_pdf
                  ? <a href={inv.invoice_pdf} target="_blank" rel="noreferrer" style={{ color: MUTED, lineHeight: 0 }}><Download size={13} /></a>
                  : <span style={{ width: 13 }} />}
              </Row>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// ACTIVITY TAB
// ─────────────────────────────────────────────────────────────────
function ActivityTab({
  feedFilter, setFeedFilter, groupedFeed,
}: { feedFilter: FeedFilter; setFeedFilter: (f: FeedFilter) => void; groupedFeed: Record<string, any[]> }) {
  const filters: { key: FeedFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'jobs', label: 'Jobs' },
    { key: 'candidates', label: 'Candidates' },
    { key: 'interviews', label: 'Interviews' },
    { key: 'documents', label: 'Documents' },
    { key: 'team', label: 'Team' },
    { key: 'platform', label: 'Platform' },
  ]
  const groupKeys = Object.keys(groupedFeed)
  return (
    <div>
      <div className="flex items-center" style={{ gap: 6, marginBottom: 14 }}>
        {filters.map(f => (
          <Pill key={f.key} active={feedFilter === f.key} onClick={() => setFeedFilter(f.key)}>{f.label}</Pill>
        ))}
      </div>
      <section style={CARD}>
        <CardHeader title="Activity" desc="Everything that happened in this workspace, most recent first." />
        <div>
          {groupKeys.length === 0 ? (
            <div className="font-inter" style={{ padding: '24px 18px', textAlign: 'center', color: MUTED, fontSize: 12 }}>
              No {feedFilter === 'all' ? '' : feedFilter} activity.
            </div>
          ) : groupKeys.map((key, gi) => (
            <div key={key}>
              <div className="font-inter uppercase"
                   style={{ padding: '10px 18px 6px', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', color: MUTED,
                            borderTop: gi > 0 ? `1px solid ${HAIRLINE}` : undefined }}>
                {key}
              </div>
              {groupedFeed[key].map((a: any, i: number, arr: any[]) => (
                <FeedEventRow key={a.id} a={a} last={gi === groupKeys.length - 1 && i === arr.length - 1} />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function FeedEventRow({ a, last }: { a: any; last?: boolean }) {
  const cat = feedCategory(a.activity_type)
  const override = stageIconOverride(a.activity_type)
  const meta = override || FEED_ICON_MAP[cat]
  const Icon = meta.icon
  return (
    <Row last={last}>
      <div className="flex items-center justify-center shrink-0"
        style={{ width: 26, height: 26, borderRadius: 8, background: meta.bg }}>
        <Icon size={13} color={meta.fg} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-inter truncate" style={{ fontSize: 12, fontWeight: 600, color: NOIR }}>{a.title}</div>
        {a.description && (
          <div className="font-inter truncate" style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{a.description}</div>
        )}
      </div>
      <span className="font-inter shrink-0" style={{ fontSize: 10.5, color: '#B5B9C4' }}>
        {timeAgoShort(a.created_at)}
      </span>
    </Row>
  )
}
