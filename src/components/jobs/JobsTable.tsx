
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Edit, Archive, FileText, Building, MapPin, DollarSign, Eye, UserPlus } from 'lucide-react'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { usePermissions } from '@/hooks/usePermissions'
import { useOrganizations } from '@/hooks/useOrganizations'
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
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [organizationFilter, setOrganizationFilter] = useState<string>('all')
  const [hiringTeamFilter, setHiringTeamFilter] = useState<string>('all')

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

  // Get unique hiring team members across all jobs
  const getAllHiringTeamMembers = () => {
    const members = new Set<string>()
    jobs.forEach(job => {
      if (job.hiring_team && Array.isArray(job.hiring_team)) {
        job.hiring_team.forEach((member: any) => {
          if (member?.name) {
            members.add(member.name)
          }
        })
      }
    })
    return Array.from(members).sort()
  }

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.department?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    const matchesLevel = levelFilter === 'all' || job.level === levelFilter
    const matchesOrganization = organizationFilter === 'all' || job.organization_id === organizationFilter
    
    const matchesHiringTeam = hiringTeamFilter === 'all' || 
      (job.hiring_team && Array.isArray(job.hiring_team) && 
       job.hiring_team.some((member: any) => member?.name === hiringTeamFilter))
    
    return matchesSearch && matchesStatus && matchesLevel && matchesOrganization && matchesHiringTeam
  })

  if (isLoading) {
    return (
      <Card className="bg-surface-primary border-border">
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
    <Card className="bg-surface-primary border-border">
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
                <SelectItem value="L1">L1 - Specialists</SelectItem>
                <SelectItem value="L2">L2 - Managers</SelectItem>
                <SelectItem value="L3">L3 - Directors / VPs / Executive Search</SelectItem>
                <SelectItem value="L4">L4 - C-Level</SelectItem>
              </SelectContent>
            </Select>

            {/* Organization Filter - Only visible to platform admins */}
            {permissions.isPlatformAdmin && (
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

            <Select value={hiringTeamFilter} onValueChange={setHiringTeamFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Hiring Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Team Members</SelectItem>
                {getAllHiringTeamMembers().map((member) => (
                  <SelectItem key={member} value={member}>
                    {member}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
          <div className="text-center py-xl bg-surface-secondary rounded-brand border border-border/50">
            <FileText className="h-12 w-12 mx-auto mb-md text-text-secondary opacity-50" />
            <p className="text-md font-medium text-text-primary mb-sm">
              {jobs.length === 0 ? 'No jobs yet' : 'No jobs match your filters'}
            </p>
            <p className="text-sm text-text-secondary">
              {jobs.length === 0 ? 'Create your first job posting' : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
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
                  {filteredJobs.map((job) => (
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
              {filteredJobs.map((job) => (
                <Card key={job.id} className="bg-background border-border hover:shadow-sm transition-all duration-150">
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
        )}
      </CardContent>
    </Card>
  )
}
