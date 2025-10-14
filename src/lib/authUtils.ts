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


/**
 * Resolve organization context with retry logic and timeout
 * Returns organization context or null if resolution fails
 */
export async function resolveOrgContextWithRetry(
  supabaseClient: any,
  options: {
    signal?: AbortSignal;
    maxAttempts?: number;
    baseMs?: number;
    timeoutMs?: number;
  } = {}
): Promise<{
  organizationId: string | null;
  role: string | null;
  userType: string | null;
} | null> {
  const {
    signal,
    maxAttempts = 3,
    baseMs = 300,
    timeoutMs = 8000,
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    
    // Link external signal if provided
    const effectiveSignal = signal
      ? linkSignals([signal, controller.signal])
      : controller.signal;

    try {
      // Set timeout for this attempt
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const { data, error } = await supabaseClient.rpc('resolve_org_context', {}, {
        signal: effectiveSignal,
      });

      clearTimeout(timer);

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          organizationId: null,
          role: null,
          userType: 'guest',
        };
      }

      return {
        organizationId: data[0].organization_id,
        role: data[0].role,
        userType: data[0].user_type,
      };
    } catch (error: any) {
      lastError = error;

      // If external signal aborted, bail immediately
      if (signal?.aborted) {
        throw error;
      }

      // If this was our last attempt, throw
      if (attempt >= maxAttempts) {
        throw error;
      }

      // Exponential backoff with jitter
      const backoffDelay = baseMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 100);
      log.info(`Org context resolve attempt ${attempt}/${maxAttempts} failed, retrying in ${backoffDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError;
}

/**
 * Link multiple AbortSignals together
 * Returns a signal that aborts when any input signal aborts
 */
function linkSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }

    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return controller.signal;
}
