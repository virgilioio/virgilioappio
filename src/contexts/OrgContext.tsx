import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from './AuthContext'

interface OrgContextType {
  organizationId: string | null
  role: string | null
  userType: string | null
  isLoading: boolean
  hasOrganizationContext: boolean
  refreshOrgContext: () => Promise<void>
}

const OrgContext = createContext<OrgContextType | undefined>(undefined)

const PLATFORM_ADMIN_TYPE = 'platform_admin'

export function OrgContextProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const resolveOrgContext = async (retryCount = 0) => {
    const timestamp = new Date().toISOString()
    console.log(`[OrgContext ${timestamp}] Resolving org context (attempt ${retryCount + 1})`)
    
    if (!isAuthenticated || !user) {
      console.log(`[OrgContext ${timestamp}] No authenticated user`)
      setOrganizationId(null)
      setRole(null)
      setUserType(null)
      setIsLoading(false)
      return
    }

    // Session stability check: ensure user metadata is available
    const hasMetadata = user?.app_metadata || user?.user_metadata
    if (!hasMetadata && retryCount < 3) {
      console.log(`[OrgContext ${timestamp}] User metadata not ready, retrying in 200ms...`)
      setTimeout(() => resolveOrgContext(retryCount + 1), 200)
      return
    }

    // Platform admin bypass: check JWT metadata for immediate access
    const isPlatformAdmin = user?.app_metadata?.user_type === PLATFORM_ADMIN_TYPE || 
                           user?.user_metadata?.user_type === PLATFORM_ADMIN_TYPE
    
    console.log(`[OrgContext ${timestamp}] Platform admin check:`, {
      app_metadata_type: user?.app_metadata?.user_type,
      user_metadata_type: user?.user_metadata?.user_type,
      isPlatformAdmin,
      hasMetadata
    })

    if (isPlatformAdmin) {
      // For platform admins, still try to get their org context but don't block on it
      try {
        const { data, error } = await supabase.rpc('resolve_org_context')
        
        if (!error && data && data.length > 0) {
          const orgData = data[0]
          console.log(`[OrgContext ${timestamp}] Platform admin org context resolved:`, orgData)
          setOrganizationId(orgData.organization_id)
          setRole(orgData.role)
          setUserType(orgData.user_type || PLATFORM_ADMIN_TYPE)
        } else {
          // Platform admin with no org context - that's okay
          console.log(`[OrgContext ${timestamp}] Platform admin with no org context`)
          setOrganizationId(null)
          setRole('admin')
          setUserType(PLATFORM_ADMIN_TYPE)
        }
      } catch (err) {
        console.error(`[OrgContext ${timestamp}] Error resolving org context for platform admin:`, err)
        // Still allow platform admin through
        setOrganizationId(null)
        setRole('admin')
        setUserType(PLATFORM_ADMIN_TYPE)
      }
      setIsLoading(false)
      return
    }

    // Regular users: resolve from database
    try {
      const { data, error } = await supabase.rpc('resolve_org_context')
      
      if (error) {
        console.error(`[OrgContext ${timestamp}] Error resolving org context:`, error)
        
        // Retry on auth errors (session not stable yet)
        if (error.message?.includes('JWT') && retryCount < 3) {
          console.log(`[OrgContext ${timestamp}] Auth error, retrying in 300ms...`)
          setTimeout(() => resolveOrgContext(retryCount + 1), 300)
          return
        }
        
        setOrganizationId(null)
        setRole(null)
        setUserType(null)
      } else if (data && data.length > 0) {
        const orgData = data[0]
        console.log(`[OrgContext ${timestamp}] Org context resolved:`, orgData)
        setOrganizationId(orgData.organization_id)
        setRole(orgData.role)
        setUserType(orgData.user_type)
      } else {
        // No org context found
        console.log(`[OrgContext ${timestamp}] No org context found`)
        setOrganizationId(null)
        setRole(null)
        setUserType(null)
      }
    } catch (err) {
      console.error(`[OrgContext ${timestamp}] Exception resolving org context:`, err)
      setOrganizationId(null)
      setRole(null)
      setUserType(null)
    }

    setIsLoading(false)
  }

  // Initial load: wait for auth to be ready, then resolve org context
  useEffect(() => {
    if (authLoading) {
      return
    }
    
    resolveOrgContext()
  }, [isAuthenticated, user?.id, authLoading])

  const refreshOrgContext = async () => {
    setIsLoading(true)
    await resolveOrgContext()
  }

  const hasOrganizationContext = organizationId !== null

  return (
    <OrgContext.Provider
      value={{
        organizationId,
        role,
        userType,
        isLoading,
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
