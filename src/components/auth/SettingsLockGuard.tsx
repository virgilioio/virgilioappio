import { Outlet } from 'react-router-dom'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { useAuth } from '@/contexts/AuthContext'
import { BrandDot } from '@/components/ui/BrandDot'
import { LockedScreen } from './LockedScreen'

/**
 * Wraps the few routes (/billing, /settings, /settings/platform/saas-customers/:id)
 * that sit OUTSIDE BillingGuard so users can normally reach billing to recover.
 *
 * When a tenant is in the `locked` state, those routes must also render the
 * LockedScreen — otherwise a locked user could press "Back" in Stripe Checkout
 * and land on a fully usable Settings shell.
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
