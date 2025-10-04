import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { extractErrorMessage } from '@/lib/authUtils'

interface SessionDebugData {
  timestamp: string
  event: string
  details: any
  sessionState?: {
    hasSession: boolean
    expiresAt?: string
    userId?: string
  }
}

export function useSessionDebugger() {
  const debugLog = useRef<SessionDebugData[]>([])
  const storageListener = useRef<((e: StorageEvent) => void) | null>(null)

  const log = useCallback((event: string, details: any = {}) => {
    // Parse error details if present
    const parsedDetails = details?.error 
      ? { ...details, errorMessage: extractErrorMessage(details.error) }
      : details

    const logEntry: SessionDebugData = {
      timestamp: new Date().toISOString(),
      event,
      details: parsedDetails,
    }

    // Add current session state
    supabase.auth.getSession().then(({ data: { session } }) => {
      logEntry.sessionState = {
        hasSession: !!session,
        expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : undefined,
        userId: session?.user?.id,
      }
      
      debugLog.current.push(logEntry)
      
      // Keep only last 100 entries
      if (debugLog.current.length > 100) {
        debugLog.current = debugLog.current.slice(-100)
      }

      // Log critical events to console with enhanced error details
      if (['session_lost', 'storage_cleared', 'auth_error', 'network_error', 'postrest_error'].includes(event)) {
        console.error('🚨 Session Debug Alert:', {
          event,
          details: parsedDetails,
          sessionState: logEntry.sessionState
        })
        
        const errorMessage = parsedDetails?.errorMessage || JSON.stringify(parsedDetails, null, 2)
        toast.error(`Session Debug: ${event}`, {
          description: errorMessage,
          duration: 5000,
        })
      } else {
        console.log('🔍 Session Debug:', logEntry)
      }
    })
  }, [])

  // Monitor browser storage changes
  useEffect(() => {
    storageListener.current = (e: StorageEvent) => {
      if (e.key?.includes('supabase') || e.key?.includes('auth')) {
        log('storage_change', {
          key: e.key,
          oldValue: e.oldValue ? 'EXISTS' : null,
          newValue: e.newValue ? 'EXISTS' : null,
          url: e.url,
        })

        // Detect if Supabase auth token was cleared
        if (e.key?.includes('supabase') && e.oldValue && !e.newValue) {
          log('auth_token_cleared', {
            key: e.key,
            suspiciousClearing: true,
          })
        }
      }
    }

    window.addEventListener('storage', storageListener.current)
    log('debug_initialized', { userAgent: navigator.userAgent })

    return () => {
      if (storageListener.current) {
        window.removeEventListener('storage', storageListener.current)
      }
    }
  }, [log])

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => log('network_online', {})
    const handleOffline = () => log('network_offline', {})

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [log])

  // Periodic storage integrity check
  useEffect(() => {
    const checkStorageIntegrity = () => {
      try {
        const supabaseKeys = Object.keys(localStorage).filter(key => 
          key.includes('supabase') || key.includes('auth')
        )
        
        log('storage_integrity_check', {
          supabaseKeysCount: supabaseKeys.length,
          keys: supabaseKeys,
          localStorage: typeof Storage !== 'undefined',
          incognito: !window.localStorage || window.localStorage === null,
        })
      } catch (error) {
        log('storage_access_error', { error: error.message })
      }
    }

    // Check immediately and then every 30 seconds
    checkStorageIntegrity()
    const interval = setInterval(checkStorageIntegrity, 30000)

    return () => clearInterval(interval)
  }, [log])

  // Detect browser environment issues
  useEffect(() => {
    const detectEnvironment = () => {
      const isIncognito = !window.localStorage || 
        (() => {
          try {
            localStorage.setItem('test', 'test')
            localStorage.removeItem('test')
            return false
          } catch {
            return true
          }
        })()

      log('environment_detection', {
        isIncognito,
        cookiesEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        userAgent: navigator.userAgent,
        origin: window.location.origin,
        protocol: window.location.protocol,
      })
    }

    detectEnvironment()
  }, [log])

  const getDebugReport = useCallback(() => {
    return {
      logs: debugLog.current,
      summary: {
        totalEvents: debugLog.current.length,
        sessionLossEvents: debugLog.current.filter(log => 
          ['session_lost', 'auth_token_cleared', 'auth_error'].includes(log.event)
        ).length,
        lastEvent: debugLog.current[debugLog.current.length - 1],
      }
    }
  }, [])

  const clearDebugLog = useCallback(() => {
    debugLog.current = []
    log('debug_log_cleared', {})
  }, [log])

  return {
    log,
    getDebugReport,
    clearDebugLog,
  }
}
