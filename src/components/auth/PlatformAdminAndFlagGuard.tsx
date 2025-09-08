import React from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useFeatureFlag } from '@/hooks/useFeatureFlag'

interface PlatformAdminAndFlagGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  flagName?: string
}

export function PlatformAdminAndFlagGuard({ 
  children, 
  fallback = null,
  flagName = 'self_serve_admin_enabled'
}: PlatformAdminAndFlagGuardProps) {
  const { isPlatformAdmin } = usePermissions()
  const isFeatureEnabled = useFeatureFlag(flagName)
  
  const hasAccess = isPlatformAdmin && isFeatureEnabled
  
  if (hasAccess) {
    return <>{children}</>
  }
  
  return <>{fallback}</>
}