/**
 * Invitation Reconciliation Service
 * 
 * Enterprise-grade invitation flow that automatically links authenticated users
 * to their pending organization invitations based on email address.
 * 
 * This ensures users are never "orphaned" regardless of how they authenticate:
 * - Email/password signup via AcceptInvite page
 * - Google OAuth from any page
 * - Direct signup then later login
 */

import { supabase } from '@/lib/supabaseClient';
import { log } from '@/lib/logger';

export interface ReconciliationResult {
  success: boolean;
  action_taken: string;
  organization_id: string | null;
  organization_name: string | null;
  system_role: string | null;
  member_role: string | null; // legacy
}

/**
 * Check for and automatically accept any pending invitation for the authenticated user.
 * 
 * This is called:
 * 1. During auth bootstrap after session is established
 * 2. In AuthCallback after OAuth redirect
 * 3. In Onboarding when checking for pending invitations
 * 
 * @param userId - The authenticated user's ID
 * @returns ReconciliationResult with details about what happened
 */
export async function reconcilePendingInvitation(userId: string): Promise<ReconciliationResult | null> {
  try {
    const { data, error } = await supabase.rpc('reconcile_pending_invitation', {
      p_user_id: userId
    });

    if (error) {
      log.error('Invitation reconciliation RPC failed:', error);
      return null;
    }

    // RPC returns an array, get the first result
    const result = Array.isArray(data) ? data[0] : data;
    
    if (!result) {
      log.debug('No reconciliation result returned');
      return null;
    }

    if (result.success && result.action_taken === 'invitation_accepted') {
      log.info('🎉 Auto-linked pending invitation', {
        orgName: result.organization_name,
        role: result.system_role || result.member_role,
        orgId: result.organization_id
      });
    } else if (result.action_taken === 'no_pending_invitation') {
      log.debug('No pending invitation found for user');
    } else if (result.action_taken === 'user_not_found') {
      log.warn('User not found during reconciliation');
    }

    return result as ReconciliationResult;
  } catch (err) {
    log.error('Invitation reconciliation check failed:', err);
    return null;
  }
}

/**
 * Check if reconciliation result indicates a successful invitation acceptance
 */
export function wasInvitationAccepted(result: ReconciliationResult | null): boolean {
  return result?.success === true && result?.action_taken === 'invitation_accepted';
}
