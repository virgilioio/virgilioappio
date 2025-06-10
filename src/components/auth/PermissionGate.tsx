
import React from 'react'
import { usePermissions, PermissionsState } from '@/hooks/usePermissions'

interface PermissionGateProps {
  permission: keyof PermissionsState
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const permissions = usePermissions()
  const hasPermission = permissions[permission]
  
  if (hasPermission) {
    return <>{children}</>
  }
  
  return <>{fallback}</>
}
