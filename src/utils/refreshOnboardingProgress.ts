import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

let inFlight = false;

export async function refreshOnboardingProgress(
  queryClient: QueryClient,
  userId: string | undefined,
  tenantId: string | undefined
) {
  if (!userId || !tenantId || inFlight) return;

  inFlight = true;
  try {
    await supabase.rpc('check_onboarding_task_completion', {
      p_user_id: userId,
      p_tenant_id: tenantId,
    });
    queryClient.invalidateQueries({
      queryKey: ['onboarding-progress', userId, tenantId],
    });
  } catch (error) {
    console.error('Failed to update onboarding progress:', error);
  } finally {
    inFlight = false;
  }
}
