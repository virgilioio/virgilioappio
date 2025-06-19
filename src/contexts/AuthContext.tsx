
import { createContext, useContext, useEffect, useState } from 'react'
import { User, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  organizationId: string | null
  hasOrganizationContext: boolean
  userType: string | null
  memberRole: string | null
  login: (email: string, password: string) => Promise<{ error?: AuthError }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
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

  // Derived values
  const organizationId = memberData.organization_id
  const hasOrganizationContext = !!organizationId
  const userType = memberData.user_type
  const memberRole = memberData.member_role

  const fetchMemberData = async (userId: string) => {
    try {
      console.log('Fetching member data for user:', userId)
      const { data, error } = await supabase.rpc('get_user_member_data')
      
      if (error) {
        console.error('Error fetching member data:', error)
        // Set default values if query fails
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
      } else {
        // User has no member record, set as guest
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

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
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

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        // Defer member data fetch to avoid recursion
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

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    organizationId,
    hasOrganizationContext,
    userType,
    memberRole,
    login,
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
