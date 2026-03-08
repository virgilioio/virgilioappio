import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, FileText, Building, ChevronLeft, ChevronRight, MoreHorizontal, Eye, Edit, Archive, X } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { FilterChipPopover, type FilterChipOption } from '@/components/ui/filter-chip-popover'
import { usePermissions } from '@/hooks/usePermissions'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useMembers } from '@/hooks/useMembers'
import { useUserAssignedJobIds } from '@/hooks/useUserAssignedJobIds'
import { jobMatchesUsers } from '@/utils/jobInvolvement'
import { Job } from '@/hooks/useJobs'

interface JobsTableProps {
  jobs: Job[]
  isLoading: boolean
  onView: (job: Job) => void
  onEdit: (job: Job) => void
  onArchive: (id: string) => void
  onCreateNew: () => void
}

export function JobsTable({ 
  jobs, 
  isLoading, 
  onView, 
  onEdit, 
  onArchive, 
  onCreateNew
}: JobsTableProps) {
  const navigate = useNavigate()
  const permissions = usePermissions()
  const { organizations } = useOrganizations()
  const { members, isLoading: membersLoading } = useMembers()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  
  // Fetch job assignments for selected users (like Pipeline page)
  const { assignedJobIds } = useUserAssignedJobIds(selectedUsers)

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'open':
        return 'default'
      case 'draft':
        return 'secondary'
      case 'closed':
        return 'destructive'
      case 'archived':
        return 'outline'
      default:
        return 'secondary'
    }
  }


  // User options for filter (consistent with Pipeline page)
  const userOptions = useMemo(() => {
    return members
      .filter(m => m.user_status === 'active' && m.user_id && (m.user_type === 'member' || m.user_type === 'workspace_owner'))
      .map(m => ({
        value: m.user_id!,
        label: `${m.user_first_name || ''} ${m.user_last_name || ''}`.trim() || m.user_email || 'Unknown',
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [members])

  // Organization options for filter (consistent with Pipeline page)
  const organizationOptions = useMemo(() => {
    return organizations
      .filter(org => org.status === 'active')
      .map(org => ({
        value: org.id,
        label: org.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [organizations])

  // Client-side filter with AND logic (consistent with Pipeline page)
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Search filter
      const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           job.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           job.department?.toLowerCase().includes(searchTerm.toLowerCase())
      if (!matchesSearch) return false
      
      // Status filter
      if (statusFilter !== 'all' && job.status !== statusFilter) return false
      
      // Organization filter - supports multiple selections (AND with other filters, OR within)
      if (selectedOrganizations.length > 0 && !selectedOrganizations.includes(job.organization_id)) return false
      
      // User filter - uses shared utility to check hiring_team AND job_assignments
      if (!jobMatchesUsers(job, selectedUsers, assignedJobIds)) return false
      
      return true
    })
  }, [jobs, searchTerm, statusFilter, selectedOrganizations, selectedUsers, assignedJobIds])

  // Calculate pagination
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, selectedOrganizations, selectedUsers])

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Show first page
      pages.push(1)
      
      if (currentPage > 4) {
        pages.push('ellipsis')
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (currentPage < totalPages - 3) {
        pages.push('ellipsis')
      }
      
      // Show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  if (isLoading) {
    return (
      <Card className="bg-surface-primary">
        <CardHeader>
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={5} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-surface-primary">
      <CardHeader>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            {(permissions.canViewOrganizations || permissions.isPlatformAdmin) && organizationOptions.length > 0 && (
              <MultiSelect
                options={organizationOptions}
                selectedValues={selectedOrganizations}
                onSelectionChange={setSelectedOrganizations}
                placeholder="Filter by organization..."
                className="w-full sm:w-[220px]"
              />
            )}

            {!membersLoading && userOptions.length > 0 && (
              <MultiSelect
                options={userOptions}
                selectedValues={selectedUsers}
                onSelectionChange={setSelectedUsers}
                placeholder="Filter by user..."
                className="w-full sm:w-[220px]"
              />
            )}

            <div className="flex gap-2">
              <PermissionGate permission="canCreateJobs">
                <Button onClick={onCreateNew} size="sm" className="gap-sm whitespace-nowrap">
                  <Plus className="h-4 w-4" />
                  Create Job
                </Button>
              </PermissionGate>
              
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredJobs.length === 0 ? (
          <EmptyState
            assetType="empty-state-jobs"
            title={jobs.length === 0 ? 'No jobs yet' : 'No jobs match your filters'}
            description={jobs.length === 0 
              ? 'Create your first job posting to get started.'
              : 'Try adjusting your search or filter criteria.'
            }
            fallbackIcon={FileText}
            action={jobs.length === 0 && permissions.canCreateJobs ? {
              label: 'Create Job',
              onClick: onCreateNew
            } : undefined}
          />
        ) : (
          <>
            <div className="space-y-sm">
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedJobs.map((job) => (
                      <TableRow 
                        key={job.id} 
                        interactive
                        className="cursor-pointer"
                        onClick={() => onView(job)}
                      >
                        <TableCell className="font-medium">{job.title}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            {job.organization_name || 'Organization'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(job.status)}>
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  onView(job)
                                }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <PermissionGate permission="canEditJobs">
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation()
                                    onEdit(job)
                                  }}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                </PermissionGate>
                                <PermissionGate permission="canArchiveJobs">
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onArchive(job.id)
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                </PermissionGate>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-sm">
                {paginatedJobs.map((job) => (
                  <Card key={job.id} className="bg-background transition-all duration-150">
                    <CardContent className="p-sm">
                      <div 
                        className="cursor-pointer" 
                        onClick={() => onView(job)}
                      >
                        <div className="flex items-start justify-between mb-sm">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-text-primary mb-1">{job.title}</h4>
                            <div className="flex items-center gap-2 text-sm text-text-secondary">
                              <Building className="h-4 w-4" />
                              {job.organization_name || 'Organization'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={getStatusBadgeVariant(job.status)} className="shrink-0">
                              {job.status}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  onView(job)
                                }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <PermissionGate permission="canEditJobs">
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation()
                                    onEdit(job)
                                  }}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                </PermissionGate>
                                <PermissionGate permission="canArchiveJobs">
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onArchive(job.id)
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                </PermissionGate>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Beautiful Enhanced Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 space-y-6">
                {/* Results Summary Card */}
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-secondary/50 rounded-brand text-sm text-text-secondary backdrop-blur-sm">
                    <FileText className="h-4 w-4 opacity-60" />
                    <span className="font-medium">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} jobs
                    </span>
                  </div>
                </div>
                
                {/* Enhanced Pagination Navigation */}
                <div className="flex justify-center">
                  <div className="inline-flex items-center bg-surface-primary rounded-brand p-1 gap-1">
                    {/* Previous Button */}
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
                      <span className="hidden sm:inline">Previous</span>
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1 px-2">
                      {getPageNumbers().map((page, index) => (
                        <div key={index}>
                          {page === 'ellipsis' ? (
                            <div className="flex items-center justify-center w-8 h-8 text-text-tertiary">
                              <MoreHorizontal className="h-4 w-4" />
                            </div>
                          ) : (
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`
                                w-8 h-8 rounded-brand text-sm font-medium transition-all duration-200 ease-out
                                ${currentPage === page
                                  ? 'bg-accent text-accent-foreground shadow-sm scale-105 font-semibold'
                                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:-translate-y-0.5 hover:shadow-sm active:scale-95'
                                }
                              `}
                            >
                              {page}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Next Button */}
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
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Mobile Simplified Pagination */}
                <div className="sm:hidden flex justify-center">
                  <div className="inline-flex items-center gap-4 px-4 py-2 bg-surface-secondary/30 rounded-brand backdrop-blur-sm">
                    <button
                      onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`
                        p-2 rounded-brand transition-all duration-200
                        ${currentPage === 1 
                          ? 'text-text-tertiary cursor-not-allowed opacity-50' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:scale-105 active:scale-95'
                        }
                      `}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-text-secondary">Page</span>
                      <span className="font-medium text-text-primary bg-accent/20 px-2 py-1 rounded-brand">
                        {currentPage}
                      </span>
                      <span className="text-text-secondary">of {totalPages}</span>
                    </div>
                    
                    <button
                      onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`
                        p-2 rounded-brand transition-all duration-200
                        ${currentPage === totalPages 
                          ? 'text-text-tertiary cursor-not-allowed opacity-50' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:scale-105 active:scale-95'
                        }
                      `}
                    >
                      <ChevronRight className="h-5 w-5" />
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
