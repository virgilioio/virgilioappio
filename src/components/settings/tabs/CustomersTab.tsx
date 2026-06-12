import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal, Plus, Search } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { OrganizationFormSheet } from '@/components/organizations/OrganizationFormSheet'
import { useOrganizations, Organization } from '@/hooks/useOrganizations'
import { useTenant } from '@/hooks/useTenant'
import { supabase } from '@/integrations/supabase/client'
import { useNavigate } from 'react-router-dom'

const STATUS_CHIP: Record<string, { bg: string; fg: string; label: string }> = {
  active:   { bg: '#D1FAE5', fg: '#0B7A57', label: 'Active' },
  inactive: { bg: '#F1F0EC', fg: '#5A6072', label: 'Prospect' },
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

/**
 * Settings · CRM · Customers
 * Flat card list of client organizations the workspace hires for.
 * Reuses existing CRUD via useOrganizations + OrganizationFormSheet.
 */
export function CustomersTab() {
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selected, setSelected] = useState<Organization | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const {
    organizations,
    isLoading,
    createOrganization,
    updateOrganization,
    deleteOrganization,
  } = useOrganizations()

  // Deal + Job counts per organization, scoped to this tenant.
  const { data: counts = {} } = useQuery({
    queryKey: ['customers-counts', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const [deals, jobs] = await Promise.all([
        (supabase as any)
          .from('deals')
          .select('organization_id')
          .eq('tenant_id', tenant!.id),
        (supabase as any)
          .from('jobs')
          .select('organization_id')
          .eq('tenant_id', tenant!.id),
      ])
      const acc: Record<string, { deals: number; jobs: number }> = {}
      const bump = (id: string | null | undefined, key: 'deals' | 'jobs') => {
        if (!id) return
        acc[id] ??= { deals: 0, jobs: 0 }
        acc[id][key] += 1
      }
      ;(deals.data ?? []).forEach((d: any) => bump(d.organization_id, 'deals'))
      ;(jobs.data ?? []).forEach((j: any) => bump(j.organization_id, 'jobs'))
      return acc
    },
  })

  const handleSubmit = async (data: any) => {
    if (selected) await updateOrganization(selected.id, data)
    else await createOrganization(data)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return organizations
    return organizations.filter((o) => o.name.toLowerCase().includes(q))
  }, [organizations, search])

  const GRID = 'grid items-center'
  const gridCols: React.CSSProperties = {
    gridTemplateColumns: '1fr 90px 90px 90px 40px',
  }

  return (
    <div>
      <section
        className="bg-white rounded-[12px] overflow-hidden mb-[14px]"
        style={{ border: '1px solid #E7E8EE' }}
      >
        <header
          className="flex items-center justify-between gap-4"
          style={{ padding: '14px 18px', borderBottom: '1px solid #F1F0EC' }}
        >
          <div className="min-w-0">
            <h3
              className="font-poppins font-semibold text-[#0d0d09] m-0"
              style={{ fontSize: 13.5, letterSpacing: '-0.01em', lineHeight: 1.2 }}
            >
              Customers
            </h3>
            <p
              className="font-inter text-[#8B8F9E] m-0"
              style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 3 }}
            >
              The companies you hire for. Deals and jobs link back to each customer.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search
                size={12}
                strokeWidth={2}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8B8F9E] pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="font-inter outline-none"
                style={{
                  height: 30,
                  width: 180,
                  padding: '0 10px 0 26px',
                  background: '#F6F5F1',
                  border: '1px solid transparent',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#1F2230',
                }}
              />
            </div>
            <Button
              size="sm"
              icon={Plus}
              onClick={() => { setSelected(null); setIsFormOpen(true) }}
            >
              Add customer
            </Button>
          </div>
        </header>

        {isLoading ? (
          <div style={{ padding: '18px', fontSize: 12, color: '#8B8F9E' }} className="font-inter">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="font-inter text-center"
            style={{ padding: '28px 18px', fontSize: 12, color: '#8B8F9E' }}
          >
            No customers yet — add the first company you hire for.
          </div>
        ) : (
          <>
            {/* Column header row */}
            <div
              className={GRID}
              style={{
                ...gridCols,
                padding: '8px 18px 4px',
              }}
            >
              <div className="font-inter" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', color: '#8B8F9E', textTransform: 'uppercase' }}>Company</div>
              <div className="font-inter text-right" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', color: '#8B8F9E', textTransform: 'uppercase' }}>Deals</div>
              <div className="font-inter text-right" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', color: '#8B8F9E', textTransform: 'uppercase' }}>Jobs</div>
              <div className="font-inter text-center" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', color: '#8B8F9E', textTransform: 'uppercase' }}>Status</div>
              <div />
            </div>

            {filtered.map((org, idx) => {
              const c = counts[org.id] ?? { deals: 0, jobs: 0 }
              const chip = STATUS_CHIP[org.status] ?? STATUS_CHIP.inactive
              const last = idx === filtered.length - 1
              return (
                <div
                  key={org.id}
                  className={GRID}
                  onClick={() => navigate(`/organizations/${org.id}`)}
                  role="button"
                  tabIndex={0}
                  style={{
                    ...gridCols,
                    padding: '10px 18px',
                    borderBottom: last ? 'none' : '1px solid #F1F0EC',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFAF7')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Company */}
                  <div className="flex items-center min-w-0" style={{ gap: 9 }}>
                    <div
                      className="shrink-0 inline-flex items-center justify-center font-inter"
                      style={{
                        width: 24, height: 24, borderRadius: 6,
                        background: '#F1F0EC', color: '#5A6072',
                        fontSize: 10, fontWeight: 600,
                      }}
                    >
                      {initials(org.name)}
                    </div>
                    <span
                      className="truncate font-inter"
                      style={{ fontSize: 12.5, fontWeight: 600, color: '#1F2230' }}
                    >
                      {org.name}
                    </span>
                  </div>

                  {/* Deals */}
                  <div
                    className="font-poppins text-right tabular-nums"
                    style={{
                      fontSize: 12.5, fontWeight: 600,
                      color: c.deals > 0 ? '#1F2230' : '#B5B9C4',
                    }}
                  >
                    {c.deals}
                  </div>

                  {/* Jobs */}
                  <div
                    className="font-inter text-right tabular-nums"
                    style={{ fontSize: 12, color: '#8B8F9E' }}
                  >
                    {c.jobs}
                  </div>

                  {/* Status */}
                  <div className="flex justify-center">
                    <span
                      className="inline-flex items-center font-inter"
                      style={{
                        fontSize: 10, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 999,
                        backgroundColor: chip.bg, color: chip.fg,
                      }}
                    >
                      {chip.label}
                    </span>
                  </div>

                  {/* Kebab */}
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center"
                          style={{
                            background: 'transparent', border: 'none', padding: 4,
                            color: '#8B8F9E', cursor: 'pointer',
                          }}
                          aria-label="Customer actions"
                        >
                          <MoreHorizontal size={14} strokeWidth={2} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={8}>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/organizations/${org.id}`)
                          }}
                        >
                          View customer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelected(org); setIsFormOpen(true)
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteId(org.id)
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </section>

      <OrganizationFormSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmit}
        organization={selected}
        isLoading={isLoading}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="mx-4 max-w-md sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate customer</AlertDialogTitle>
            <AlertDialogDescription>
              This sets the customer to inactive. It is not permanently deleted and can be reactivated later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-3">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-auto"
              onClick={async () => {
                if (deleteId) {
                  await deleteOrganization(deleteId)
                  setDeleteId(null)
                }
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
