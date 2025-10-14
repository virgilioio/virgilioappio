import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Session } from '@supabase/supabase-js'

interface AuthSyncMessage {
  type: 'session_update' | 'session_refresh' | 'signout'
  session: Session | null
  timestamp: number
  tabId: string
}

export function useMultiTabSync(onSessionUpdate?: (session: Session | null) => void) {
  const channelRef = useRef<BroadcastChannel | null>(null)
  const tabId = useRef(Math.random().toString(36).substring(7))
  const lastMessageTime = useRef(0)
  
  const broadcastSessionUpdate = useCallback((session: Session | null, type: AuthSyncMessage['type'] = 'session_update') => {
    if (!channelRef.current) return
    
    const message: AuthSyncMessage = {
      type,
      session,
      timestamp: Date.now(),
      tabId: tabId.current
    }
    
    try {
      channelRef.current.postMessage(message)
      console.log('📡 Broadcast to other tabs:', type)
    } catch (error) {
      console.error('Failed to broadcast session update:', error)
    }
  }, [])

  useEffect(() => {
    // Initialize BroadcastChannel for cross-tab communication
    try {
      channelRef.current = new BroadcastChannel('supabase-auth')
    } catch (error) {
      console.warn('BroadcastChannel not supported:', error)
      return
    }

    // Handle messages from other tabs
    const handleMessage = (event: MessageEvent<AuthSyncMessage>) => {
      const message = event.data
      
      // Ignore our own messages
      if (message.tabId === tabId.current) return
      
      // Prevent rapid-fire duplicate messages (within 100ms)
      if (Date.now() - lastMessageTime.current < 100) return
      lastMessageTime.current = Date.now()
      
      console.log('📥 Received from other tab:', message.type)
      
      // Update local session state based on message
      if (message.type === 'signout') {
        onSessionUpdate?.(null)
      } else if (message.session) {
        onSessionUpdate?.(message.session)
      }
    }

    channelRef.current.addEventListener('message', handleMessage)

    // Listen for storage events (fallback for older browsers)
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key?.includes('supabase.auth.token')) return
      
      console.log('💾 Storage change detected from another tab')
      
      // Prevent rapid-fire duplicate events
      if (Date.now() - lastMessageTime.current < 500) return
      lastMessageTime.current = Date.now()
      
      // Re-fetch the session
      setTimeout(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
          onSessionUpdate?.(session)
        })
      }, 0)
    }

    window.addEventListener('storage', handleStorageChange)

    // Set up auth state change listener to broadcast to other tabs
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state change:', event)
      
      // Broadcast to other tabs
      if (event === 'SIGNED_OUT') {
        broadcastSessionUpdate(null, 'signout')
      } else if (event === 'TOKEN_REFRESHED') {
        broadcastSessionUpdate(session, 'session_refresh')
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        broadcastSessionUpdate(session, 'session_update')
      }
    })

    return () => {
      subscription.unsubscribe()
      channelRef.current?.close()
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [onSessionUpdate, broadcastSessionUpdate])

  return {
    broadcastSessionUpdate,
    tabId: tabId.current
  }
}