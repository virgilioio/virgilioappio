import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Session } from '@supabase/supabase-js'
import { log } from '@/lib/logger'

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
  const lastTokenValue = useRef<string | null>(null)
  
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
      log.debug('📡 Broadcast to other tabs:', type)
    } catch (error) {
      log.error('Failed to broadcast session update:', error)
    }
  }, [])

  useEffect(() => {
    // Initialize BroadcastChannel for cross-tab communication
    try {
      channelRef.current = new BroadcastChannel('supabase-auth')
    } catch (error) {
      log.warn('BroadcastChannel not supported:', error)
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
      
      log.debug('📥 Received from other tab:', message.type)
      
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
      
      // Only react if the token value actually changed
      if (e.newValue === lastTokenValue.current) return
      lastTokenValue.current = e.newValue
      
      log.debug('💾 Storage change detected from another tab')
      
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
      log.debug('🔐 Auth state change:', event)
      
      // Only broadcast events that other tabs MUST know about
      // SIGNED_IN events are already synced via storage events and handled by useAuthBootstrap
      if (event === 'SIGNED_OUT') {
        broadcastSessionUpdate(null, 'signout')
      } else if (event === 'TOKEN_REFRESHED') {
        broadcastSessionUpdate(session, 'session_refresh')
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


/**
 * The same cross-tab sync without React, started once per tab by the shared
 * auth bootstrap (2026-10-17). Returns a function that stops it.
 */
export function startMultiTabSync(onSessionUpdate: (session: Session | null) => void): () => void {
  const tabId = Math.random().toString(36).substring(7)
  let lastMessageTime = 0
  let lastTokenValue: string | null = null
  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel('supabase-auth')
  } catch (error) {
    log.warn('BroadcastChannel not supported:', error)
  }

  const broadcast = (session: Session | null, type: AuthSyncMessage['type']) => {
    if (!channel) return
    try {
      channel.postMessage({ type, session, timestamp: Date.now(), tabId } satisfies AuthSyncMessage)
      log.debug('📡 Broadcast to other tabs:', type)
    } catch (error) {
      log.error('Failed to broadcast session update:', error)
    }
  }

  const handleMessage = (event: MessageEvent<AuthSyncMessage>) => {
    const message = event.data
    if (message.tabId === tabId) return
    if (Date.now() - lastMessageTime < 100) return
    lastMessageTime = Date.now()
    log.debug('📥 Received from other tab:', message.type)
    if (message.type === 'signout') onSessionUpdate(null)
    else if (message.session) onSessionUpdate(message.session)
  }
  channel?.addEventListener('message', handleMessage)

  const handleStorageChange = (e: StorageEvent) => {
    if (!e.key?.includes('supabase.auth.token')) return
    if (e.newValue === lastTokenValue) return
    lastTokenValue = e.newValue
    log.debug('💾 Storage change detected from another tab')
    if (Date.now() - lastMessageTime < 500) return
    lastMessageTime = Date.now()
    setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => onSessionUpdate(session))
    }, 0)
  }
  window.addEventListener('storage', handleStorageChange)

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') broadcast(null, 'signout')
    else if (event === 'TOKEN_REFRESHED') broadcast(session, 'session_refresh')
  })

  return () => {
    subscription.unsubscribe()
    channel?.close()
    window.removeEventListener('storage', handleStorageChange)
  }
}
