import { useRecruiterUserIds } from '@/hooks/useRecruiterUserIds'

/**
 * Determines whether assigning a user as a recruiter would convert them
 * from a free collaborator to a paid seat.
 *
 * A user is "currently free" when:
 * - system_role is 'member' (not admin/owner — those are always paid)
 * - They have zero existing recruiter assignments
 */
export function useWouldUpgradeSeat() {
  const { recruiterUserIds, isLoading } = useRecruiterUserIds()

  const wouldUpgrade = (
    userId: string | null | undefined,
    systemRole: string | undefined,
    userType?: string
  ): boolean => {
    if (!userId) return false
    // Admins and owners are already paid seats
    if (systemRole === 'admin' || userType === 'workspace_owner') return false
    // Already a recruiter on some job → already a paid seat
    if (recruiterUserIds.has(userId)) return false
    return true
  }

  const paidSeatCount = recruiterUserIds.size

  return { wouldUpgrade, paidSeatCount, isLoading }
}
