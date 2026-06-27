import { useMemo, useState } from 'react'
import { Search, Plus, Edit, Trash2, MoreHorizontal, Eye, RotateCcw } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  IdentityCell, StatusCell, ActionCell,
} from '@/components/ui/table-cells'
import { TableSkeleton } from '@/components/ui/table-states'
import { TableFooterSummary } from '@/components/ui/table-pagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState, EmptyAction } from '@/components/ui/empty-state'
import { SoftBuilding, SoftMagnifier } from '@/components/ui/EmptyIllustrations'
import { Organization } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'
import { OrganizationDetailsDialog } from './OrganizationDetailsDialog'
import { cn } from '@/lib/utils'

type StatusSegment = 'all' | 'active' | 'inactive'

interface OrganizationsTableProps {
  organizations: Organization[]
  isLoading: boolean
  onEdit: (organization: Organization) => void
  onDelete: (id: string) => void
  onCreateNew?: () => void
}

const COLS = 3

export function OrganizationsTable({
  organizations,
  isLoading,
  onEdit,
  onDelete,
  onCreateNew,
}: OrganizationsTableProps) {
  const permissions = usePermissions()
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusSegment>('active')

  const handleViewDetails = (organization: Organization) => {
    setSelectedOrganization(organization)
    setIsDetailsDialogOpen(true)
  }

  const handleCloseDetails = () => {
    setIsDetailsDialogOpen(false)
    setSelectedOrganization(null)
  }

  const tabs = useMemo(() => {
    const activeCount = organizations.filter(o => o.status === 'active').length
    const inactiveCount = organizations.filter(o => o.status === 'inactive').length
    return [
      { value: 'active' as const, label: 'Active', count: activeCount },
      { value: 'all' as const, label: 'All', count: organizations.length },
      { value: 'inactive' as const, label: 'Inactive', count: inactiveCount },
    ]
  }, [organizations])

  const filteredOrganizations = useMemo(() => {
    return organizations.filter(org => {
      if (statusFilter === 'active' && org.status !== 'active') return false
      if (statusFilter === 'inactive' && org.status !== 'inactive') return false
      if (searchTerm.trim()) {
        if (!org.name.toLowerCase().includes(searchTerm.toLowerCase())) return false
      }
      return true
    })
  }, [organizations, statusFilter, searchTerm])

  const hasActiveFilters = searchTerm.trim() !== ''

  const clearAll = () => {
    setSearchTerm('')
  }

  return (
    <>
      <div className="space-y-4">
        {/* Tabs + Filters card */}
        <div className="rounded-2xl border border-virgilio-border bg-white overflow-hidden">
          {/* Tabs row */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-virgilio-border">
            {tabs.map(t => {
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
                      : 'text-text-tertiary hover:text-text-primary font-medium'
                  )}
                >
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span className={cn(
                      'font-poppins text-[12.5px] tabular-nums',
                      active ? 'text-text-secondary' : 'text-text-tertiary/70'
                    )}>
                      ({t.count})
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Search + actions row */}
          <div className="flex flex-wrap items-center gap-3 p-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search companies…"
                className="h-10 pl-10 pr-3 bg-[#FAFAF7] border-transparent rounded-xl text-[13.5px] focus-visible:bg-white"
              />
            </div>
            {permissions.canCreateOrganizations && onCreateNew && (
              <Button onClick={onCreateNew} icon={Plus}>
                Create Company
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-virgilio-border bg-white overflow-hidden">
          <Table density="comfortable">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[32px] text-right" aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton rows={5} columns={COLS} />
              ) : filteredOrganizations.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={COLS} className="p-4">
                    {organizations.length === 0 ? (
                      <EmptyState
                        size="card"
                        illustration={<SoftBuilding />}
                        title="No companies yet"
                        body="Add your first company to start tracking deals and contacts."
                        primary={permissions.canCreateOrganizations && onCreateNew ? (
                          <EmptyAction icon={<Plus size={16} strokeWidth={2} />} onClick={onCreateNew}>
                            Create company
                          </EmptyAction>
                        ) : undefined}
                      />
                    ) : (
                      <EmptyState
                        size="card"
                        illustration={<SoftMagnifier />}
                        title="No matching companies"
                        body={searchTerm ? `No companies match "${searchTerm}".` : 'No companies fit these filters.'}
                        primary={hasActiveFilters ? (
                          <EmptyAction icon={<RotateCcw size={16} strokeWidth={2} />} onClick={clearAll}>
                            Clear filters
                          </EmptyAction>
                        ) : undefined}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrganizations.map(org => (
                  <TableRow
                    key={org.id}
                    interactive
                    className="group cursor-pointer"
                    onClick={() => handleViewDetails(org)}
                  >
                    <TableCell>
                      <IdentityCell hideAvatar name={org.name} fallback={org.name} />
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
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetails(org) }}>
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
                ))
              )}
            </TableBody>
          </Table>
          {!isLoading && filteredOrganizations.length > 0 && (
            <TableFooterSummary
              rangeStart={1}
              rangeEnd={filteredOrganizations.length}
              total={organizations.length}
              entityLabel="companies"
            />
          )}
        </div>
      </div>

      <OrganizationDetailsDialog
        organization={selectedOrganization}
        isOpen={isDetailsDialogOpen}
        onClose={handleCloseDetails}
      />
    </>
  )
}
