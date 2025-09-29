
import { createContext, useContext, useEffect, useState } from 'react'
import { User, AuthError, Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

interface AuthContextType {
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  organizationId: string | null
  hasOrganizationContext: boolean
  userType: string | null
  memberRole: string | null
  availableOrganizations: Array<{ id: string; name: string }> | null
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
  const [memberData, setMemberData] = useState<{
    user_type: string | null
    member_role: string | null
    organization_id: string | null
  }>({
    user_type: null,
    member_role: null,
    organization_id: null
  })
  const [availableOrganizations, setAvailableOrganizations] = useState<Array<{ id: string; name: string }> | null>(null)
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)

  // Use selected organization if available, otherwise fall back to member data
  const organizationId = selectedOrganizationId || memberData.organization_id
  const hasOrganizationContext = !!organizationId
  const userType = memberData.user_type
  const memberRole = memberData.member_role

  const fetchMemberData = async (userId: string) => {
    try {
      console.log('Fetching member data for user:', userId)
      const { data, error } = await supabase.rpc('get_user_member_data')
      
      if (error) {
        console.error('Error fetching member data:', error)
        setMemberData({
          user_type: 'guest',
          member_role: null,
          organization_id: null
        })
        return
      }

      console.log('Member data result:', data)
      
      if (data && data.length > 0) {
        const memberInfo = data[0]
        setMemberData({
          user_type: memberInfo.user_type,
          member_role: memberInfo.member_role,
          organization_id: memberInfo.organization_id
        })
        
        // For platform admins, fetch available organizations
        if (memberInfo.user_type === 'platform_admin') {
          await fetchAvailableOrganizations()
        }
      } else {
        setMemberData({
          user_type: 'guest',
          member_role: null,
          organization_id: null
        })
      }
    } catch (err) {
      console.error('Exception fetching member data:', err)
      setMemberData({
        user_type: 'guest',
        member_role: null,
        organization_id: null
      })
    }
  }

  const fetchAvailableOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('status', 'active')
        .order('name')

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

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.id)
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        setTimeout(() => {
          fetchMemberData(session.user.id)
        }, 0)
      } else {
        setMemberData({
          user_type: null,
          member_role: null,
          organization_id: null
        })
      }
      setIsLoading(false)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session?.user?.id)
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchMemberData(session.user.id)
      } else {
        setMemberData({
          user_type: null,
          member_role: null,
          organization_id: null
        })
      }
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

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
