import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import { log } from '@/lib/logger'
import { extractErrorMessage } from '@/lib/authUtils'
import { withTimeout, withRetry } from '@/utils/timeout'

const VIRGILIO_ORG_ID = '5ba7b145-f251-4b18-8900-724cb06028ab';

interface OrganizationInfo {
  id: string
  name: string
  organization_type?: string
  tenant_type?: string
}

interface AuthContextType {
  user: User | null
  userId: string | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  userTypeLoading: boolean
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
  const lastUserIdRef = useRef<string | null>(null)
  const { toast } = useToast()

  // Get user type, role, and org from bootstrap data (single source of truth)
  const organizationId = selectedOrganizationId || orgContext?.organizationId || null
  const hasOrganizationContext = !!organizationId
  const userType = orgContext?.userType || null
  const memberRole = orgContext?.role || null
  
  // userTypeLoading: true until orgContext is fully resolved (prevents race condition on cold boot)
  const userTypeLoading = !ready || (!!session && orgContext === null)
  
  // Check if we're impersonating a customer
  const isImpersonating = !!(selectedOrganizationId && 
    selectedOrganizationId !== orgContext?.organizationId &&
    availableOrganizations?.find(org => 
      org.id === selectedOrganizationId && 
      org.organization_type === 'client' && 
      org.tenant_type === 'saas'
    ))

  // Update user only when the user ID changes (prevents refetches on tab focus)
  useEffect(() => {
    const nextUser = session?.user ?? null
    const nextId = nextUser?.id ?? null

    if (lastUserIdRef.current !== nextId) {
      lastUserIdRef.current = nextId
      setUser(nextUser)
    }
    // else: same user ID → keep existing `user` object to preserve reference stability
  }, [session])

  // Fetch available organizations for platform admins
  const fetchAvailableOrganizations = useCallback(async () => {
    try {
      const { data, error } = await withTimeout(
        withRetry(async () => {
          return await supabase
            .from('organizations')
            .select('id, name, organization_type, tenant_type, parent_organization_id')
            .eq('status', 'active')
            .or(`organization_type.eq.platform,and(organization_type.eq.client,tenant_type.eq.saas),and(organization_type.eq.client,tenant_type.eq.internal,parent_organization_id.eq.${VIRGILIO_ORG_ID})`)
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
    // Platform admins can now switch between platform and workspace contexts
    try {
      // Set organization in JWT metadata with timeout
      const setOrgPromise = supabase.functions.invoke('set-current-organization', {
        body: { organizationId }
      });
      
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Set org timeout')), 8000)
      );
      
      const { error: setOrgError } = await Promise.race([setOrgPromise, timeout]) as any;
      
      if (setOrgError) {
        throw new Error(`Failed to set organization: ${setOrgError.message}`);
      }

      // Refresh session to get updated JWT
      const { error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        throw new Error(`Failed to refresh session: ${refreshError.message}`);
      }

      // Update local state
      setSelectedOrganizationId(organizationId);
      log.info('✅ Organization switched to:', organizationId);
      
      toast({
        title: "Organization switched",
        description: "Your workspace has been updated.",
      });
    } catch (error: any) {
      log.error('Failed to switch organization:', error);
      toast({
        title: "Error switching organization",
        description: extractErrorMessage(error),
        variant: "destructive",
      });
    }
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
      
      // 1) ✅ Use reliable sign-out with explicit cleanup
      const { safeSignOut } = await import('@/lib/authHelpers')
      await safeSignOut()
      
      // 2) Clear local organization state immediately
      setSelectedOrganizationId(null)
      setAvailableOrganizations([])
      
      // 3) ✅ Tiny delay to let onAuthStateChange propagate
      await new Promise(resolve => setTimeout(resolve, 50))
      
    } catch (err) {
      log.error('[AuthContext] Logout error:', err)
      toast({
        title: "Error",
        description: extractErrorMessage(err),
        variant: "destructive",
      })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const userId = user?.id ?? null

  const value = {
    user,
    userId,
    session,
    isAuthenticated: !!user,
    isLoading,
    userTypeLoading,
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
