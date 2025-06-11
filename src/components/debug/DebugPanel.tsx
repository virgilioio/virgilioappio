
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bug, X, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useMembers } from '@/hooks/useMembers'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useJobs } from '@/hooks/useJobs'
import { useCandidates } from '@/hooks/useCandidates'
import { useJobRequests } from '@/hooks/useJobRequests'
import { useCandidateComments } from '@/hooks/useCandidateComments'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useInvoices } from '@/hooks/useInvoices'

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const location = useLocation()
  const { user, organizationId } = useAuth()
  const permissions = usePermissions()
  const { members } = useMembers()
  const { organizations } = useOrganizations()
  const { jobs } = useJobs()
  const { jobRequests } = useJobRequests()
  const { invoices } = useInvoices()
  const { profile } = useUserProfile()
  
  // Extract job ID from current route if on job detail page
  const jobId = location.pathname.startsWith('/jobs/') ? location.pathname.split('/')[2] : undefined
  
  // Only call useCandidates when we have a valid jobId
  const { candidates } = useCandidates(jobId || '')
  
  // Get comments for the first candidate if we're on a job detail page
  const firstCandidateId = candidates.length > 0 ? candidates[0].id : undefined
  const { comments } = useCandidateComments(firstCandidateId)

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0) || ''
    const last = lastName?.charAt(0) || ''
    return (first + last).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'
  }

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50"
        size="icon"
        variant="outline"
      >
        <Bug className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 max-h-96 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Debug Panel</CardTitle>
          <div className="flex gap-1">
            <Button
              onClick={() => setIsMinimized(!isMinimized)}
              size="icon"
              variant="ghost"
              className="h-6 w-6"
            >
              {isMinimized ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </Button>
            <Button
              onClick={() => setIsOpen(false)}
              size="icon"
              variant="ghost"
              className="h-6 w-6"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {!isMinimized && (
        <CardContent className="pt-0 text-xs space-y-3 max-h-80 overflow-y-auto">
          <div>
            <h4 className="font-semibold mb-1">User Info</h4>
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="text-xs">
                  {getInitials(profile?.first_name, profile?.last_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">
                  {profile?.first_name && profile?.last_name 
                    ? `${profile.first_name} ${profile.last_name}`
                    : user?.email
                  }
                </p>
                {profile?.title && (
                  <p className="text-muted-foreground">{profile.title}</p>
                )}
              </div>
            </div>
            <p>Email: {user?.email}</p>
            <p>ID: {user?.id}</p>
            <p>Type: {user?.user_metadata?.user_type || 'guest'}</p>
            <p>Role: {user?.user_metadata?.member_role || 'member'}</p>
            <p>Org ID: {organizationId || 'None'}</p>
            <p>Has Org Context: {permissions.hasOrganizationContext ? 'Yes' : 'No'}</p>
            {profile?.timezone && <p>Timezone: {profile.timezone}</p>}
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-1">Data Counts</h4>
            <p>Organizations: {organizations.length}</p>
            <p>Members: {members.length}</p>
            <p>Jobs: {jobs.length}</p>
            <p>Job Requests: {jobRequests.length}</p>
            <p>Invoices: {invoices.length}</p>
            {jobId && (
              <>
                <p>Candidates: {candidates.length}</p>
                <p>Comments: {comments.length}</p>
                {firstCandidateId && (
                  <p>Candidate ID: {firstCandidateId.slice(0, 8)}...</p>
                )}
              </>
            )}
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-1">Core Permissions</h4>
            <div className="flex flex-wrap gap-1">
              <Badge variant={permissions.isPlatformAdmin ? "default" : "secondary"}>
                Platform Admin
              </Badge>
              <Badge variant={permissions.isWorkspaceOwner ? "default" : "secondary"}>
                Workspace Owner
              </Badge>
              <Badge variant={permissions.isMember ? "default" : "secondary"}>
                Member
              </Badge>
              <Badge variant={permissions.isClient ? "default" : "secondary"}>
                Client
              </Badge>
              <Badge variant={permissions.isGuest ? "default" : "secondary"}>
                Guest
              </Badge>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-1">Billing Permissions</h4>
            <div className="flex flex-wrap gap-1">
              <Badge variant={permissions.canViewBilling ? "default" : "secondary"}>
                View Billing
              </Badge>
              <Badge variant={permissions.canViewInvoices ? "default" : "secondary"}>
                View Invoices
              </Badge>
              <Badge variant={permissions.canManageInvoices ? "default" : "secondary"}>
                Manage Invoices
              </Badge>
              <Badge variant={permissions.canUploadInvoicePDFs ? "default" : "secondary"}>
                Upload PDFs
              </Badge>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-1">Job Permissions</h4>
            <div className="flex flex-wrap gap-1">
              <Badge variant={permissions.canViewJobs ? "default" : "secondary"}>
                View Jobs
              </Badge>
              <Badge variant={permissions.canCreateJobs ? "default" : "secondary"}>
                Create Jobs
              </Badge>
              <Badge variant={permissions.canEditJobs ? "default" : "secondary"}>
                Edit Jobs
              </Badge>
              <Badge variant={permissions.canArchiveJobs ? "default" : "secondary"}>
                Archive Jobs
              </Badge>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-1">Job Request Permissions</h4>
            <div className="flex flex-wrap gap-1">
              <Badge variant={permissions.canViewJobRequests ? "default" : "secondary"}>
                View Job Requests
              </Badge>
              <Badge variant={permissions.canManageJobRequests ? "default" : "secondary"}>
                Manage Job Requests
              </Badge>
              <Badge variant={permissions.canApproveJobRequests ? "default" : "secondary"}>
                Approve Job Requests
              </Badge>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-1">Member Permissions</h4>
            <div className="flex flex-wrap gap-1">
              <Badge variant={permissions.canViewMembers ? "default" : "secondary"}>
                View Members
              </Badge>
              <Badge variant={permissions.canManageMembers ? "default" : "secondary"}>
                Manage Members
              </Badge>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-1">Candidate Permissions</h4>
            <div className="flex flex-wrap gap-1">
              <Badge variant={permissions.canViewCandidates ? "default" : "secondary"}>
                View Candidates
              </Badge>
              <Badge variant={permissions.canManageCandidates ? "default" : "secondary"}>
                Manage Candidates
              </Badge>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
