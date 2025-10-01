import { supabase } from '@/lib/supabaseClient'

/**
 * Extract meaningful error details from Supabase errors
 * Prevents errors from collapsing to generic "Object" messages
 */
export function parseSupabaseError(error: any): string {
  if (!error) return 'Unknown error occurred'
  
  // Handle string errors
  if (typeof error === 'string') return error
  
  // Extract PostgREST error details
  if (error.code) {
    const errorMap: Record<string, string> = {
      'PGRST301': 'JWT token expired',
      'PGRST302': 'JWT token invalid',
      'PGRST116': 'Row level security policy violation',
      '23505': 'Duplicate key violation',
      '23503': 'Foreign key constraint violation',
      '42501': 'Insufficient privileges'
    }
    
    const knownError = errorMap[error.code]
    if (knownError) {
      return `${knownError}${error.message ? `: ${error.message}` : ''}`
    }
  }
  
  // Extract message from various error formats
  if (error.message) return error.message
  if (error.error_description) return error.error_description
  if (error.msg) return error.msg
  
  // Fallback: stringify but limit length
  try {
    const str = JSON.stringify(error)
    return str.length > 200 ? `${str.slice(0, 200)}...` : str
  } catch {
    return 'Error details unavailable'
  }
}

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
      const errorDetails = parseSupabaseError(e)
      console.log('🔄 Auth error detected:', errorDetails)
      console.log('🔄 Refreshing session and retrying...')
      
      // Refresh the session
      const { error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError) {
        const refreshErrorDetails = parseSupabaseError(refreshError)
        console.error('❌ Session refresh failed:', refreshErrorDetails)
        throw new Error(`Session expired: ${refreshErrorDetails}`)
      }
      
      console.log('✅ Session refreshed, retrying operation...')
      
      // Retry the original operation with fresh token
      return await fn()
    }
    
    // Not an auth error, enhance error message and rethrow
    const errorDetails = parseSupabaseError(e)
    console.error('❌ Operation failed:', errorDetails)
    
    // Create enhanced error with better message
    const enhancedError = new Error(errorDetails)
    Object.assign(enhancedError, e) // Preserve original error properties
    throw enhancedError
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
