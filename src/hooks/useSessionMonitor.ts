import { useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export function useSessionMonitor() {
  const checkSessionExpiry = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) return null
    
    const expiresAt = new Date(session.expires_at! * 1000)
    const now = new Date()
    const timeUntilExpiry = expiresAt.getTime() - now.getTime()
    
    // Warn if session expires in less than 10 minutes
    if (timeUntilExpiry > 0 && timeUntilExpiry < 10 * 60 * 1000) {
      const minutesLeft = Math.round(timeUntilExpiry / 1000 / 60)
      
      toast.warning(`Your session will expire in ${minutesLeft} minutes`, {
        id: 'session-warning',
        action: {
          label: 'Extend Session',
          onClick: async () => {
            const { error } = await supabase.auth.refreshSession()
            if (error) {
              toast.error('Failed to extend session. Please log in again.')
            } else {
              toast.success('Session extended successfully')
            }
          }
        }
      })
    }
    
    return timeUntilExpiry
  }, [])

  const refreshSession = useCallback(async () => {
    try {
      const { error } = await supabase.auth.refreshSession()
      if (error) {
        console.error('Session refresh failed:', error)
        toast.error('Session refresh failed. Please log in again.')
        return false
      }
      return true
    } catch (err) {
      console.error('Session refresh exception:', err)
      return false
    }
  }, [])

  useEffect(() => {
    // Check session expiry every 2 minutes
    const interval = setInterval(checkSessionExpiry, 2 * 60 * 1000)
    
    // Initial check
    checkSessionExpiry()
    
    return () => clearInterval(interval)
  }, [checkSessionExpiry])

  return { checkSessionExpiry, refreshSession }
}