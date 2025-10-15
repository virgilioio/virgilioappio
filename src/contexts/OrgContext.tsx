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
  const { ready, session, orgContext, forceRefresh } = useAuthBootstrap()
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
    // Force refresh the organization context from the database
    await forceRefresh()
  }

  const hasOrganizationContext = organizationId !== null

  return (
    <OrgContext.Provider
      value={{
        organizationId,
        role,
        userType,
        isLoading: !ready,
        hasOrganizationContext,
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
