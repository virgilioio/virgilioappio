import { Outlet } from 'react-router-dom'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { useAuth } from '@/contexts/AuthContext'
import { BrandDot } from '@/components/ui/BrandDot'
import { LockedScreen } from './LockedScreen'

/**
 * Wraps the routes that sit outside BillingGuard (/settings and
 * /settings/platform/saas-customers/:id). A closed (locked) workspace sees the
 * LockedScreen here too, so Settings never opens on its own.
 */
export function SettingsLockGuard() {
  const { memberRole, userType } = useAuth()
  const { data: billing, isLoading } = useBillingStatus()

  // Platform admins never blocked
  if (userType === 'platform_admin') {
    return <Outlet />
  }

  // Members (non-admin) are never blocked — limited scoped access only
  if (memberRole === 'member') {
    return <Outlet />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <BrandDot size="sm" message="Checking billing status..." />
      </div>
    )
  }

  if (billing?.billing_status === 'locked') {
    return <LockedScreen status="locked" />
  }

  return <Outlet />
}
