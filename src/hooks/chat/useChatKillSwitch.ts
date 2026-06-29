import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/hooks/useTenant'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { logChatAuditEvent } from '@/lib/chat/audit'

/**
 * useChatKillSwitch — read + toggle the tenant-wide `chat_paused` flag (Step 1.10).
 *
 * When paused:
 *   - Recruiter UI shows a top-of-thread banner (handled in `ThreadPane`).
 *   - DB BEFORE INSERT trigger blocks inbound candidate messages (Phase 1.5).
 *   - Candidate send endpoints will return 423 Locked (enforced in Phase 2 edge fns).
 *   - AI auto-replies are suspended (enforced in Phase 3 worker).
 */
export function useChatKillSwitch() {
  const { tenant } = useTenant()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const isPaused = Boolean((tenant as any)?.chat_paused)

  const setPaused = useMutation({
    mutationFn: async (paused: boolean) => {
      if (!tenant?.id) throw new Error('No tenant')
      const { error } = await supabase
        .from('tenants')
        .update({ chat_paused: paused })
        .eq('id', tenant.id)
      if (error) throw error
      if (user?.id) {
        void logChatAuditEvent({
          tenantId: tenant.id,
          actorId: user.id,
          event: paused ? 'chat_paused' : 'chat_resumed',
        })
      }
      return paused
    },
    onSuccess: (paused) => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] })
      toast({
        title: paused ? 'Candidate chat paused' : 'Candidate chat resumed',
        description: paused
          ? 'New candidate messages are blocked workspace-wide.'
          : 'Candidates can message your team again.',
      })
    },
    onError: () => {
      toast({
        title: 'Could not update chat status',
        description: 'Please try again.',
        variant: 'destructive',
      })
    },
  })

  return { isPaused, setPaused }
}
