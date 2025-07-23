import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Search, Edit, Trash2, Plus, ChevronLeft, ChevronRight, MoreHorizontal, Users } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Worker } from '@/hooks/useWorkers'
import { usePermissions } from '@/hooks/usePermissions'
import { useOrganizations } from '@/hooks/useOrganizations'
import { COUNTRIES } from '@/constants/countries'

interface WorkersTableProps {
  workers: Worker[]
  isLoading: boolean
  onEdit: (worker: Worker) => void
  onDelete: (id: string) => void
  onViewProfile: (worker: Worker) => void
  onAddNew?: () => void
}

export function WorkersTable({ 
  workers, 
  isLoading, 
  onEdit, 
  onDelete,
  onViewProfile,
  onAddNew
}: WorkersTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [countryFilter, setCountryFilter] = useState<string>('all')
  const [organizationFilter, setOrganizationFilter] = useState<string>('all')
  const permissions = usePermissions()
  const { organizations } = useOrganizations()
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'pending':
        return 'warning'
      case 'inactive':
        return 'secondary'
      case 'terminated':
        return 'destructive'
      case 'on_leave':
        return 'info'
      default:
        return 'outline'
    }
  }

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-700'
      case 'pending':
        return 'bg-yellow-700'
      case 'inactive':
        return 'bg-gray-700'
      case 'terminated':
        return 'bg-red-700'
      case 'on_leave':
        return 'bg-blue-700'
      default:
        return 'bg-gray-700'
    }
  }

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'employee':
        return 'default'
      case 'contractor':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const formatWorkerType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatWorkerStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = worker.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (worker.work_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (worker.job_title || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || worker.worker_status === statusFilter
    const matchesType = typeFilter === 'all' || worker.worker_type === typeFilter
    const matchesCountry = countryFilter === 'all' || worker.country === countryFilter
    const matchesOrganization = organizationFilter === 'all' || worker.organization_id === organizationFilter
    
    return matchesSearch && matchesStatus && matchesType && matchesCountry && matchesOrganization
  })

  // Calculate pagination
  const totalPages = Math.ceil(filteredWorkers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedWorkers = filteredWorkers.slice(startIndex, endIndex)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, typeFilter, countryFilter, organizationFilter])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
              </SelectContent>
            </Select>

            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Filter by country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {COUNTRIES
                  .sort((a, b) => a.label.localeCompare(b.label))
                  .map((country) => (
                    <SelectItem key={country.value} value={country.label}>
                      {country.label}
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>

            {/* Organization Filter - Only visible to platform admins */}
            {permissions.isPlatformAdmin && (
              <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            )}

            {permissions.canCreateWorkers && onAddNew && (
              <Button onClick={onAddNew} className="gap-2 whitespace-nowrap">
                <Plus className="h-4 w-4" />
                Add Worker
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredWorkers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {workers.length === 0 ? 'No workers found' : 'No workers match your filters'}
          </div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedWorkers.map((worker) => (
                    <TableRow key={worker.id} className="cursor-pointer" onClick={() => onViewProfile(worker)}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{worker.full_name}</div>
                          {worker.job_title && (
                            <div className="text-sm text-muted-foreground">{worker.job_title}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{worker.country || 'Not specified'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(worker.worker_status)} className="flex items-center gap-1.5">
                          {formatWorkerStatus(worker.worker_status)}
                          <div className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(worker.worker_status)}`} />
                        </Badge>
                      </TableCell>
                      <TableCell>{worker.department || 'Not specified'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {permissions.canEditWorkers && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(worker); }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Worker
                              </DropdownMenuItem>
                            )}
                            {permissions.canDeleteWorkers && (
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); onDelete(worker.id); }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Worker
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 space-y-6">
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-secondary/50 border border-border/50 rounded-brand text-sm text-text-secondary backdrop-blur-sm">
                    <Users className="h-4 w-4 opacity-60" />
                    <span className="font-medium">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredWorkers.length)} of {filteredWorkers.length} workers
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <div className="inline-flex items-center bg-surface-primary border border-border/80 rounded-brand shadow-sm p-1 gap-1">
                    <button
                      onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`
                        inline-flex items-center gap-2 px-3 py-2 rounded-brand text-sm font-medium transition-all duration-200 ease-out
                        ${currentPage === 1 
                          ? 'text-text-tertiary cursor-not-allowed opacity-50' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:-translate-y-0.5 hover:shadow-sm active:scale-95'
                        }
                      `}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>

                    <div className="flex items-center gap-1 px-2">
                      <span className="text-sm text-text-secondary">
                        Page {currentPage} of {totalPages}
                      </span>
                    </div>

                    <button
                      onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`
                        inline-flex items-center gap-2 px-3 py-2 rounded-brand text-sm font-medium transition-all duration-200 ease-out
                        ${currentPage === totalPages 
                          ? 'text-text-tertiary cursor-not-allowed opacity-50' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:-translate-y-0.5 hover:shadow-sm active:scale-95'
                        }
                      `}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}