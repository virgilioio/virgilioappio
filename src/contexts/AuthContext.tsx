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
  const lastUserIdRef = useRef<string | null>(null)
  const { toast } = useToast()

  // Get user type, role, and org from bootstrap data (single source of truth)
  const organizationId = orgContext?.organizationId || null
  const hasOrganizationContext = !!organizationId
  const userType = orgContext?.userType || null
  const memberRole = orgContext?.role || null
  
  // userTypeLoading: true until orgContext is fully resolved (prevents race condition on cold boot)
  const userTypeLoading = !ready || (!!session && orgContext === null)

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
