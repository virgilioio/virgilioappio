import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SaaSCustomerOnboardingTask {
  id: string;
  title: string;
  completed: boolean;
}

export function useSaaSCustomerOnboarding(tenantId: string | undefined) {
  const { data: progress, isLoading } = useQuery({
    queryKey: ['saas-customer-onboarding', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();
      
      if (error) {
        // If no record exists, return null
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    },
    enabled: !!tenantId
  });
  
  const tasks: SaaSCustomerOnboardingTask[] = [
    {
      id: 'organization',
      title: 'Create Department',
      completed: progress?.task_organization_created || false
    },
    {
      id: 'job',
      title: 'Create Job',
      completed: progress?.task_job_created || false
    },
    {
      id: 'candidate',
      title: 'Add Candidate',
      completed: progress?.task_candidate_created || false
    },
    {
      id: 'team',
      title: 'Invite Team',
      completed: progress?.task_team_invited || false
    },
    {
      id: 'google',
      title: 'Connect Google Workspace',
      completed: progress?.task_google_connected || false
    }
  ];
  
  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const isComplete = completedCount === totalCount;
  const completedAt = progress?.completed_at;
  
  return {
    tasks,
    completedCount,
    totalCount,
    isComplete,
    completedAt,
    isLoading
  };
}
