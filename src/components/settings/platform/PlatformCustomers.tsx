import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Users, Clock, AlertTriangle, Briefcase, Activity,
  Search, ChevronRight, Info,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useSaaSCustomers, type SaaSCustomer } from '@/hooks/useSaaSCustomers'
import { supabase } from '@/lib/supabaseClient'
import { formatDistanceToNowStrict } from 'date-fns'
import { SpecCard } from '../shared/SpecCard'
import { SpecChip } from '../shared/SpecChip'

// ─── MetricStrip (icon variant) ───
interface MetricCell {
  icon: LucideIcon
  iconBg: string
  iconColor: string
  label: string
  value: string | number
  delta?: string
  annotation?: string
}

function MetricStrip({ cells }: { cells: MetricCell[] }) {
  return (
    <section
      className="bg-white rounded-[12px] overflow-hidden mb-[14px] flex"
      style={{ border: '1px solid #E7E8EE' }}
    >
      {cells.map((c, i) => {
        const Icon = c.icon
        return (
          <div
            key={c.label}
            className="flex items-center gap-2.5"
            style={{
              flex: 1,
              padding: '12px 16px',
              borderLeft: i > 0 ? '1px solid #F1F0EC' : undefined,
              minHeight: 56,
            }}
          >
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: 28, height: 28, borderRadius: 8, background: c.iconBg }}
            >
              <Icon size={14} color={c.iconColor} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="font-inter" style={{ fontSize: 11, fontWeight: 500, color: '#8B8F9E' }}>{c.label}</div>
              <div className="flex items-baseline gap-2" style={{ marginTop: 2 }}>
                <span className="font-poppins tabular-nums" style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.03em', color: '#0d0d09', lineHeight: 1.1 }}>{c.value}</span>
                {c.delta && (
                  <span className="font-inter" style={{ fontSize: 10.5, fontWeight: 600, color: '#12B886' }}>↑ {c.delta}</span>
                )}
                {c.annotation && (
                  <span className="font-inter" style={{ fontSize: 10.5, color: '#B45309' }}>{c.annotation}</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )
}

// ─── Filter pill ───
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-inter transition-colors"
      style={{
        height: 28,
        padding: '0 12px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        background: active ? '#0d0d09' : '#FFFFFF',
        color: active ? '#fffcf9' : '#1F2230',
        border: active ? '1px solid #0d0d09' : '1px solid #E7E8EE',
      }}
    >
      {children}
    </button>
  )
}

// ─── Status chip helpers ───
function statusToChip(status: string) {
  const s = (status || '').toLowerCase()
  if (s === 'trialing') return <SpecChip tone="blue">Trialing</SpecChip>
  if (s === 'active') return <SpecChip tone="green">Active</SpecChip>
  if (s === 'locked' || s === 'suspended') return <SpecChip tone="gray">Locked</SpecChip>
  if (s === 'past_due') return <SpecChip tone="amber">Past due</SpecChip>
  return <SpecChip tone="gray">{status}</SpecChip>
}

function ChurnIndicator({ risk }: { risk: string }) {
  const r = (risk || '').toLowerCase()
  const dot = (color: string) => (
    <span style={{ width: 6, height: 6, borderRadius: 999, background: color, display: 'inline-block', flexShrink: 0 }} />
  )
  if (r === 'high' || r === 'critical') {
    return (
      <span className="inline-flex items-center gap-1.5 font-inter" style={{ fontSize: 11, fontWeight: 600, color: '#DC2626' }}>
        {dot('#DC2626')} High
      </span>
    )
  }
  if (r === 'at_risk' || r === 'warning' || r === 'medium') {
    return (
      <span className="inline-flex items-center gap-1.5 font-inter" style={{ fontSize: 11, fontWeight: 600, color: '#B45309' }}>
        {dot('#F59E0B')} At risk
      </span>
    )
  }
  return <span className="font-inter" style={{ fontSize: 11, color: '#B5B9C4' }}>—</span>
}

function initials(name: string) {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

// ─── Owner profile loader (no extra schema needed) ───
interface OwnerInfo { id: string; name: string; email: string }
function useOwnerProfiles(ownerIds: string[]) {
  const [map, setMap] = useState<Record<string, OwnerInfo>>({})
  const key = ownerIds.filter(Boolean).sort().join('|')
  useEffect(() => {
    const ids = key ? key.split('|') : []
    if (ids.length === 0) return
    let cancelled = false
    ;(async () => {
      const { data } = await (supabase as any)
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids)
      if (cancelled || !data) return
      const next: Record<string, OwnerInfo> = {}
      data.forEach((p: any) => {
        next[p.id] = { id: p.id, name: p.full_name || p.email || 'Unknown', email: p.email || '' }
      })
      setMap(next)
    })()
    return () => { cancelled = true }
  }, [key])
  return map
}

const GRID =
  'minmax(0,1.4fr) minmax(0,1.1fr) 70px 76px 76px 110px 64px 26px'

type FilterKey = 'all' | 'trialing' | 'active' | 'locked' | 'risk'
const RISK_VALUES = new Set(['high', 'critical', 'at_risk', 'warning', 'medium'])

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
    const risk = customers.filter(c => RISK_VALUES.has((c.churn_risk || '').toLowerCase())).length
    const now = new Date()
    const newThisMonth = customers.filter(c => {
      const d = new Date(c.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
    const lockedLong = customers.filter(c => {
      if (c.status !== 'locked') return false
      const updated = new Date(c.updated_at || c.created_at)
      return (Date.now() - updated.getTime()) > 30 * 24 * 60 * 60 * 1000
    }).length
    return { total, trialing, active, risk, newThisMonth, lockedLong }
  }, [customers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter(c => {
      if (filter === 'trialing' && c.status !== 'trialing') return false
      if (filter === 'active' && c.status !== 'active') return false
      if (filter === 'locked' && c.status !== 'locked' && c.status !== 'suspended') return false
      if (filter === 'risk' && !RISK_VALUES.has((c.churn_risk || '').toLowerCase())) return false
      if (!q) return true
      const owner = c.owner_id ? ownerMap[c.owner_id] : null
      return (
        c.name.toLowerCase().includes(q) ||
        (owner?.name.toLowerCase().includes(q) ?? false) ||
        (owner?.email.toLowerCase().includes(q) ?? false)
      )
    })
  }, [customers, filter, search, ownerMap])

  const rowClick = (c: SaaSCustomer) => navigate(`/settings/platform/saas-customers/${c.id}`)

  const headerCols: string[] = ['Customer', 'Owner', 'Plan', 'Status', 'Churn', 'Usage · 30d', 'Last active', '']

  return (
    <div className="max-w-[860px]">
      {/* 3a · MetricStrip */}
      <MetricStrip
        cells={[
          {
            icon: Building2, iconBg: '#EDE4FF', iconColor: '#6F3FF5',
            label: 'Tenants', value: metrics.total,
            delta: metrics.newThisMonth > 0 ? `${metrics.newThisMonth} this month` : undefined,
          },
          { icon: Clock,     iconBg: '#DBEAFE', iconColor: '#2563EB', label: 'Trialing', value: metrics.trialing },
          { icon: Users,     iconBg: '#D1FAE5', iconColor: '#12B886', label: 'Active',   value: metrics.active },
          {
            icon: AlertTriangle, iconBg: '#FEF3C7', iconColor: '#B45309',
            label: 'At churn risk', value: metrics.risk,
            annotation: metrics.lockedLong > 0 ? `${metrics.lockedLong} locked >30d` : undefined,
          },
        ]}
      />

      {/* 3b · Filter pills */}
      <div className="flex items-center mb-[14px]" style={{ gap: 6 }}>
        {([
          ['all', 'All'], ['trialing', 'Trialing'], ['active', 'Active'], ['locked', 'Locked'], ['risk', 'At risk'],
        ] as [FilterKey, string][]).map(([k, label]) => (
          <Pill key={k} active={filter === k} onClick={() => setFilter(k)}>{label}</Pill>
        ))}
      </div>

      {/* 3c · Table card */}
      <SpecCard
        title="SaaS customers"
        description="Every tenant on the platform. Click a row to open the customer profile."
        action={
          <div className="relative">
            <Search size={13} color="#8B8F9E" strokeWidth={2} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenants…"
              className="font-inter outline-none focus:ring-2 focus:ring-virgilio-purple/30"
              style={{ height: 30, width: 180, paddingLeft: 28, paddingRight: 10, fontSize: 12, background: '#F6F5F1', border: 'none', borderRadius: 8, color: '#1F2230' }}
            />
          </div>
        }
      >
        {/* Header row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID,
            gap: 8,
            padding: '8px 18px',
            borderBottom: '1px solid #F1F0EC',
          }}
          className="font-inter"
        >
          {headerCols.map((c, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8B8F9E' }}>
              {c}
            </div>
          ))}
        </div>

        {isLoading && (
          <div className="text-center font-inter text-[#8B8F9E]" style={{ padding: 28, fontSize: 12 }}>Loading tenants…</div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center font-inter text-[#8B8F9E]" style={{ padding: 28, fontSize: 12 }}>No tenants match these filters.</div>
        )}

        {!isLoading && filtered.map((c, i, arr) => {
          const owner = c.owner_id ? ownerMap[c.owner_id] : null
          const lastActive = c.last_active_at ? new Date(c.last_active_at) : null
          const isNow = !!lastActive && (Date.now() - lastActive.getTime() < 5 * 60 * 1000)
          const seats = c.seat_quantity || 1
          return (
            <div
              key={c.id}
              role="button"
              onClick={() => rowClick(c)}
              style={{
                display: 'grid',
                gridTemplateColumns: GRID,
                gap: 8,
                padding: '10px 18px',
                borderBottom: i < arr.length - 1 ? '1px solid #F1F0EC' : undefined,
                cursor: 'pointer',
                alignItems: 'center',
              }}
              className="hover:bg-[#FAFAF7] transition-colors"
            >
              {/* 1 Customer */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="flex items-center justify-center shrink-0 font-poppins"
                  style={{ width: 26, height: 26, borderRadius: 999, background: '#EDE4FF', color: '#5B21B6', fontSize: 10.5, fontWeight: 500 }}
                >
                  {initials(c.name)}
                </div>
                <div className="min-w-0">
                  <div className="font-inter truncate" style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}>{c.name}</div>
                  <div className="font-inter truncate" style={{ fontSize: 10, color: '#B5B9C4' }}>
                    since {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* 2 Owner */}
              <div className="min-w-0">
                {owner ? (
                  <>
                    <div className="font-inter truncate" style={{ fontSize: 11.5, fontWeight: 500, color: '#1F2230' }}>{owner.name}</div>
                    <div className="font-inter truncate" style={{ fontSize: 10, color: '#8B8F9E' }}>{owner.email}</div>
                  </>
                ) : (
                  <span className="font-inter" style={{ fontSize: 11, color: '#B5B9C4' }}>—</span>
                )}
              </div>

              {/* 3 Plan */}
              <div className="font-inter" style={{ fontSize: 11, color: '#5A6072' }}>{seats} seat{seats !== 1 ? 's' : ''}</div>

              {/* 4 Status */}
              <div>{statusToChip(c.status)}</div>

              {/* 5 Churn */}
              <div><ChurnIndicator risk={c.churn_risk} /></div>

              {/* 6 Usage · 30d */}
              <div className="flex items-center" style={{ gap: 9 }}>
                <span className="inline-flex items-center gap-1 font-inter" style={{ fontSize: 10.5, color: '#5A6072' }}>
                  <Briefcase size={10} color="#8B8F9E" /> {c.jobs_created_30d}
                </span>
                <span className="inline-flex items-center gap-1 font-inter" style={{ fontSize: 10.5, color: '#5A6072' }}>
                  <Users size={10} color="#8B8F9E" /> {c.members_active_count}
                </span>
                <span className="inline-flex items-center gap-1 font-inter" style={{ fontSize: 10.5, color: '#5A6072' }}>
                  <Activity size={10} color="#8B8F9E" /> {c.candidates_added_30d}
                </span>
              </div>

              {/* 7 Last active */}
              <div className="font-inter" style={{ fontSize: 11, color: isNow ? '#0B7A57' : '#8B8F9E', fontWeight: isNow ? 600 : 400 }}>
                {isNow ? 'now' : lastActive ? `${formatDistanceToNowStrict(lastActive, { addSuffix: false })} ago` : '—'}
              </div>

              {/* 8 Chevron */}
              <div className="flex justify-end">
                <ChevronRight size={13} color="#B5B9C4" />
              </div>
            </div>
          )
        })}
      </SpecCard>

      {/* 3d · Footnote */}
      <div className="flex items-center gap-1.5 font-inter" style={{ fontSize: 11, color: '#8B8F9E', marginTop: 2 }}>
        <Info size={12} color="#8B8F9E" strokeWidth={2} />
        Row click opens the SaaS customer profile.
      </div>
    </div>
  )
}
