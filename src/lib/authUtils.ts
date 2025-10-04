import { supabase } from '@/lib/supabaseClient'
import { log } from '@/lib/logger'

/**
 * Extract human-readable error message from various error formats
 * Handles PostgREST, RPC, and Edge Function errors
 */
export function extractErrorMessage(err: any): string {
  if (!err) return 'Unexpected error'
  if (typeof err === 'string') return err
  
  // Check various error message locations
  if (err.message) return err.message
  if (err.error?.message) return err.error.message
  if (err.data?.message) return err.data.message
  if (err.details) return err.details // PostgREST detail
  
  // Check for specific PostgREST error codes
  if (err.code === '23505') {
    return 'This record already exists. Please use unique values.'
  }
  if (err.code === '23503') {
    return 'Cannot complete this action due to related records. Please remove dependencies first.'
  }
  if (err.code === '42501') {
    return 'You do not have permission to perform this action.'
  }
  if (err.code === 'PGRST301') {
    return 'Record not found or you do not have permission to access it.'
  }
  
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}

/**
 * Single unified auth retry helper.
 * Wraps any async operation with automatic 401 refresh+retry logic.
 * 
 * If the operation fails with a 401 error (expired token), it will:
 * 1. Refresh the session automatically
 * 2. Retry the original operation once
 * 
 * @param fn - The async function to execute with retry logic
 * @returns The result of the function execution
 */
export async function withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error: any) {
    // Check if it's a 401 authentication error
    const is401 = 
      error?.status === 401 ||
      error?.code === '401' ||
      error?.code === 'PGRST301' ||
      error?.code === 'PGRST302' ||
      error?.message?.includes('JWT') ||
      error?.message?.includes('expired') ||
      error?.message?.includes('invalid token')
    
    if (is401) {
      log.info('Auth token expired, refreshing session...')
      
      // Attempt to refresh the session
      const { error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError) {
        log.error('Session refresh failed:', refreshError)
        throw error // Throw original error if refresh fails
      }
      
      log.info('Session refreshed, retrying operation...')
      // Retry the original operation after successful refresh
      return await fn()
    }
    
    // If not a 401 error, throw it immediately
    throw error
  }
}

// DEPRECATED: Legacy wrappers removed. Use withAuthRetry() directly.
// These are kept temporarily for backwards compatibility but will be removed.

/** @deprecated Use withAuthRetry() directly */
export const withAuthRetrySelect = withAuthRetry

/** @deprecated Use withAuthRetry() directly */
export const withAuthRetryMutation = withAuthRetry

/** @deprecated Use withAuthRetry() directly */
export const withAuthRetryRpc = withAuthRetry

/** @deprecated Use withAuthRetry() directly */
export const withAuthRetryEdgeFunction = withAuthRetry
