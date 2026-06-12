import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Users, Clock, AlertTriangle, Briefcase, Activity,
  Search, ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useSaaSCustomers, type SaaSCustomer } from '@/hooks/useSaaSCustomers'
import { supabase } from '@/lib/supabaseClient'
import { formatDistanceToNowStrict } from 'date-fns'

const CARD = 'bg-white border border-[#E7E8EE] rounded-[12px] mb-[14px]'

interface MetricCell {
  icon: LucideIcon
  iconBg: string
  iconColor: string
  label: string
  value: string | number
  delta?: { text: string; tone: 'green' | 'amber' }
  annotation?: string
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
                <Icon strokeWidth={2} style={{ width: 14, height: 14, color: c.iconColor }} />
              </div>
              <div className="min-w-0">
                <div className="font-inter font-medium text-[#8B8F9E]" style={{ fontSize: '11px' }}>{c.label}</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="font-poppins font-semibold text-[#0d0d09] tabular-nums" style={{ fontSize: '19px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{c.value}</span>
                  {c.delta && (
                    <span className="font-inter font-semibold inline-flex items-center gap-0.5" style={{ fontSize: '10.5px', color: c.delta.tone === 'green' ? '#12B886' : '#B45309' }}>
                      <span style={{ fontSize: 10 }}>↑</span>{c.delta.text}
                    </span>
                  )}
                  {c.annotation && (
                    <span className="font-inter" style={{ fontSize: '10.5px', color: '#B45309' }}>{c.annotation}</span>
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

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-inter font-medium transition-colors"
      style={{
        height: 28,
        padding: '0 12px',
        borderRadius: 999,
        fontSize: '11.5px',
        background: active ? '#0d0d09' : '#FFFFFF',
        color: active ? '#fffcf9' : '#1F2230',
        border: active ? '1px solid #0d0d09' : '1px solid #E7E8EE',
      }}
    >
      {children}
    </button>
  )
}

function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase()
  let tone: { bg: string; fg: string; label: string }
  if (s === 'trialing') tone = { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Trialing' }
  else if (s === 'active') tone = { bg: '#D1FAE5', fg: '#0B7A57', label: 'Active' }
  else if (s === 'locked' || s === 'suspended') tone = { bg: '#F1F0EC', fg: '#5A6072', label: 'Locked' }
  else if (s === 'past_due') tone = { bg: '#FEF3C7', fg: '#92400E', label: 'Past due' }
  else tone = { bg: '#F1F0EC', fg: '#5A6072', label: status }
  return (
    <span className="inline-flex items-center font-inter font-semibold rounded-full" style={{ fontSize: '10px', padding: '2px 8px', background: tone.bg, color: tone.fg }}>
      {tone.label}
    </span>
  )
}

function ChurnIndicator({ risk }: { risk: string }) {
  const r = (risk || '').toLowerCase()
  if (r === 'high' || r === 'critical') {
    return (
      <span className="inline-flex items-center gap-1.5 font-inter font-semibold" style={{ fontSize: '11px', color: '#DC2626' }}>
        <span className="rounded-full" style={{ width: 6, height: 6, background: '#DC2626' }} /> High
      </span>
    )
  }
  if (r === 'at_risk' || r === 'warning' || r === 'medium') {
    return (
      <span className="inline-flex items-center gap-1.5 font-inter font-semibold" style={{ fontSize: '11px', color: '#B45309' }}>
        <span className="rounded-full" style={{ width: 6, height: 6, background: '#F59E0B' }} /> At risk
      </span>
    )
  }
  return <span className="font-inter" style={{ fontSize: '11px', color: '#B5B9C4' }}>—</span>
}

function initials(name: string) {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

const GRID_COLS = 'minmax(0,1.4fr) minmax(0,1.1fr) 70px 76px 86px 130px 64px 26px'

interface OwnerInfo { id: string; name: string; email: string }

function useOwnerProfiles(ownerIds: string[]) {
  const [map, setMap] = useState<Record<string, OwnerInfo>>({})
  useEffect(() => {
    if (ownerIds.length === 0) return
    const missing = ownerIds.filter(id => id && !map[id])
    if (missing.length === 0) return
    let cancelled = false
    ;(async () => {
      const { data } = await (supabase as any)
        .from('profiles')
        .select('id, full_name, email')
        .in('id', missing)
      if (cancelled || !data) return
      setMap(prev => {
        const next = { ...prev }
        data.forEach((p: any) => {
          next[p.id] = { id: p.id, name: p.full_name || p.email || 'Unknown', email: p.email || '' }
        })
        return next
      })
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerIds.join('|')])
  return map
}

type FilterKey = 'all' | 'trialing' | 'active' | 'locked' | 'risk'

export function PlatformCustomers() {
  const navigate = useNavigate()
  const { data: customers = [], isLoading } = useSaaSCustomers()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  const ownerIds = useMemo(() => customers.map(c => c.owner_id).filter((x): x is string => !!x), [customers])
  const ownerMap = useOwnerProfiles(ownerIds)

  const metrics = useMemo(() => {
    const total = customers.length
    const trialing = customers.filter(c => c.status === 'trialing').length
    const active = customers.filter(c => c.status === 'active').length
    const risk = customers.filter(c => ['high', 'critical', 'at_risk', 'warning', 'medium'].includes((c.churn_risk || '').toLowerCase())).length
    const lockedLong = customers.filter(c => c.status === 'locked').length
    const newThisMonth = customers.filter(c => {
      const d = new Date(c.created_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
    return { total, trialing, active, risk, lockedLong, newThisMonth }
  }, [customers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter(c => {
      if (filter === 'trialing' && c.status !== 'trialing') return false
      if (filter === 'active' && c.status !== 'active') return false
      if (filter === 'locked' && c.status !== 'locked') return false
      if (filter === 'risk') {
        const r = (c.churn_risk || '').toLowerCase()
        if (!['high', 'critical', 'at_risk', 'warning', 'medium'].includes(r)) return false
      }
      if (!q) return true
      const owner = c.owner_id ? ownerMap[c.owner_id] : null
      return (
        c.name.toLowerCase().includes(q) ||
        owner?.name.toLowerCase().includes(q) ||
        owner?.email.toLowerCase().includes(q)
      )
    })
  }, [customers, filter, search, ownerMap])

  const rowClick = (c: SaaSCustomer) => navigate(`/settings/platform/saas-customers/${c.id}`)

  return (
    <div className="space-y-0">
      <MetricStrip
        cells={[
          { icon: Building2, iconBg: '#EDE4FF', iconColor: '#6F3FF5', label: 'Tenants', value: metrics.total, delta: metrics.newThisMonth > 0 ? { text: `${metrics.newThisMonth} this month`, tone: 'green' } : undefined },
          { icon: Clock,     iconBg: '#DBEAFE', iconColor: '#2563EB', label: 'Trialing', value: metrics.trialing },
          { icon: Users,     iconBg: '#D1FAE5', iconColor: '#12B886', label: 'Active', value: metrics.active },
          { icon: AlertTriangle, iconBg: '#FEF3C7', iconColor: '#B45309', label: 'At churn risk', value: metrics.risk, annotation: metrics.lockedLong > 0 ? `${metrics.lockedLong} locked >30d` : undefined },
        ]}
      />

      <div className="flex items-center gap-2 mb-[14px]">
        {([
          ['all', 'All'], ['trialing', 'Trialing'], ['active', 'Active'], ['locked', 'Locked'], ['risk', 'At risk'],
        ] as [FilterKey, string][]).map(([k, label]) => (
          <Pill key={k} active={filter === k} onClick={() => setFilter(k)}>{label}</Pill>
        ))}
      </div>

      <div className={CARD}>
        <div className="flex items-start justify-between gap-4 border-b border-[#F1F0EC]" style={{ padding: '14px 18px' }}>
          <div className="min-w-0">
            <h3 className="font-poppins font-semibold text-[#1F2230]" style={{ fontSize: '13.5px', letterSpacing: '-0.01em' }}>SaaS customers</h3>
            <p className="font-inter text-[#8B8F9E] mt-0.5" style={{ fontSize: '11.5px' }}>Every tenant on the platform. Click a row to open the customer profile.</p>
          </div>
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2" strokeWidth={2} style={{ width: 13, height: 13, color: '#8B8F9E' }} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenants…"
              className="font-inter outline-none focus:ring-2 focus:ring-virgilio-purple/30"
              style={{ height: 30, paddingLeft: 28, paddingRight: 10, fontSize: '12px', background: '#F6F5F1', borderRadius: 8, border: '1px solid transparent', width: 220 }}
            />
          </div>
        </div>

        {/* Column header */}
        <div
          className="grid items-center font-inter font-semibold uppercase text-[#8B8F9E] border-b border-[#F1F0EC]"
          style={{ gridTemplateColumns: GRID_COLS, gap: 8, padding: '8px 18px', fontSize: '10px', letterSpacing: '0.07em' }}
        >
          <div>Customer</div>
          <div>Owner</div>
          <div>Plan</div>
          <div>Status</div>
          <div>Churn</div>
          <div>Usage · 30d</div>
          <div>Last active</div>
          <div />
        </div>

        {isLoading && (
          <div className="font-inter text-[#8B8F9E] text-center" style={{ padding: '24px', fontSize: '12px' }}>Loading tenants…</div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="font-inter text-[#8B8F9E] text-center" style={{ padding: '24px', fontSize: '12px' }}>No tenants match these filters.</div>
        )}

        {!isLoading && filtered.map((c, i, arr) => {
          const owner = c.owner_id ? ownerMap[c.owner_id] : null
          const lastActive = c.last_active_at ? new Date(c.last_active_at) : null
          const isNow = lastActive && (Date.now() - lastActive.getTime() < 5 * 60 * 1000)
          return (
            <div
              key={c.id}
              role="button"
              onClick={() => rowClick(c)}
              className={`grid items-center cursor-pointer hover:bg-[#FAFAF7] transition-colors ${i < arr.length - 1 ? 'border-b border-[#F1F0EC]' : ''}`}
              style={{ gridTemplateColumns: GRID_COLS, gap: 8, padding: '10px 18px' }}
            >
              {/* Customer */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex items-center justify-center rounded-full shrink-0 font-poppins font-semibold text-[#5B21B6]" style={{ width: 26, height: 26, background: '#EDE4FF', fontSize: '10.5px' }}>
                  {initials(c.name)}
                </div>
                <div className="min-w-0">
                  <div className="font-inter font-semibold text-[#1F2230] truncate" style={{ fontSize: '12.5px' }}>{c.name}</div>
                  <div className="font-inter text-[#B5B9C4]" style={{ fontSize: '10px' }}>since {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
                </div>
              </div>
              {/* Owner */}
              <div className="min-w-0">
                {owner ? (
                  <>
                    <div className="font-inter font-medium text-[#1F2230] truncate" style={{ fontSize: '11.5px' }}>{owner.name}</div>
                    <div className="font-inter text-[#8B8F9E] truncate" style={{ fontSize: '10px' }}>{owner.email}</div>
                  </>
                ) : (
                  <span className="font-inter text-[#B5B9C4]" style={{ fontSize: '11px' }}>—</span>
                )}
              </div>
              {/* Plan */}
              <div className="font-inter text-[#5A6072]" style={{ fontSize: '11px' }}>{c.seat_quantity || 1} seat{(c.seat_quantity || 1) !== 1 ? 's' : ''}</div>
              {/* Status */}
              <div><StatusChip status={c.status} /></div>
              {/* Churn */}
              <div><ChurnIndicator risk={c.churn_risk} /></div>
              {/* Usage */}
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1 font-inter text-[#5A6072]" style={{ fontSize: '10.5px' }}>
                  <Briefcase strokeWidth={2} style={{ width: 10, height: 10, color: '#8B8F9E' }} /> {c.jobs_created_30d}
                </span>
                <span className="inline-flex items-center gap-1 font-inter text-[#5A6072]" style={{ fontSize: '10.5px' }}>
                  <Users strokeWidth={2} style={{ width: 10, height: 10, color: '#8B8F9E' }} /> {c.members_active_count}
                </span>
                <span className="inline-flex items-center gap-1 font-inter text-[#5A6072]" style={{ fontSize: '10.5px' }}>
                  <Activity strokeWidth={2} style={{ width: 10, height: 10, color: '#8B8F9E' }} /> {c.candidates_added_30d}
                </span>
              </div>
              {/* Last active */}
              <div className="font-inter" style={{ fontSize: '11px', color: isNow ? '#0B7A57' : '#8B8F9E', fontWeight: isNow ? 600 : 400 }}>
                {isNow ? 'now' : lastActive ? formatDistanceToNowStrict(lastActive, { addSuffix: false }) + ' ago' : '—'}
              </div>
              {/* Chevron */}
              <div className="flex justify-end"><ChevronRight strokeWidth={2} style={{ width: 13, height: 13, color: '#B5B9C4' }} /></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
