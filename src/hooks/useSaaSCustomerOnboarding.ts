import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SaaSCustomerOnboardingTask {
  id: string;
  title: string;
  completed: boolean;
}

export function useSaaSCustomerOnboarding(tenantId: string | undefined) {
  const { data: progressRecords, isLoading } = useQuery({
    queryKey: ['saas-customer-onboarding', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('tenant_id', tenantId);
      
      if (error) throw error;
      if (!data || data.length === 0) return null;
      
      // Aggregate progress: task is complete if ANY user completed it
      const aggregated = {
        task_organization_created: data.some(r => r.task_organization_created),
        task_job_created: data.some(r => r.task_job_created),
        task_candidate_created: data.some(r => r.task_candidate_created),
        task_team_invited: data.some(r => r.task_team_invited),
        task_google_connected: data.some(r => r.task_google_connected),
        completed_at: data.find(r => r.completed_at)?.completed_at || null
      };
      
      return aggregated;
    },
    enabled: !!tenantId
  });
  
  const progress = progressRecords;
  
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
