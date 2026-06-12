import { ReactNode } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { useAuth } from '@/contexts/AuthContext'
import { BrandDot } from '@/components/ui/BrandDot'
import { LockedScreen } from './LockedScreen'

interface BillingGuardProps {
  children?: ReactNode
  requireActive?: boolean // If true, blocks for past_due/canceled too
  fallbackMessage?: string
}

export function BillingGuard({
  children,
  requireActive = false,
}: BillingGuardProps) {
  const { memberRole, userType } = useAuth()
  const { data: billing, isLoading } = useBillingStatus()

  // Platform admins never blocked
  if (userType === 'platform_admin') {
    return <>{children || <Outlet />}</>
  }

  // Members (non-admin) are never blocked — they have limited access via job assignments
  if (memberRole === 'member') {
    return <>{children || <Outlet />}</>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <BrandDot size="sm" message="Checking billing status..." />
      </div>
    )
  }

  // Redirect pending_trial users to trial activation page (CC wall)
  if (billing?.billing_status === 'pending_trial') {
    return <Navigate to="/trial-activation" replace />
  }

  // Determine if user is blocked.
  // Allow access during grace_period, only block when locked (or past_due/canceled when requireActive)
  const isBlocked = requireActive
    ? !['trialing', 'active', 'grace_period'].includes(billing?.billing_status || '')
    : billing?.billing_status === 'locked'

  if (isBlocked) {
    return <LockedScreen status={billing?.billing_status || 'locked'} />
  }

  // Support both direct children and Outlet (for Route element usage)
  return <>{children || <Outlet />}</>
}
