import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Edit, Archive, FileText, Building, MapPin, DollarSign, Eye, UserPlus, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { usePermissions } from '@/hooks/usePermissions'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useMembers } from '@/hooks/useMembers'
import { Job } from '@/hooks/useJobs'

interface JobsTableProps {
  jobs: Job[]
  isLoading: boolean
  onView: (job: Job) => void
  onEdit: (job: Job) => void
  onArchive: (id: string) => void
  onCreateNew: () => void
  onRequestJob: () => void
}

export function JobsTable({ 
  jobs, 
  isLoading, 
  onView, 
  onEdit, 
  onArchive, 
  onCreateNew,
  onRequestJob
}: JobsTableProps) {
  const navigate = useNavigate()
  const permissions = usePermissions()
  const { organizations } = useOrganizations()
  const { members, isLoading: membersLoading } = useMembers()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [organizationFilter, setOrganizationFilter] = useState<string>('all')
  const [hiringTeamFilter, setHiringTeamFilter] = useState<string>('all')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

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

  const formatSalary = (min: number | null, max: number | null, currency: string | null) => {
    if (!min && !max) return 'Not specified'
    
    const curr = currency || 'USD'
    if (min && max) {
      return `${curr} ${min.toLocaleString()} - ${max.toLocaleString()}`
    }
    if (min) {
      return `${curr} ${min.toLocaleString()}+`
    }
    if (max) {
      return `Up to ${curr} ${max.toLocaleString()}`
    }
    return 'Not specified'
  }

  const getAllOrganizationMembers = () => {
    // Get all active members and guests from the organization
    const activeMembers = members.filter(member => 
      member.user_status === 'active' && 
      member.user_id &&
      (member.user_type === 'member' || member.user_type === 'guest' || member.user_type === 'workspace_owner')
    )
    
    return activeMembers.map(member => ({
      id: member.user_id!,
      memberId: member.id,
      name: `${member.user_first_name || ''} ${member.user_last_name || ''}`.trim() || member.user_email || 'Unnamed User',
      email: member.user_email
    })).sort((a, b) => a.name.localeCompare(b.name))
  }

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.department?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    const matchesLevel = levelFilter === 'all' || job.level === levelFilter
    
    // Check if user can view organizations for the organization filter
    const canViewOrganizations = permissions.canViewOrganizations || permissions.isPlatformAdmin
    const matchesOrganization = !canViewOrganizations || organizationFilter === 'all' || job.organization_id === organizationFilter
    
    const matchesHiringTeam = hiringTeamFilter === 'all' || (() => {
      // Check if the selected user is in the hiring team by user ID
      const isInHiringTeam = job.hiring_team && Array.isArray(job.hiring_team) && 
        job.hiring_team.some((member: any) => 
          (typeof member === 'string' && member === hiringTeamFilter) ||
          (typeof member === 'object' && (member?.id === hiringTeamFilter || member?.user_id === hiringTeamFilter))
        )
      
      return isInHiringTeam
    })()
    
    return matchesSearch && matchesStatus && matchesLevel && matchesOrganization && matchesHiringTeam
  })

  // Calculate pagination
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, levelFilter, organizationFilter, hiringTeamFilter])

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
        <CardContent className="space-y-md">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[52px] bg-surface-secondary rounded-brand animate-pulse" />
          ))}
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
            
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="L1 - Specialists">L1 - Specialists</SelectItem>
                <SelectItem value="L2 - Managers">L2 - Managers</SelectItem>
                <SelectItem value="L3 - Directors / VPs / Executive Search">L3 - Directors / VPs / Executive Search</SelectItem>
                <SelectItem value="L4 - C-Level">L4 - C-Level</SelectItem>
              </SelectContent>
            </Select>

            {(permissions.canViewOrganizations || permissions.isPlatformAdmin) && organizations.length > 0 && (
              <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Organization" />
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

            {(() => {
              const organizationMembers = getAllOrganizationMembers()
              return !membersLoading && organizationMembers.length > 0 ? (
                <Select value={hiringTeamFilter} onValueChange={setHiringTeamFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Team Members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Team Members</SelectItem>
                    {organizationMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null
            })()}

            <div className="flex gap-2">
              <PermissionGate permission="canCreateJobs">
                <Button onClick={onCreateNew} size="sm" className="gap-sm whitespace-nowrap">
                  <Plus className="h-4 w-4" />
                  Create Job
                </Button>
              </PermissionGate>
              
              <PermissionGate permission="canRequestJobs">
                <Button onClick={onRequestJob} variant="outline" size="sm" className="gap-sm whitespace-nowrap">
                  <UserPlus className="h-4 w-4" />
                  Request Job
                </Button>
              </PermissionGate>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredJobs.length === 0 ? (
          <div className="text-center py-xl bg-surface-secondary rounded-brand">
            <FileText className="h-12 w-12 mx-auto mb-md text-text-secondary opacity-50" />
            <p className="text-md font-medium text-text-primary mb-sm">
              {jobs.length === 0 ? 'No jobs yet' : 'No jobs match your filters'}
            </p>
            <p className="text-sm text-text-secondary">
              {jobs.length === 0 ? 'Create your first job posting' : 'Try adjusting your search or filters'}
            </p>
          </div>
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
                      <TableHead>Department</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Salary Range</TableHead>
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
                        <TableCell>{job.department || 'Not specified'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {job.location || 'Not specified'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{job.level}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            {formatSalary(job.salary_min, job.salary_max, job.currency)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(job.status)}>
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                onView(job)
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <PermissionGate permission="canEditJobs">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onEdit(job)
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                            <PermissionGate permission="canArchiveJobs">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onArchive(job.id)
                                }}
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
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
                            <div className="flex items-center gap-2 text-sm text-text-secondary mb-2">
                              <Building className="h-4 w-4" />
                              {job.organization_name || 'Organization'}
                            </div>
                          </div>
                          <Badge variant={getStatusBadgeVariant(job.status)} className="shrink-0">
                            {job.status}
                          </Badge>
                        </div>

                        <div className="space-y-2 text-sm text-text-secondary">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {job.location || 'Not specified'}
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {formatSalary(job.salary_min, job.salary_max, job.currency)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {job.level}
                            </Badge>
                            {job.department && (
                              <span className="text-xs">{job.department}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-sm pt-sm border-t border-border">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onView(job)
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <PermissionGate permission="canEditJobs">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                onEdit(job)
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate permission="canArchiveJobs">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                onArchive(job.id)
                              }}
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
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
