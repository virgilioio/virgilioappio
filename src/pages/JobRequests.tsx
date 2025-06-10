
import { useState } from 'react'
import { useJobRequests } from '@/hooks/useJobRequests'
import { usePermissions } from '@/hooks/usePermissions'
import { JobRequestTable } from '@/components/job-requests/JobRequestTable'
import { JobRequestForm } from '@/components/job-requests/JobRequestForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { Card, CardContent } from '@/components/ui/card'

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

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Job Requests</h1>
        <p className="text-muted-foreground mt-2">
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
        <DialogContent className="max-w-2xl">
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Job Request Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">{selectedRequest.title}</h3>
                <p className="text-sm text-muted-foreground">Level: {selectedRequest.level}</p>
              </div>
              {selectedRequest.description && (
                <div>
                  <h4 className="font-medium">Description</h4>
                  <p className="text-sm">{selectedRequest.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Department:</span> {selectedRequest.department || 'Not specified'}
                </div>
                <div>
                  <span className="font-medium">Location:</span> {selectedRequest.location || 'Not specified'}
                </div>
                <div>
                  <span className="font-medium">Status:</span> {selectedRequest.status}
                </div>
                <div>
                  <span className="font-medium">Created:</span> {new Date(selectedRequest.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
