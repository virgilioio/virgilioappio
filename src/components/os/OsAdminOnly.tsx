import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'

/**
 * People & Access is for workspace admins and platform admins. The database
 * refuses everyone else anyway (is_os_admin); this only keeps the screens away.
 */
export function OsAdminOnly({ children }: { children: ReactNode }) {
  const { isPlatformAdmin, isAdmin, hasOrganizationContext } = usePermissions()
  if (!isPlatformAdmin && !hasOrganizationContext) return null
  if (!isPlatformAdmin && !isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
