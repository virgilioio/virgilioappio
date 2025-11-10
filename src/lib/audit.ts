/**
 * Audit logging utilities for sensitive operations
 * 
 * Uses the public.log_audit_event() function for consistent logging
 * across client and edge function contexts.
 */

import { supabase } from '@/lib/supabaseClient';

export interface AuditLogParams {
  action: string;
  tableName?: string;
  recordId?: string;
  userId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

/**
 * Log an audit event from the client or edge function
 * 
 * Note: Audit logs are now stored in the `audit.audit_logs` table,
 * which is immutable (append-only). No updates or deletes allowed.
 * 
 * @param params - Audit log parameters
 * @returns Audit log ID if successful
 */
export async function logAuditEvent(params: AuditLogParams): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('log_audit_event', {
      p_action: params.action,
      p_table_name: params.tableName || null,
      p_record_id: params.recordId || null,
      p_user_id: params.userId || null,
      p_old_values: params.oldValues || null,
      p_new_values: params.newValues || null,
    });

    if (error) {
      console.error('Failed to log audit event:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected error logging audit event:', err);
    return null;
  }
}

/**
 * Common audit event types
 */
export const AuditEventTypes = {
  MEMBER_ROLE_CHANGED: 'member_role_changed',
  OFFER_LETTER_STATUS_CHANGED: 'offer_letter_status_changed',
  INVITATION_ACCEPTED: 'invitation_accepted',
  ATTACHMENT_DOWNLOADED: 'attachment_downloaded',
} as const;
