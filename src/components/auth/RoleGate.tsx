import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePermissions, PermissionsState } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'

interface RoleGateProps {
  allowedRoles: (keyof PermissionsState)[]
  children: React.ReactNode
  fallback?: React.ReactNode
  redirectTo?: string
  accessDeniedMessage?: string
}

export function RoleGate({ 
  allowedRoles, 
  children, 
  fallback = null,
  redirectTo,
  accessDeniedMessage = 'You do not have permission to access this feature.'
}: RoleGateProps) {
  const permissions = usePermissions()
  const navigate = useNavigate()
  const { toast } = useToast()
  
  // Check if user has ANY of the allowed roles (OR logic)
  const hasAccess = allowedRoles.some(role => permissions[role] === true)
  
  useEffect(() => {
    if (!hasAccess && redirectTo) {
      toast({
        title: 'Access Denied',
        description: accessDeniedMessage,
        variant: 'destructive'
      })
      navigate(redirectTo)
    }
  }, [hasAccess, redirectTo, navigate, toast, accessDeniedMessage])
  
  if (hasAccess) {
    return <>{children}</>
  }
  
  if (fallback) {
    return <>{fallback}</>
  }
  
  return null
}
