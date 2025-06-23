import { useState } from 'react'
import { useJobRequestsWithOrganization } from '@/hooks/useJobRequestsWithOrganization'
import { useJobRequests } from '@/hooks/useJobRequests'
import { usePermissions } from '@/hooks/usePermissions'
import { useOrganizationProgress } from '@/hooks/useOrganizationProgress'
import { useAuth } from '@/contexts/AuthContext'
import { JobRequestTable } from '@/components/job-requests/JobRequestTable'
import { JobRequestForm } from '@/components/job-requests/JobRequestForm'
import { ComplianceCheckDialog } from '@/components/job-requests/ComplianceCheckDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { GuestRestriction } from '@/components/auth/GuestRestriction'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ListTodo } from 'lucide-react'

export default function JobRequests() {
  const { jobRequests, isLoading } = useJobRequestsWithOrganization()
  const { createJobRequest, approveJobRequest, deleteJobRequest } = useJobRequests()
  
  const permissions = usePermissions()
  const { userType } = useAuth()
  const organizationProgress = useOrganizationProgress()
  const [showForm, setShowForm] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showComplianceDialog, setShowComplianceDialog] = useState(false)

  const handleCreateNew = () => {
    // Check compliance for workspace owners
    if (userType === 'workspace_owner' && !organizationProgress.isComplete) {
      setShowComplianceDialog(true)
      return
    }
    
    setShowForm(true)
  }

  const handleFormSubmit = async (data: any) => {
    await createJobRequest.mutateAsync(data)
    setShowForm(false)
  }

  const handleFormCancel = () => {
    setShowForm(false)
  }

  const handleView = (request: any) => {
    setSelectedRequest(request)
  }

  const handleApprove = async (id: string) => {
    await approveJobRequest.mutateAsync(id)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this job request?')) {
      await deleteJobRequest.mutateAsync(id)
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
    <PermissionGate 
      permission="canViewJobRequests"
      fallback={
        <GuestRestriction 
          action="view job requests" 
          suggestion="Contact your administrator to request access to job request management."
        />
      }
    >
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
          <div className="mb-6 sm:mb-8 lg:mb-12">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <ListTodo className="h-6 w-6 sm:h-7 sm:w-7" />
              Job Requests
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-md">
              Manage job requests and approvals
            </p>
          </div>

          <JobRequestTable
            jobRequests={jobRequests}
            isLoading={isLoading}
            onView={handleView}
            onApprove={handleApprove}
            onDelete={handleDelete}
            onCreateNew={handleCreateNew}
          />

          <ComplianceCheckDialog
            open={showComplianceDialog}
            onOpenChange={setShowComplianceDialog}
            progress={organizationProgress.progress}
          />

          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogContent className="mx-4 max-w-5xl max-h-[95vh] overflow-y-auto">
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
                    <div className="sm:col-span-2">
                      <span className="font-medium">Organization:</span> 
                      <span className="ml-1 break-words">{selectedRequest.organization_name || 'Unknown Organization'}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="font-medium">Requested By:</span> 
                      <span className="ml-1 break-words">
                        {selectedRequest.requester_name || 'Unknown User'}
                        {selectedRequest.requester_email && ` (${selectedRequest.requester_email})`}
                      </span>
                    </div>
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
                    {selectedRequest.approved_at && (
                      <div>
                        <span className="font-medium">Approved:</span> 
                        <span className="ml-1">{new Date(selectedRequest.approved_at).toLocaleDateString()}</span>
                      </div>
                    )}
                    {selectedRequest.approver_role && (
                      <div>
                        <span className="font-medium">Approved by:</span> 
                        <span className="ml-1">{selectedRequest.approver_role}</span>
                      </div>
                    )}
                    {selectedRequest.agreement_id && (
                      <div className="sm:col-span-2">
                        <span className="font-medium">Agreement ID:</span> 
                        <span className="ml-1 break-words font-mono text-xs">{selectedRequest.agreement_id}</span>
                      </div>
                    )}
                  </div>

                  {selectedRequest.notes && (
                    <div>
                      <h4 className="font-medium">Notes</h4>
                      <p className="text-sm leading-relaxed break-words">{selectedRequest.notes}</p>
                    </div>
                  )}

                  {selectedRequest.processed_agreement_content && (
                    <div>
                      <h4 className="font-medium">Agreement Content (At Time of Submission)</h4>
                      <div className="border rounded-lg p-4 bg-muted/30 max-h-[300px] overflow-y-auto">
                        <div 
                          className="prose prose-sm max-w-none text-sm"
                          dangerouslySetInnerHTML={{ 
                            __html: selectedRequest.processed_agreement_content 
                          }}
                        />
                      </div>
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
      </div>
    </PermissionGate>
  )
}
