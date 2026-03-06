
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsAssignedToJob } from '@/hooks/useIsAssignedToJob'
import { Skeleton } from '@/components/ui/skeleton'

interface JobAssignmentGuardProps {
  children: React.ReactNode
}

export function JobAssignmentGuard({ children }: JobAssignmentGuardProps) {
  const { id: jobId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const permissions = usePermissions()
  const { isAssigned, isLoading } = useIsAssignedToJob(jobId || '')

  useEffect(() => {
    // Skip check for platform admins, workspace owners, and admins (they see all jobs)
    if (permissions.isPlatformAdmin || permissions.isWorkspaceOwner || permissions.isAdmin) {
      return
    }

    // For regular members, check if they're assigned to this job
    if (permissions.isMember && !isLoading && !isAssigned && jobId) {
      console.warn('User attempted to access unassigned job:', jobId)
      navigate('/jobs', { replace: true })
    }

    // For users without organization context, redirect to jobs list
    if (!permissions.hasOrganizationContext && !permissions.isPlatformAdmin) {
      navigate('/jobs', { replace: true })
    }
  }, [permissions, isAssigned, isLoading, jobId, navigate, user])

  // Show loading state while checking assignment for regular members
  if (isLoading && permissions.isMember && !permissions.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-lg px-md">
          <div className="flex items-center justify-center py-xl">
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
