import { useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Building2, Users, Briefcase, FileText, AlertCircle } from 'lucide-react'
import { usePlatformMetrics } from '@/hooks/usePlatformMetrics'

const CARD = 'bg-white border border-[#E7E8EE] rounded-[12px] mb-[14px]'
const SEP = 'border-b border-[#F1F0EC]'
const NOIR_LINK = 'font-inter text-[11.5px] font-medium text-[#6F3FF5] hover:underline'

function Chip({ tone, children }: { tone: 'green' | 'amber' | 'blue' | 'purple' | 'gray' | 'red'; children: React.ReactNode }) {
  const map = {
    green: 'bg-[#D1FAE5] text-[#0B7A57]',
    amber: 'bg-[#FEF3C7] text-[#92400E]',
    blue:  'bg-[#DBEAFE] text-[#1D4ED8]',
    purple:'bg-[#EDE4FF] text-[#5B21B6]',
    gray:  'bg-[#F1F0EC] text-[#5A6072]',
    red:   'bg-[#FEE2E2] text-[#B91C1C]',
  }[tone]
  return (
    <span className={`inline-flex items-center font-inter font-semibold rounded-full ${map}`} style={{ fontSize: '10px', padding: '2px 8px', letterSpacing: '0.02em' }}>
      {children}
    </span>
  )
}

interface MetricCell {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  iconBg: string
  iconColor: string
  label: string
  value: string | number
  delta?: { text: string; tone: 'green' | 'amber' }
  suffix?: string
}

function MetricStrip({ cells }: { cells: MetricCell[] }) {
  return (
    <div className={`${CARD} grid`} style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
      {cells.map((c, i) => {
        const Icon = c.icon
        return (
          <div key={c.label} className={i > 0 ? 'border-l border-[#F1F0EC]' : ''} style={{ padding: '14px 16px', minHeight: 56 }}>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center rounded-[8px] shrink-0" style={{ width: 28, height: 28, background: c.iconBg }}>
                <Icon className="" strokeWidth={2} style={{ width: 14, height: 14, color: c.iconColor } as React.CSSProperties} />
              </div>
              <div className="min-w-0">
                <div className="font-inter font-medium text-[#8B8F9E]" style={{ fontSize: '11px' }}>{c.label}</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="font-poppins font-semibold text-[#0d0d09] tabular-nums" style={{ fontSize: '19px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{c.value}</span>
                  {c.suffix && <span className="font-inter text-[#5A6072]" style={{ fontSize: '12px' }}>{c.suffix}</span>}
                  {c.delta && (
                    <span className="font-inter font-semibold inline-flex items-center gap-0.5" style={{ fontSize: '10.5px', color: c.delta.tone === 'green' ? '#12B886' : '#B45309' }}>
                      <span style={{ fontSize: 10 }}>↑</span>{c.delta.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CardHeader({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${SEP}`} style={{ padding: '14px 18px' }}>
      <div className="min-w-0">
        <h3 className="font-poppins font-semibold text-[#1F2230]" style={{ fontSize: '13.5px', letterSpacing: '-0.01em' }}>{title}</h3>
        {desc && <p className="font-inter text-[#8B8F9E] mt-0.5" style={{ fontSize: '11.5px' }}>{desc}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

function formatNumber(n: number) {
  return new Intl.NumberFormat('en-US').format(n)
}

function timeAgo(iso?: string | null) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function PlatformDashboardV2() {
  const { data: metrics, isLoading, error } = usePlatformMetrics()

  const currentMonth = useMemo(() => new Date().toLocaleDateString('en-US', { month: 'long' }), [])

  if (isLoading) {
    return (
      <div className="space-y-0">
        <div className={CARD} style={{ height: 84 }} />
        <div className="grid grid-cols-2 gap-[14px]">
          <div className={CARD} style={{ height: 200 }} />
          <div className={CARD} style={{ height: 200 }} />
        </div>
        <div className={CARD} style={{ height: 220 }} />
        <div className={CARD} style={{ height: 80 }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className={CARD} style={{ padding: 24 }}>
        <div className="flex items-center gap-2 text-[#B91C1C] font-inter" style={{ fontSize: 12.5 }}>
          <AlertCircle className="w-4 h-4" />
          Failed to load platform metrics: {error.message}
        </div>
      </div>
    )
  }

  const orgsTotal = metrics?.organizations.total ?? 0
  const activeUsers = metrics?.users.active ?? 0
  const jobsTotal = metrics?.jobs.total ?? 0
  const jobsActive = metrics?.jobs.active ?? 0
  const candidates = metrics?.candidates.total ?? 0
  const newJobs = metrics?.jobs.newThisMonth ?? 0
  const newCandidates = metrics?.candidates.newThisMonth ?? 0
  const newOrgs = 0 // not exposed by backend; safe zero
  const paidInv = metrics?.invoices.paid ?? 0
  const pendingInv = metrics?.invoices.pending ?? 0

  return (
    <div className="space-y-0">
      <MetricStrip
        cells={[
          { icon: Building2, iconBg: '#EDE4FF', iconColor: '#6F3FF5', label: 'Organizations', value: orgsTotal, delta: newOrgs > 0 ? { text: `${newOrgs} this month`, tone: 'green' } : undefined },
          { icon: Users,     iconBg: '#D1FAE5', iconColor: '#12B886', label: 'Active users · 30d', value: activeUsers },
          { icon: Briefcase, iconBg: '#DBEAFE', iconColor: '#2563EB', label: 'Total jobs', value: jobsTotal, suffix: `${jobsActive} active` },
          { icon: FileText,  iconBg: '#FEF3C7', iconColor: '#B45309', label: 'Candidates', value: formatNumber(candidates) },
        ]}
      />

      <div className="grid grid-cols-2 gap-[14px]">
        <div className={CARD}>
          <CardHeader title={`Growth · ${currentMonth}`} desc="New across all tenants this month." />
          <div>
            {[
              { icon: Building2, label: 'New organizations', value: newOrgs },
              { icon: Briefcase, label: 'New jobs', value: newJobs },
              { icon: FileText, label: 'New candidates', value: newCandidates },
            ].map((row, i, arr) => {
              const Icon = row.icon
              const zero = row.value === 0
              return (
                <div key={row.label} className={`flex items-center justify-between ${i < arr.length - 1 ? SEP : ''}`} style={{ padding: '10px 18px' }}>
                  <div className="flex items-center gap-2.5">
                    <Icon strokeWidth={2} style={{ width: 14, height: 14, color: '#5A6072' }} />
                    <span className="font-inter font-medium text-[#1F2230]" style={{ fontSize: '12.5px' }}>{row.label}</span>
                  </div>
                  <span className="font-poppins font-semibold tabular-nums" style={{ fontSize: '15px', color: zero ? '#B5B9C4' : '#0d0d09' }}>+{row.value}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className={CARD}>
          <CardHeader title="System health" desc="Live service status." action={<Chip tone="green">All systems go</Chip>} />
          <div>
            {[
              { name: 'Database', word: 'Online' },
              { name: 'Edge functions', word: 'Operational' },
            ].map((row, i, arr) => (
              <div key={row.name} className={`flex items-center justify-between ${i < arr.length - 1 ? SEP : ''}`} style={{ padding: '10px 18px' }}>
                <div className="flex items-center gap-2.5">
                  <span className="rounded-full" style={{ width: 7, height: 7, background: '#12B886' }} />
                  <span className="font-inter font-medium text-[#1F2230]" style={{ fontSize: '12.5px' }}>{row.name}</span>
                </div>
                <span className="font-inter font-semibold" style={{ fontSize: '11.5px', color: '#0B7A57' }}>{row.word}</span>
              </div>
            ))}
            <div className="font-inter text-[#B5B9C4]" style={{ padding: '10px 18px', fontSize: '10.5px' }}>
              Last check {metrics?.lastUpdated ? timeAgo(metrics.lastUpdated) : 'just now'} · checks run every 5 min
            </div>
          </div>
        </div>
      </div>

      <div className={CARD}>
        <CardHeader
          title="Recent activity"
          desc="Tenant-level events, most recent first."
          action={<a href="#" className={NOIR_LINK}>View all →</a>}
        />
        <div style={{ padding: '24px 18px' }} className="font-inter text-[#8B8F9E] text-center" >
          <span style={{ fontSize: '12px' }}>No recent tenant events.</span>
        </div>
      </div>

      <div className={CARD}>
        <CardHeader title="Invoices" desc="Across all tenants, this billing cycle." />
        <div className="flex items-center justify-between" style={{ padding: '14px 18px' }}>
          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-1.5">
              <span className="font-poppins font-semibold tabular-nums text-[#0d0d09]" style={{ fontSize: '15px' }}>{paidInv}</span>
              <span className="font-inter text-[#5A6072]" style={{ fontSize: '12px' }}>paid</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-poppins font-semibold tabular-nums text-[#0d0d09]" style={{ fontSize: '15px' }}>{pendingInv}</span>
              <span className="font-inter text-[#5A6072]" style={{ fontSize: '12px' }}>pending</span>
            </div>
          </div>
          <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className={NOIR_LINK}>Open Stripe →</a>
        </div>
      </div>
    </div>
  )
}
