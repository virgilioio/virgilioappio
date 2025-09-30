
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, AuthError, Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { useSessionMonitor } from '@/hooks/useSessionMonitor'

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
  organizationId: string | null
  hasOrganizationContext: boolean
  userType: string | null
  memberRole: string | null
  availableOrganizations: OrganizationInfo[] | null
  isImpersonating: boolean
  switchOrganization: (organizationId: string) => Promise<void>
  login: (email: string, password: string) => Promise<{ error?: AuthError }>
  signUp: (email: string, password: string) => Promise<{ error?: AuthError }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Enable session monitoring
  useSessionMonitor()
  const [memberData, setMemberData] = useState<{
    user_type: string | null
    member_role: string | null
    organization_id: string | null
  }>({
    user_type: null,
    member_role: null,
    organization_id: null
  })
  const [availableOrganizations, setAvailableOrganizations] = useState<OrganizationInfo[] | null>(null)
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)
  const [sessionHealth, setSessionHealth] = useState<{
    lastRefresh: Date | null
    expiresAt: Date | null
    isValid: boolean
  }>({
    lastRefresh: null,
    expiresAt: null,
    isValid: false
  })

  // Use selected organization if available, otherwise fall back to member data
  const organizationId = selectedOrganizationId || memberData.organization_id
  const hasOrganizationContext = !!organizationId
  const userType = memberData.user_type
  const memberRole = memberData.member_role
  
  // Check if we're impersonating a customer (selected org is different from member org and is a SaaS customer)
  const isImpersonating = !!(selectedOrganizationId && 
    selectedOrganizationId !== memberData.organization_id &&
    availableOrganizations?.find(org => 
      org.id === selectedOrganizationId && 
      org.organization_type === 'client' && 
      org.tenant_type === 'saas'
    ))

  // Session validation and recovery
  const validateSession = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Session validation error:', error)
      setSessionHealth(prev => ({ ...prev, isValid: false }))
      return false
    }

    if (session) {
      const expiresAt = new Date(session.expires_at! * 1000)
      const isValid = expiresAt > new Date()
      
      setSessionHealth({
        lastRefresh: new Date(),
        expiresAt,
        isValid
      })

      console.log('Session validated:', {
        userId: session.user.id,
        expiresAt: expiresAt.toISOString(),
        isValid,
        timeUntilExpiry: Math.round((expiresAt.getTime() - Date.now()) / 1000 / 60) + ' minutes'
      })

      return isValid
    }

    setSessionHealth(prev => ({ ...prev, isValid: false }))
    return false
  }, [])

  const fetchMemberData = async (userId: string, retryCount = 0) => {
    const maxRetries = 3
    
    try {
      console.log(`[Session Debug] Fetching member data for user: ${userId} (attempt ${retryCount + 1})`)
      
      // Validate session before making the request
      const isSessionValid = await validateSession()
      if (!isSessionValid && retryCount === 0) {
        console.warn('[Session Debug] Session invalid, attempting refresh...')
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          console.error('[Session Debug] Session refresh failed:', refreshError)
          toast.error('Session expired. Please log in again.')
          return
        }
      }

      const { data, error } = await supabase.rpc('get_user_member_data')
      
      if (error) {
        console.error('[Session Debug] Error fetching member data:', error)
        
        // If auth error and we haven't retried, try session refresh
        if (error.message?.includes('JWT') && retryCount < maxRetries) {
          console.log('[Session Debug] JWT error detected, refreshing session and retrying...')
          const { error: refreshError } = await supabase.auth.refreshSession()
          if (!refreshError) {
            return fetchMemberData(userId, retryCount + 1)
          }
        }
        
        setMemberData({
          user_type: 'guest',
          member_role: null,
          organization_id: null
        })
        return
      }

      console.log('[Session Debug] Member data result:', data)
      
      if (data && data.length > 0) {
        const memberInfo = data[0]
        setMemberData({
          user_type: memberInfo.user_type,
          member_role: memberInfo.member_role,
          organization_id: memberInfo.organization_id
        })
        
        console.log('[Session Debug] Member data set successfully:', {
          userType: memberInfo.user_type,
          organizationId: memberInfo.organization_id
        })
        
        // For platform admins, fetch available organizations
        if (memberInfo.user_type === 'platform_admin') {
          await fetchAvailableOrganizations()
        }
      } else {
        console.warn('[Session Debug] No member data found, setting guest status')
        setMemberData({
          user_type: 'guest',
          member_role: null,
          organization_id: null
        })
      }
    } catch (err) {
      console.error('[Session Debug] Exception fetching member data:', err)
      
      // Retry logic for network errors
      if (retryCount < maxRetries && (err as Error).message?.includes('network')) {
        console.log(`[Session Debug] Network error, retrying in ${(retryCount + 1) * 1000}ms...`)
        setTimeout(() => fetchMemberData(userId, retryCount + 1), (retryCount + 1) * 1000)
        return
      }
      
      setMemberData({
        user_type: 'guest',
        member_role: null,
        organization_id: null
      })
    }
  }

  const fetchAvailableOrganizations = async () => {
    try {
      // For platform admins, fetch platform organization and SaaS customers only
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, organization_type, tenant_type')
        .eq('status', 'active')
        .or('organization_type.eq.platform,and(organization_type.eq.client,tenant_type.eq.saas)')
        .order('organization_type desc, name') // Platform first, then clients alphabetically

      if (error) {
        console.error('Error fetching organizations:', error)
        return
      }

      setAvailableOrganizations(data || [])
    } catch (err) {
      console.error('Exception fetching organizations:', err)
    }
  }

  const switchOrganization = async (organizationId: string) => {
    setSelectedOrganizationId(organizationId)
    
    // Update user metadata to persist the selection
    try {
      // For now, just store in local state - edge function can be added later if needed
      console.log('Organization switched to:', organizationId)
    } catch (error) {
      console.error('Error setting current organization:', error)
    }
  }

  // Session monitoring and recovery
  useEffect(() => {
    let sessionCheckInterval: NodeJS.Timeout

    const startSessionMonitoring = () => {
      // Check session health every 5 minutes
      sessionCheckInterval = setInterval(async () => {
        const isValid = await validateSession()
        if (!isValid && user) {
          console.warn('[Session Monitor] Session expired, attempting refresh...')
          const { error } = await supabase.auth.refreshSession()
          if (error) {
            console.error('[Session Monitor] Auto-refresh failed:', error)
            toast.error('Your session has expired. Please log in again.')
          }
        }
      }, 5 * 60 * 1000) // 5 minutes
    }

    if (user) {
      startSessionMonitoring()
    }

    return () => {
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval)
      }
    }
  }, [user, validateSession])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth State] Event: ${event}, User ID: ${session?.user?.id || 'none'}`)
      
      // Enhanced session state logging
      if (session) {
        const expiresAt = new Date(session.expires_at! * 1000)
        console.log(`[Auth State] Session details:`, {
          accessToken: session.access_token ? '***present***' : 'missing',
          refreshToken: session.refresh_token ? '***present***' : 'missing',
          expiresAt: expiresAt.toISOString(),
          timeUntilExpiry: Math.round((expiresAt.getTime() - Date.now()) / 1000 / 60) + ' minutes'
        })
      }
      
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        // Immediate validation and member data fetch
        setTimeout(() => {
          fetchMemberData(session.user.id)
        }, 0)
      } else {
        console.log('[Auth State] No session, clearing member data')
        setMemberData({
          user_type: null,
          member_role: null,
          organization_id: null
        })
        setSessionHealth({
          lastRefresh: null,
          expiresAt: null,
          isValid: false
        })
      }
      setIsLoading(false)
    })

    // Initial session check with retry logic
    const initializeSession = async () => {
      try {
        console.log('[Auth Init] Getting initial session...')
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('[Auth Init] Error getting session:', error)
          setIsLoading(false)
          return
        }

        console.log(`[Auth Init] Initial session: ${session?.user?.id || 'none'}`)
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          await validateSession()
          fetchMemberData(session.user.id)
        } else {
          setMemberData({
            user_type: null,
            member_role: null,
            organization_id: null
          })
        }
      } catch (err) {
        console.error('[Auth Init] Exception during initialization:', err)
      } finally {
        setIsLoading(false)
      }
    }

    initializeSession()

    return () => subscription.unsubscribe()
  }, [validateSession])

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
    await supabase.auth.signOut()
  }

  const value = {
    user,
    session,
    isAuthenticated: !!user,
    isLoading,
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
