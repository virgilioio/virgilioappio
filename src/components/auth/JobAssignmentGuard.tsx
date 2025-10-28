
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
    // Skip check for platform admins, workspace owners, and internal team members (from DB context)
    if (permissions.isPlatformAdmin || permissions.isWorkspaceOwner || permissions.isAdmin || permissions.isRecruiter) {
      return
    }

    // For hiring managers and interviewers, check if they're assigned to this job
    if ((permissions.isHiringManager || permissions.isInterviewer) && !isLoading && !isAssigned && jobId) {
      console.warn('User attempted to access unassigned job:', jobId)
      navigate('/jobs', { replace: true })
    }

    // For users without organization context, redirect to jobs list
    if (!permissions.hasOrganizationContext && !permissions.isPlatformAdmin) {
      navigate('/jobs', { replace: true })
    }
  }, [permissions, isAssigned, isLoading, jobId, navigate, user])

  // Show loading state while checking assignment
  if (isLoading && (permissions.isHiringManager || permissions.isInterviewer)) {
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
