import { useEffect, useSyncExternalStore } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { startMultiTabSync } from './useMultiTabSync';
import { resolveOrgContextWithRetry } from '@/lib/authUtils';
import { readOrgCache, writeOrgCache, clearOrgCache } from '@/lib/orgContextCache';
import { log } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { debounce } from '@/utils/debounce';
import { reconcilePendingInvitation, wasInvitationAccepted } from '@/lib/invitationReconciliation';

const VIRGILIO_ORG_ID = '5ba7b145-f251-4b18-8900-724cb06028ab';

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

interface AuthBootstrapReturn extends AuthBootstrapState {
  forceRefresh: () => Promise<void>;
}

/*
 * One bootstrap per tab (2026-10-17). AuthProvider, OrgContextProvider and
 * AppBootstrap all read it; before, each ran its own copy, so every page load
 * reconciled invitations and resolved the org context three times and kept
 * three cross-tab channels that woke each other up.
 */
let state: AuthBootstrapState = { ready: false, session: null, orgContext: null };
const listeners = new Set<() => void>();
let abortController: AbortController | null = null;
let lastUserId: string | null = null;
let isBootstrapping = false;
let mounts = 0;
let stop: (() => void) | null = null;

function setState(next: AuthBootstrapState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Handle session updates from other tabs
function handleSessionUpdate(session: Session | null) {
  if (!session) {
    clearOrgCache();
    setState({ ready: true, session: null, orgContext: null });
    return;
  }
  debouncedBootstrap(session);
}

/**
 * Force refresh org context (bypasses cache)
 */
async function forceRefresh(): Promise<void> {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user) {
      clearOrgCache();
      await resolveOrgContext(currentSession);
    }
}

/**
 * Resolve org context with cache-first approach
 */
async function resolveOrgContext(session: Session): Promise<void> {
    // Prevent concurrent bootstrap attempts
    if (isBootstrapping) {
      log.info('⏭️ Bootstrap already in progress, skipping...');
      return;
    }

    isBootstrapping = true;
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
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

    try {
      // 🎯 Enterprise invitation reconciliation: Check for pending invitations first
      // This ensures users who authenticated via any path are linked to their invitations
      const reconcileResult = await reconcilePendingInvitation(userId);
      
      if (wasInvitationAccepted(reconcileResult)) {
        log.info('🎉 Bootstrap: Auto-linked pending invitation', {
          orgName: reconcileResult?.organization_name,
          role: reconcileResult?.system_role
        });
        
        toast({
          title: `Welcome to ${reconcileResult?.organization_name}!`,
          description: `You've been added as ${reconcileResult?.system_role === 'admin' ? 'Admin' : 'Member'}.`,
        });
        
        // Clear cache to force refresh with new org context
        clearOrgCache();
      }

      const startTime = Date.now();
      const resolved = await resolveOrgContextWithRetry(supabase, {
        signal: abortController.signal,
      });

      const duration = Date.now() - startTime;
      log.info(`✅ Org context resolved in ${duration}ms`, {
        orgId: resolved?.organizationId,
        role: resolved?.role,
      });

      // Force Virgilio organization context for Virgilio staff
      let finalOrgId = resolved?.organizationId;
      let finalRole = resolved?.role;
      let finalUserType = resolved?.userType;

      // DISABLED: Virgilio staff JWT refresh to prevent token refresh loop (Phase 1 fix)
      // This was causing 429 "Too Many Requests" errors due to concurrent refreshes
      // from multi-tab sync + auth state changes
      if (resolved?.organizationId === VIRGILIO_ORG_ID) {
        log.info('🏢 Virgilio staff detected - organization context set (JWT refresh disabled)');
      }

      const orgContext: OrgContext = resolved
        ? {
            organizationId: finalOrgId,
            role: finalRole,
            userType: finalUserType,
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
    } finally {
      isBootstrapping = false;
    }
  };

/**
 * Debounced bootstrap to prevent rapid re-runs
 */
const debouncedBootstrap = debounce((session: Session) => {
  resolveOrgContext(session);
}, 1000); // Increased from 150ms to 1000ms to batch tab switches

function start(): () => void {
    let mounted = true;
    const stopTabSync = startMultiTabSync(handleSessionUpdate);

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
      lastUserId = session.user.id;
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
        lastUserId = null;
        clearOrgCache();
        setState({ ready: true, session: null, orgContext: null });
        return;
      }

      if (!session) {
        lastUserId = null;
        clearOrgCache();
        setState({ ready: true, session: null, orgContext: null });
        return;
      }

      // Filter out redundant SIGNED_IN events from tab visibility
      const currentUserId = session.user.id;
      const userChanged = lastUserId !== currentUserId;
      
      if (event === 'SIGNED_IN') {
        // Only bootstrap on SIGNED_IN if this is a different user
        if (userChanged) {
          log.info('🔐 New user signed in, bootstrapping...');
          lastUserId = currentUserId;
          debouncedBootstrap(session);
        } else {
          log.info('⏭️ Ignoring redundant SIGNED_IN event for same user');
        }
      } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Always update on token refresh or user updates
        lastUserId = currentUserId;
        debouncedBootstrap(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      stopTabSync();
      if (abortController) {
        abortController.abort();
      }
    };
}

export function useAuthBootstrap(): AuthBootstrapReturn {
  const snapshot = useSyncExternalStore(subscribe, () => state);

  useEffect(() => {
    mounts += 1;
    if (!stop) stop = start();
    return () => {
      mounts -= 1;
      if (mounts === 0 && stop) {
        stop();
        stop = null;
      }
    };
  }, []);

  return { ...snapshot, forceRefresh };
}
