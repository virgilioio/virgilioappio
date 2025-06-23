
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Archive, MoreHorizontal, FileText, Briefcase } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Job } from '@/hooks/useJobs'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsMobile } from '@/hooks/use-mobile'
import { Skeleton } from '@/components/ui/skeleton'

interface JobsTableProps {
  jobs: Job[]
  isLoading: boolean
  onView: (job: Job) => void
  onEdit: (job: Job) => void
  onArchive: (id: string) => void
  onCreateNew: () => void
  onRequestJob: () => void
}

export function JobsTable({ jobs, isLoading, onView, onEdit, onArchive, onCreateNew, onRequestJob }: JobsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const permissions = usePermissions()
  const isMobile = useIsMobile()

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

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.organization_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    const matchesLevel = levelFilter === 'all' || job.level === levelFilter
    
    return matchesSearch && matchesStatus && matchesLevel
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Jobs
              </CardTitle>
              <CardDescription>Manage job postings and track hiring progress</CardDescription>
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Mobile Card Layout
  if (isMobile) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Jobs
                  </CardTitle>
                  <CardDescription>
                    Manage job postings and track hiring progress
                  </CardDescription>
                  {permissions.isWorkspaceOwner && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Jobs from approved requests will appear here automatically
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {permissions.canCreateJobs ? (
                    <Button onClick={onCreateNew} size="sm" className="gap-1">
                      <Plus className="h-4 w-4" />
                      Create
                    </Button>
                  ) : permissions.canRequestJobs ? (
                    <Button onClick={onRequestJob} size="sm" className="gap-1">
                      <Plus className="h-4 w-4" />
                      Request
                    </Button>
                  ) : null}
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search jobs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
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
                    <SelectTrigger>
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
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No jobs yet</h3>
                <p className="text-muted-foreground mb-4">
                  {jobs.length === 0 ? 'Create your first job to get started.' : 'No jobs match your filters.'}
                </p>
                {jobs.length === 0 && (permissions.canCreateJobs || permissions.canRequestJobs) && (
                  <div className="flex gap-2 justify-center">
                    {permissions.canCreateJobs ? (
                      <Button onClick={onCreateNew} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create Job
                      </Button>
                    ) : permissions.canRequestJobs ? (
                      <Button onClick={onRequestJob} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Request Job
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <Card key={job.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onView(job)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-md truncate">{job.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{job.level}</p>
                      <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
                        <span>{job.department || 'No dept'}</span>
                        <span>•</span>
                        <span>{job.location || 'Remote'}</span>
                        <span>•</span>
                        <span>{job.organization_name || 'Unknown Org'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant={getStatusBadgeVariant(job.status)} className="text-xs">
                          {job.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(job); }}>
                          <FileText className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        {permissions.canEditJobs && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(job); }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {permissions.canArchiveJobs && job.status !== 'archived' && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(job.id); }}>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Desktop Table Layout
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Jobs
            </CardTitle>
            <CardDescription>
              Manage job postings and track hiring progress
            </CardDescription>
            {permissions.isWorkspaceOwner && (
              <p className="text-xs text-muted-foreground mt-1">
                Jobs from approved requests will appear here automatically
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {permissions.canCreateJobs ? (
              <Button onClick={onCreateNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Job
              </Button>
            ) : permissions.canRequestJobs ? (
              <Button onClick={onRequestJob} className="gap-2">
                <Plus className="h-4 w-4" />
                Request Job
              </Button>
            ) : null}
          </div>
        </div>
        
        <div className="flex gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
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
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="L1 - Specialists">L1 - Specialists</SelectItem>
              <SelectItem value="L2 - Managers">L2 - Managers</SelectItem>
              <SelectItem value="L3 - Directors / VPs / Executive Search">L3 - Directors / VPs / Executive Search</SelectItem>
              <SelectItem value="L4 - C-Level">L4 - C-Level</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredJobs.length === 0 ? (
          <div className="text-center py-8">
            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No jobs yet</h3>
            <p className="text-muted-foreground mb-4">
              {jobs.length === 0 ? 'Create your first job to get started.' : 'No jobs match your filters.'}
            </p>
            {jobs.length === 0 && (permissions.canCreateJobs || permissions.canRequestJobs) && (
              <div className="flex gap-2 justify-center">
                {permissions.canCreateJobs ? (
                  <Button onClick={onCreateNew} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Job
                  </Button>
                ) : permissions.canRequestJobs ? (
                  <Button onClick={onRequestJob} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Request Job
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Level</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead className="hidden lg:table-cell">Location</TableHead>
                  <TableHead className="hidden xl:table-cell">Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map((job) => (
                  <TableRow key={job.id} interactive onClick={() => onView(job)}>
                    <TableCell className="font-medium">
                      <div className="truncate max-w-[200px]">{job.title}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{job.level}</TableCell>
                    <TableCell className="hidden md:table-cell">{job.department || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{job.location || '-'}</TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <div className="truncate max-w-[150px]" title={job.organization_name}>
                        {job.organization_name || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(job.status)}>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{new Date(job.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {permissions.canEditJobs && (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit(job); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {permissions.canArchiveJobs && job.status !== 'archived' && (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onArchive(job.id); }}>
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
