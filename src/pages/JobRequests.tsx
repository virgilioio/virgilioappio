
import { useState } from 'react'
import { useJobRequests } from '@/hooks/useJobRequests'
import { usePermissions } from '@/hooks/usePermissions'
import { JobRequestTable } from '@/components/job-requests/JobRequestTable'
import { JobRequestForm } from '@/components/job-requests/JobRequestForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function JobRequests() {
  const {
    jobRequests,
    isLoading,
    createJobRequest,
    approveJobRequest,
    deleteJobRequest
  } = useJobRequests()
  
  const permissions = usePermissions()
  const [showForm, setShowForm] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)

  const handleCreateNew = () => {
    setShowForm(true)
  }

  const handleFormSubmit = async (data: any) => {
    await createJobRequest(data)
    setShowForm(false)
  }

  const handleFormCancel = () => {
    setShowForm(false)
  }

  const handleView = (request: any) => {
    setSelectedRequest(request)
  }

  const handleApprove = async (id: string) => {
    await approveJobRequest(id)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this job request?')) {
      await deleteJobRequest(id)
    }
  }

  const formatSalary = (min?: number, max?: number, currency?: string) => {
    if (!min && !max) return 'Not specified'
    const curr = currency || 'USD'
    if (min && max) {
      return `${curr} ${min.toLocaleString()} - ${max.toLocaleString()}`
    }
    if (min) return `${curr} ${min.toLocaleString()}+`
    if (max) return `Up to ${curr} ${max.toLocaleString()}`
    return 'Not specified'
  }

  return (
    <div className="container mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Job Requests</h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-md">
          Manage job requests and approvals
        </p>
      </div>

      <PermissionGate 
        permission="canViewJobRequests"
        fallback={
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                You don't have permission to view job requests.
              </div>
            </CardContent>
          </Card>
        }
      >
        <JobRequestTable
          jobRequests={jobRequests}
          isLoading={isLoading}
          onView={handleView}
          onApprove={handleApprove}
          onDelete={handleDelete}
          onCreateNew={handleCreateNew}
        />
      </PermissionGate>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="mx-4 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request New Job</DialogTitle>
          </DialogHeader>
          <JobRequestForm
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
            isLoading={isLoading}
          />
        </DialogContent>
      </Dialog>

      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="mx-4 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Job Request Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-lg truncate">{selectedRequest.title}</h3>
                  <p className="text-sm text-muted-foreground">Level: {selectedRequest.level}</p>
                </div>
                <Badge variant={selectedRequest.status === 'pending' ? 'secondary' : selectedRequest.status === 'approved' ? 'default' : 'destructive'} className="self-start">
                  {selectedRequest.status}
                </Badge>
              </div>
              
              {selectedRequest.description && (
                <div>
                  <h4 className="font-medium">Description</h4>
                  <p className="text-sm leading-relaxed break-words">{selectedRequest.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Department:</span> 
                  <span className="ml-1 break-words">{selectedRequest.department || 'Not specified'}</span>
                </div>
                <div>
                  <span className="font-medium">Location:</span> 
                  <span className="ml-1 break-words">{selectedRequest.location || 'Not specified'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="font-medium">Salary Range:</span> 
                  <span className="ml-1 break-words">{formatSalary(selectedRequest.salary_min, selectedRequest.salary_max, selectedRequest.currency)}</span>
                </div>
                <div>
                  <span className="font-medium">Created:</span> 
                  <span className="ml-1">{new Date(selectedRequest.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {selectedRequest.notes && (
                <div>
                  <h4 className="font-medium">Notes</h4>
                  <p className="text-sm leading-relaxed break-words">{selectedRequest.notes}</p>
                </div>
              )}

              {selectedRequest.job_id && (
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-green-800 break-words">
                    ✅ This request has been approved and converted to a job (ID: {selectedRequest.job_id})
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
