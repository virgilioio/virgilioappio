import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import { withTimeout, withRetry } from '@/utils/timeout'

interface OrganizationInfo {
  id: string
  name: string
  organization_type?: string
  tenant_type?: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  isLoggingOut: boolean
  organizationId: string | null
  hasOrganizationContext: boolean
  userType: string | null
  memberRole: string | null
  availableOrganizations: OrganizationInfo[] | null
  isImpersonating: boolean
  switchOrganization: (organizationId: string) => Promise<void>
  login: (email: string, password: string) => Promise<{ error?: any }>
  signUp: (email: string, password: string) => Promise<{ error?: any }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { ready, session, orgContext } = useAuthBootstrap()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [availableOrganizations, setAvailableOrganizations] = useState<OrganizationInfo[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)
  const { toast } = useToast()

  // Get user type, role, and org from bootstrap data (single source of truth)
  const organizationId = selectedOrganizationId || orgContext?.organizationId || null
  const hasOrganizationContext = !!organizationId
  const userType = orgContext?.userType || null
  const memberRole = orgContext?.role || null
  
  // Check if we're impersonating a customer
  const isImpersonating = !!(selectedOrganizationId && 
    selectedOrganizationId !== orgContext?.organizationId &&
    availableOrganizations?.find(org => 
      org.id === selectedOrganizationId && 
      org.organization_type === 'client' && 
      org.tenant_type === 'saas'
    ))

  // Update user when session changes
  useEffect(() => {
    setUser(session?.user ?? null)
  }, [session])

  // Fetch available organizations for platform admins
  const fetchAvailableOrganizations = useCallback(async () => {
    try {
      const { data, error } = await withTimeout(
        withRetry(async () => {
          return await supabase
            .from('organizations')
            .select('id, name, organization_type, tenant_type')
            .eq('status', 'active')
            .or('organization_type.eq.platform,and(organization_type.eq.client,tenant_type.eq.saas)')
            .order('organization_type', { ascending: false })
            .order('name', { ascending: true })
        }, 2, 500),
        5000,
        'Failed to fetch organizations'
      );

      if (error) {
        console.error('Error fetching organizations:', error)
        return
      }

      setAvailableOrganizations(data || [])
    } catch (err) {
      console.error('Exception fetching organizations:', err);
      setAvailableOrganizations([]);
    }
  }, [])

  const switchOrganization = async (organizationId: string) => {
    setSelectedOrganizationId(organizationId)
    console.log('Organization switched to:', organizationId)
  }

  // Fetch available organizations for platform admins when bootstrap completes
  useEffect(() => {
    if (ready && orgContext?.userType === 'platform_admin') {
      fetchAvailableOrganizations()
    }
  }, [ready, orgContext?.userType, fetchAvailableOrganizations])

  // Set loading to false when bootstrap is ready
  useEffect(() => {
    if (ready) {
      setIsLoading(false)
    }
  }, [ready])

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    })
    return { error }
  }

  const logout = async () => {
    if (isLoggingOut) return

    try {
      setIsLoggingOut(true)
      
      // Clear local state immediately
      setSelectedOrganizationId(null)
      setAvailableOrganizations([])
      
      // Attempt sign out
      const { error } = await supabase.auth.signOut()
      
      if (error && !error.message?.includes('session_not_found')) {
        throw error
      }
    } catch (err) {
      console.error('Logout error:', err)
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const value = {
    user,
    session,
    isAuthenticated: !!user,
    isLoading,
    isLoggingOut,
    organizationId,
    hasOrganizationContext,
    userType,
    memberRole,
    availableOrganizations,
    isImpersonating,
    switchOrganization,
    login,
    signUp,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
