import { supabase } from '@/lib/supabaseClient'

/**
 * Wraps a Supabase operation with automatic auth retry on 401 errors
 * Handles expired access tokens by refreshing the session and retrying once
 */
export async function withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e: any) {
    // Check for auth errors: 401 status or PostgREST auth error codes
    const isAuthError = 
      e?.status === 401 || 
      e?.code === 'PGRST301' || // JWT expired
      e?.code === 'PGRST302' || // JWT invalid
      e?.message?.includes('JWT')
    
    if (isAuthError) {
      console.log('🔄 Auth error detected, refreshing session and retrying...')
      
      // Refresh the session
      const { error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError) {
        console.error('❌ Session refresh failed:', refreshError)
        throw new Error('Session expired. Please log in again.')
      }
      
      console.log('✅ Session refreshed, retrying operation...')
      
      // Retry the original operation with fresh token
      return await fn()
    }
    
    // Not an auth error, rethrow
    throw e
  }
}

/**
 * Type-safe wrapper for SELECT queries
 */
export async function withAuthRetrySelect<T>(
  query: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  return withAuthRetry(query)
}

/**
 * Type-safe wrapper for INSERT/UPDATE/DELETE mutations
 */
export async function withAuthRetryMutation<T>(
  mutation: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  return withAuthRetry(mutation)
}

/**
 * Type-safe wrapper for RPC calls
 */
export async function withAuthRetryRpc<T>(
  rpcCall: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  return withAuthRetry(rpcCall)
}

/**
 * Type-safe wrapper for Edge Function invocations
 */
export async function withAuthRetryEdgeFunction<T>(
  edgeFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  return withAuthRetry(edgeFn)
}
