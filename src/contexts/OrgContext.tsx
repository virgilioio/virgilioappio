import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

interface OrgContextType {
  organizationId: string | null
  role: string | null
  userType: string | null
  isLoading: boolean
  hasOrganizationContext: boolean
  refreshOrgContext: () => Promise<void>
}

const OrgContext = createContext<OrgContextType | undefined>(undefined)

export function OrgContextProvider({ children }: { children: React.ReactNode }) {
  const { ready, session, orgContext } = useAuthBootstrap()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [userType, setUserType] = useState<string | null>(null)

  // Update state when bootstrap completes
  useEffect(() => {
    if (ready) {
      setOrganizationId(orgContext?.organizationId || null)
      setRole(orgContext?.role || null)
      setUserType(orgContext?.userType || null)
    }
  }, [ready, orgContext])

  const refreshOrgContext = async () => {
    // Refresh is handled by auth state changes in useAuthBootstrap
    // This is a no-op for now, but kept for API compatibility
  }

  const hasOrganizationContext = organizationId !== null
  const isPlatformAdmin = userType === 'platform_admin'

  return (
    <OrgContext.Provider
      value={{
        organizationId,
        role,
        userType,
        isLoading: !ready,
        hasOrganizationContext: hasOrganizationContext || isPlatformAdmin,
        refreshOrgContext,
      }}
    >
      {children}
    </OrgContext.Provider>
  )
}

export function useOrgContext() {
  const context = useContext(OrgContext)
  if (context === undefined) {
    throw new Error('useOrgContext must be used within an OrgContextProvider')
  }
  return context
}
