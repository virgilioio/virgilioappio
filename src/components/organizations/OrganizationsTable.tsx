import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Edit, Trash2, MoreHorizontal, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  IdentityCell, StatusCell, NumericCell, ComposedCell, AvatarStack, ActionCell,
} from '@/components/ui/table-cells'
import { TableSkeleton } from '@/components/ui/table-states'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Organization } from '@/hooks/useOrganizations'
import { useDeals } from '@/hooks/useDeals'
import { useJobs } from '@/hooks/useJobs'
import { usePermissions } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabaseClient'
import { formatMoney } from '@/lib/currency'
import { cn } from '@/lib/utils'

type StatusSegment = 'all' | 'active' | 'inactive'

interface OrganizationsTableProps {
  organizations: Organization[]
  isLoading: boolean
  onEdit: (organization: Organization) => void
  onDelete: (id: string) => void
  onCreateNew?: () => void
}

const BRAND_COLORS = [
  '#7C5CFA', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#6366F1',
]

function brandColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return BRAND_COLORS[h % BRAND_COLORS.length]
}

function initials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function shortMoney(amount: number, currency = 'USD'): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return formatMoney(amount / 1_000_000, currency).replace(/\.?0+$/, '') + 'M'
  if (abs >= 1_000) return formatMoney(amount / 1_000, currency).replace(/\.?0+$/, '') + 'k'
  return formatMoney(amount, currency)
}

const COLS = 7 // company, industry, open deals, jobs, owner, status, actions

export function OrganizationsTable({
  organizations,
  isLoading,
  onEdit,
  onDelete,
}: OrganizationsTableProps) {
  const navigate = useNavigate()
  const permissions = usePermissions()
  const { data: deals = [] } = useDeals()
  const { jobs = [] } = useJobs()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusSegment>('active')
  const [ownerProfiles, setOwnerProfiles] = useState<Record<string, { name: string; first: string }>>({})

  useEffect(() => {
    const ownerIds = Array.from(new Set(organizations.map((o) => o.owner_id).filter(Boolean) as string[]))
    const missing = ownerIds.filter((id) => !ownerProfiles[id])
    if (!missing.length) return
    ;(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', missing)
      const map: Record<string, { name: string; first: string }> = { ...ownerProfiles }
      ;(data ?? []).forEach((p: any) => {
        const first = p.first_name ?? ''
        const last = p.last_name ?? ''
        const full = `${first} ${last}`.trim() || p.email || ''
        map[p.user_id] = { name: full, first: first || full.split(' ')[0] || '' }
      })
      setOwnerProfiles(map)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizations])

  const dealsByOrg = useMemo(() => {
    const map = new Map<string, { count: number; sum: number; currency: string }>()
    for (const d of deals) {
      if (!d.organization_id) continue
      const cur = map.get(d.organization_id) ?? { count: 0, sum: 0, currency: d.base_currency || d.currency || 'USD' }
      cur.count += 1
      cur.sum += Number(d.base_amount ?? d.amount ?? 0) || 0
      map.set(d.organization_id, cur)
    }
    return map
  }, [deals])

  const jobsByOrg = useMemo(() => {
    const map = new Map<string, number>()
    for (const j of jobs) {
      if (!j.organization_id) continue
      map.set(j.organization_id, (map.get(j.organization_id) ?? 0) + 1)
    }
    return map
  }, [jobs])

  const tabs = useMemo(() => {
    const activeCount = organizations.filter((o) => o.status === 'active').length
    const inactiveCount = organizations.filter((o) => o.status === 'inactive').length
    return [
      { value: 'active' as const, label: 'Active', count: activeCount },
      { value: 'all' as const, label: 'All', count: organizations.length },
      { value: 'inactive' as const, label: 'Inactive', count: inactiveCount },
    ]
  }, [organizations])

  const filteredOrganizations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return organizations.filter((org) => {
      if (statusFilter === 'active' && org.status !== 'active') return false
      if (statusFilter === 'inactive' && org.status !== 'inactive') return false
      if (q) {
        const ownerName = org.owner_id ? ownerProfiles[org.owner_id]?.name?.toLowerCase() ?? '' : ''
        const hay = `${org.name} ${ownerName}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [organizations, statusFilter, searchTerm, ownerProfiles])

  const handleRowClick = (org: Organization) => navigate(`/crm/companies/${org.id}`)

  return (
    <div className="space-y-4">
      {/* Tabs + Filters card — mirrors Jobs */}
      <div className="rounded-2xl border border-virgilio-border bg-white overflow-hidden">
        {/* Tabs row */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-virgilio-border">
          {tabs.map((t) => {
            const active = t.value === statusFilter
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setStatusFilter(t.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg font-poppins text-[13.5px] tracking-[-0.01em] transition-colors',
                  active
                    ? 'bg-[#FAFAF7] text-text-primary font-semibold'
                    : 'text-text-tertiary hover:text-text-primary font-medium',
                )}
              >
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span className={cn(
                    'font-poppins text-[12.5px] tabular-nums',
                    active ? 'text-text-secondary' : 'text-text-tertiary/70',
                  )}>
                    ({t.count})
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search + filter pills row */}
        <div className="flex flex-wrap items-center gap-3 p-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search companies by name, industry, or owner…"
              className="h-10 pl-10 pr-3 bg-[#FAFAF7] border-transparent rounded-xl text-[13.5px] focus-visible:bg-white"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {['Industry', 'Owner', 'Location'].map((p) => (
              <button
                key={p}
                type="button"
                className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-virgilio-border bg-white text-[12.5px] font-inter text-text-secondary hover:bg-[#FAFAF7] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table card — mirrors Jobs */}
      <div className="hidden lg:block rounded-2xl border border-virgilio-border bg-white overflow-hidden">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead className="text-right">Open deals</TableHead>
              <TableHead className="text-right">Jobs</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[32px] text-right" aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton rows={5} columns={COLS} />
            ) : filteredOrganizations.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLS} className="p-10 text-center text-[13px] text-text-tertiary">
                  No companies match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrganizations.map((org) => {
                const dealInfo = dealsByOrg.get(org.id)
                const openDeals = dealInfo?.count ?? 0
                const dealSum = dealInfo?.sum ?? 0
                const dealCcy = dealInfo?.currency ?? 'USD'
                const jobCount = jobsByOrg.get(org.id) ?? 0
                const owner = org.owner_id ? ownerProfiles[org.owner_id] : null

                return (
                  <TableRow
                    key={org.id}
                    interactive
                    className="group cursor-pointer"
                    onClick={() => handleRowClick(org)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-8 w-8 shrink-0 rounded-[9px] flex items-center justify-center text-white font-poppins font-semibold text-[11px]"
                          style={{ backgroundColor: brandColor(org.name) }}
                        >
                          {initials(org.name)}
                        </div>
                        <IdentityCell
                          hideAvatar
                          name={org.name}
                          sub="—"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-text-secondary">—</TableCell>
                    <TableCell className="text-right">
                      {openDeals > 0 ? (
                        <div className="flex flex-col items-end leading-tight">
                          <NumericCell>{openDeals}</NumericCell>
                          {dealSum > 0 && (
                            <span className="text-[10.5px] text-text-tertiary font-inter tabular-nums">
                              {shortMoney(dealSum, dealCcy)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <NumericCell className="text-text-tertiary/60">0</NumericCell>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <NumericCell className={jobCount > 0 ? undefined : 'text-text-tertiary/60'}>
                        {jobCount}
                      </NumericCell>
                    </TableCell>
                    <TableCell>
                      {owner ? (
                        <ComposedCell>
                          <AvatarStack people={[{ name: owner.name }]} max={1} size={28} />
                          <span className="text-table-cell text-text-primary truncate">{owner.first}</span>
                        </ComposedCell>
                      ) : (
                        <span className="text-text-tertiary">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusCell>
                        <Badge tone={org.status === 'active' ? 'green' : 'neutral'} dot size="sm">
                          {org.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </StatusCell>
                    </TableCell>
                    <TableCell className="w-[32px] text-right">
                      <ActionCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="xs" iconOnly icon={MoreHorizontal} aria-label="Company actions" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRowClick(org) }}>
                              <Eye className="h-3.5 w-3.5" /> <span>View</span>
                            </DropdownMenuItem>
                            {permissions.canEditOrganizations && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(org) }}>
                                <Edit className="h-3.5 w-3.5" /> <span>Edit</span>
                              </DropdownMenuItem>
                            )}
                            {permissions.canDeleteOrganizations && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); onDelete(org.id) }}
                                  className="text-destructive focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> <span>Delete</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </ActionCell>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// Expose helpers for the page header
export function useOrganizationCounts(organizations: Organization[]) {
  return useMemo(() => {
    const active = organizations.filter((o) => o.status === 'active').length
    const inactive = organizations.filter((o) => o.status === 'inactive').length
    return { active, inactive, total: organizations.length }
  }, [organizations])
}
