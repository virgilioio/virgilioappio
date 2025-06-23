
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, CheckCircle, Trash2, ListTodo } from 'lucide-react'
import { JobRequest } from '@/hooks/useJobRequests'
import { usePermissions } from '@/hooks/usePermissions'
import { Skeleton } from '@/components/ui/skeleton'

interface JobRequestTableProps {
  jobRequests: JobRequest[]
  isLoading: boolean
  onView: (jobRequest: JobRequest) => void
  onApprove: (id: string) => void
  onDelete: (id: string) => void
  onCreateNew: () => void
}

export function JobRequestTable({ 
  jobRequests, 
  isLoading, 
  onView, 
  onApprove, 
  onDelete, 
  onCreateNew 
}: JobRequestTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const permissions = usePermissions()

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary'
      case 'approved':
        return 'default'
      case 'rejected':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const formatSalary = (min?: number, max?: number, currency?: string) => {
    if (!min && !max) return '-'
    const curr = currency || 'USD'
    if (min && max) {
      return `${curr} ${min.toLocaleString()} - ${max.toLocaleString()}`
    }
    if (min) return `${curr} ${min.toLocaleString()}+`
    if (max) return `Up to ${curr} ${max.toLocaleString()}`
    return '-'
  }

  const filteredJobRequests = jobRequests.filter(request => {
    const matchesSearch = request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.organization_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.requester_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter
    const matchesLevel = levelFilter === 'all' || request.level === levelFilter
    
    return matchesSearch && matchesStatus && matchesLevel
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                Job Requests
              </CardTitle>
              <CardDescription>Manage job requests and approvals</CardDescription>
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Job Requests
            </CardTitle>
            <CardDescription>
              Manage job requests and approvals
            </CardDescription>
          </div>
          {permissions.canRequestJobs && (
            <Button onClick={onCreateNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Request Job
            </Button>
          )}
        </div>
        
        <div className="flex gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search job requests, organizations, or requesters..."
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
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="L1">L1</SelectItem>
              <SelectItem value="L2">L2</SelectItem>
              <SelectItem value="L3">L3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredJobRequests.length === 0 ? (
          <div className="text-center py-8">
            <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No job requests yet</h3>
            <p className="text-muted-foreground mb-4">
              {jobRequests.length === 0 ? 'Create your first job request to get started.' : 'No job requests match your filters.'}
            </p>
            {permissions.canRequestJobs && jobRequests.length === 0 && (
              <Button onClick={onCreateNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Request Job
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobRequests.map((request) => (
                  <TableRow key={request.id} interactive onClick={() => onView(request)}>
                    <TableCell className="font-medium">{request.title}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={request.organization_name}>
                      {request.organization_name || 'Unknown Organization'}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={request.requester_email || request.requester_name}>
                      {request.requester_name || 'Unknown User'}
                    </TableCell>
                    <TableCell>{request.level}</TableCell>
                    <TableCell>{request.department || '-'}</TableCell>
                    <TableCell>{formatSalary(request.salary_min, request.salary_max, request.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(request.status)}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {permissions.canApproveJobRequests && request.status === 'pending' && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onApprove(request.id); }}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {permissions.canManageJobRequests && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(request.id); }}>
                            <Trash2 className="h-4 w-4" />
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
