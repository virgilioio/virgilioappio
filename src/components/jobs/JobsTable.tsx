
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Eye, Edit, Archive } from 'lucide-react'
import { Job } from '@/hooks/useJobs'
import { usePermissions } from '@/hooks/usePermissions'

interface JobsTableProps {
  jobs: Job[]
  isLoading: boolean
  onView: (job: Job) => void
  onEdit: (job: Job) => void
  onArchive: (id: string) => void
  onCreateNew: () => void
}

export function JobsTable({ jobs, isLoading, onView, onEdit, onArchive, onCreateNew }: JobsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const permissions = usePermissions()

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
                         job.location?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    const matchesLevel = levelFilter === 'all' || job.level === levelFilter
    
    return matchesSearch && matchesStatus && matchesLevel
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-token-lg">
          <div className="flex items-center justify-center py-token-xl">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Jobs</CardTitle>
          {permissions.canCreateJobs && (
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Job
            </Button>
          )}
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
          <div className="text-center py-token-xl text-muted-foreground">
            {jobs.length === 0 ? 'No jobs found' : 'No jobs match your filters'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.title}</TableCell>
                  <TableCell>{job.level}</TableCell>
                  <TableCell>{job.department || '-'}</TableCell>
                  <TableCell>{job.location || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(job.status)}>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(job.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onView(job)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {permissions.canEditJobs && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(job)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {permissions.canArchiveJobs && job.status !== 'archived' && (
                        <Button variant="ghost" size="sm" onClick={() => onArchive(job.id)}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
