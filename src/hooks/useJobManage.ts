import { usePermissions } from '@/hooks/usePermissions'
import { useJobRole } from '@/hooks/useJobRole'

export type JobSeat = 'sourcer' | 'recruiter' | 'hiring_manager' | 'interviewer'

/**
 * Who manages a job (mirrors can_manage_job / can_manage_job_team in the
 * database): admins and the job's Recruiter run its setup, hiring plan, team,
 * client view and notifications. Recruiter and Sourcer seats (hire credit and
 * commissions) and the offer approval chain stay with admins.
 */
export function useJobManage(jobId: string | undefined) {
  const { isAdmin, isWorkspaceOwner, isPlatformAdmin } = usePermissions()
  const { isRecruiterOnJob, isLoading } = useJobRole(jobId)
  const isJobAdmin = isAdmin || isWorkspaceOwner || isPlatformAdmin
  const canManageJob = isJobAdmin || isRecruiterOnJob
  const assignableSeats: JobSeat[] = isJobAdmin
    ? ['sourcer', 'recruiter', 'hiring_manager', 'interviewer']
    : canManageJob
      ? ['hiring_manager', 'interviewer']
      : []
  return {
    isJobAdmin,
    canManageJob,
    /** Changing or removing a seat of this role. */
    canManageSeat: (role: string) => assignableSeats.includes(role as JobSeat),
    assignableSeats,
    isLoading: !isJobAdmin && isLoading,
  }
}
