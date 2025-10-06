import { useState, useEffect, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useMultiTabSync } from './useMultiTabSync';
import { resolveOrgContextWithRetry } from '@/lib/authUtils';
import { readOrgCache, writeOrgCache, clearOrgCache } from '@/lib/orgContextCache';
import { log } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { debounce } from '@/utils/debounce';

interface OrgContext {
  organizationId: string | null;
  role: string | null;
  userType: string | null;
}

interface AuthBootstrapState {
  ready: boolean;
  session: Session | null;
  orgContext: OrgContext | null;
}

export function useAuthBootstrap() {
  const [state, setState] = useState<AuthBootstrapState>({
    ready: false,
    session: null,
    orgContext: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Handle session updates from other tabs
  const handleSessionUpdate = (session: Session | null) => {
    if (!session) {
      clearOrgCache();
      setState({ ready: true, session: null, orgContext: null });
      return;
    }

    // Use debounced bootstrap for tab sync
    debouncedBootstrap(session);
  };

  // Enable multi-tab synchronization
  useMultiTabSync(handleSessionUpdate);

  /**
   * Resolve org context with cache-first approach
   */
  const resolveOrgContext = async (session: Session): Promise<void> => {
    const userId = session.user.id;
    
    // 1. Try cache first for instant UI
    const cached = readOrgCache(userId);
    if (cached) {
      log.info('🔐 Bootstrap using cached org context', {
        orgId: cached.organizationId,
        role: cached.role,
      });
      setState({
        ready: true,
        session,
        orgContext: {
          organizationId: cached.organizationId,
          role: cached.role,
          userType: cached.userType,
        },
      });
    } else {
      // No cache, show loading
      setState({
        ready: false,
        session,
        orgContext: null,
      });
    }

    // 2. Verify/fetch in background
    // Abort any previous resolution
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const startTime = Date.now();
      const resolved = await resolveOrgContextWithRetry(supabase, {
        signal: abortControllerRef.current.signal,
      });

      const duration = Date.now() - startTime;
      log.info(`✅ Org context resolved in ${duration}ms`, {
        orgId: resolved?.organizationId,
        role: resolved?.role,
      });

      const orgContext: OrgContext = resolved
        ? {
            organizationId: resolved.organizationId,
            role: resolved.role,
            userType: resolved.userType,
          }
        : null;

      // Check if context changed
      const contextChanged =
        !cached ||
        cached.organizationId !== resolved?.organizationId ||
        cached.role !== resolved?.role ||
        cached.userType !== resolved?.userType;

      if (contextChanged && cached) {
        toast({
          title: 'Workspace context updated',
          description: 'Your workspace information has been refreshed.',
        });
      }

      // Update state and cache
      setState({ ready: true, session, orgContext });
      
      if (resolved) {
        writeOrgCache(
          userId,
          resolved.organizationId,
          resolved.role,
          resolved.userType
        );
      }
    } catch (error: any) {
      // Don't block UI - keep cached context if available
      log.error('⚠️ Org context verify failed:', error.message);
      
      if (cached) {
        log.info('Using cached org context as fallback');
        toast({
          title: 'Using cached workspace data',
          description: 'Could not verify workspace. Retrying in the background.',
          variant: 'default',
        });
      } else {
        setState({ ready: true, session, orgContext: null });
      }
    }
  };

  /**
   * Debounced bootstrap to prevent rapid re-runs
   */
  const debouncedBootstrap = debounce((session: Session) => {
    resolveOrgContext(session);
  }, 150);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;

      if (!session) {
        clearOrgCache();
        setState({ ready: true, session: null, orgContext: null });
        return;
      }

      log.info('🔐 Bootstrap start (initial mount)');
      await resolveOrgContext(session);
    }

    bootstrap();

    // Listen for REAL auth changes only (filter out INITIAL_SESSION)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      log.info('🔐 Auth state change:', event);

      // Gate: only react to meaningful events
      if (event === 'INITIAL_SESSION') {
        // Ignore - this is just the initial render, already handled by bootstrap()
        return;
      }

      if (event === 'SIGNED_OUT') {
        clearOrgCache();
        setState({ ready: true, session: null, orgContext: null });
        return;
      }

      if (!session) {
        clearOrgCache();
        setState({ ready: true, session: null, orgContext: null });
        return;
      }

      // Only trigger bootstrap for real events: SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        debouncedBootstrap(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return state;
}
