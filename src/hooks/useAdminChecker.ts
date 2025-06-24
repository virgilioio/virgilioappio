
import { useAuth } from '@/contexts/AuthContext'

export function useAdminChecker() {
  const { userType, memberRole } = useAuth()

  const isPlatformAdmin = userType === 'platform_admin'
  const isWorkspaceOwner = memberRole === 'owner'

  return {
    isPlatformAdmin,
    isWorkspaceOwner,
  }
}
