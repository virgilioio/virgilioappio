import { supabase } from '@/lib/supabaseClient'

export type ChatAuditEvent =
  | 'message_sent'
  | 'internal_note_added'
  | 'chat_paused'
  | 'chat_resumed'
  | 'thread_assigned'
  | 'thread_closed'

interface LogArgs {
  tenantId: string
  actorId: string
  threadId?: string | null
  event: ChatAuditEvent
  metadata?: Record<string, unknown>
}

/**
 * logChatAuditEvent — best-effort insert into `chat_audit_log`.
 * Failures are swallowed; auditing must never block user actions.
 */
export async function logChatAuditEvent({
  tenantId,
  actorId,
  threadId,
  event,
  metadata = {},
}: LogArgs): Promise<void> {
  try {
    await supabase.from('chat_audit_log').insert([
      {
        tenant_id: tenantId,
        actor_type: 'recruiter',
        actor_id: actorId,
        thread_id: threadId ?? undefined,
        event,
        metadata: metadata as any,
      },
    ])
  } catch {
    // intentionally silent
  }
}
