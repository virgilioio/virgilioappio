import { supabase } from '@/lib/supabaseClient'

/**
 * Reliable sign-out helper with explicit cleanup
 * Prevents flaky logout behavior by force-clearing all auth tokens
 */
export async function safeSignOut() {
  if (import.meta.env.DEV) {
    console.debug('[SignOut] Starting safe sign-out...')
  }

  try {
    // 1) Call Supabase sign-out (v2 syntax)
    await supabase.auth.signOut({ scope: 'global' })
    
    if (import.meta.env.DEV) {
      console.debug('[SignOut] supabase.auth.signOut() completed')
    }
  } catch (e) {
    console.warn('[SignOut] signOut error (continuing with cleanup):', e)
  } finally {
    // 2) Force cleanup of all Supabase auth keys in localStorage
    // This prevents stale tokens from causing race conditions
    const keysToRemove: string[] = []
    
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase.auth') || key.startsWith('sb-')) {
        keysToRemove.push(key)
        localStorage.removeItem(key)
      }
    })

    if (import.meta.env.DEV) {
      console.debug('[SignOut] Removed localStorage keys:', keysToRemove)
      console.debug('[SignOut] Complete')
    }
  }
}
