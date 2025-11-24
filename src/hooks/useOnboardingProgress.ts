import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgContext } from '@/contexts/OrgContext';

export interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  manuallyCompleted: boolean;
  route: string;
}

export function useOnboardingProgress() {
  const { user } = useAuth();
  const { organizationId } = useOrgContext();
  const queryClient = useQueryClient();
  
  // Get tenant_id directly from user's membership
  const { data: memberData } = useQuery({
    queryKey: ['user-tenant', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const tenantId = memberData?.tenant_id;
  
  // Fetch onboarding progress
  const { data: progress, isLoading } = useQuery({
    queryKey: ['onboarding-progress', user?.id, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', user?.id)
        .eq('tenant_id', tenantId)
        .single();
      
      if (error) {
        // If no record exists, return null
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    },
    enabled: !!user && !!tenantId
  });
  
  // Refresh/recalculate progress
  const refreshProgress = async () => {
    if (!user?.id || !tenantId) return;
    
    await supabase.rpc('check_onboarding_task_completion', {
      p_user_id: user.id,
      p_tenant_id: tenantId
    });
    
    queryClient.invalidateQueries({ 
      queryKey: ['onboarding-progress', user.id, tenantId] 
    });
  };
  
  // Manual task completion
  const markTaskComplete = async (taskId: string, completed: boolean) => {
    if (!user?.id || !tenantId) return;
    
    const field = `task_${taskId}_complete`;
    const manualField = `task_${taskId}_manual`;
    
    await supabase
      .from('onboarding_progress')
      .update({ 
        [field]: completed,
        [manualField]: true 
      })
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId);
    
    queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] });
  };
  
  // Dismiss checklist
  const dismissChecklist = async () => {
    if (!user?.id || !tenantId) return;
    
    await supabase
      .from('onboarding_progress')
      .update({ 
        dismissed: true,
        dismissed_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId);
    
    queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] });
  };
  
  // Build task list
  const tasks: OnboardingTask[] = [
    {
      id: 'google',
      title: 'Connect Google Workspace',
      description: 'Enable Gmail and Google Calendar integration',
      completed: progress?.task_google_connected || false,
      manuallyCompleted: progress?.task_google_manual || false,
      route: '/settings?tab=profile&highlight=google'
    },
    {
      id: 'organization',
      title: 'Create Your First Department',
      description: 'Organize jobs by department or team',
      completed: progress?.task_organization_created || false,
      manuallyCompleted: progress?.task_organization_manual || false,
      route: '/settings?tab=organizations'
    },
    {
      id: 'job',
      title: 'Create Your First Job',
      description: 'Post your first open position',
      completed: progress?.task_job_created || false,
      manuallyCompleted: progress?.task_job_manual || false,
      route: '/jobs'
    },
    {
      id: 'candidate',
      title: 'Add Your First Candidate',
      description: 'Start building your talent pipeline',
      completed: progress?.task_candidate_created || false,
      manuallyCompleted: progress?.task_candidate_manual || false,
      route: '/find'
    },
    {
      id: 'team',
      title: 'Invite Your Team',
      description: 'Collaborate with hiring managers and recruiters',
      completed: progress?.task_team_invited || false,
      manuallyCompleted: progress?.task_team_manual || false,
      route: '/settings?tab=members'
    }
  ];
  
  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const isComplete = completedCount === totalCount;
  const isDismissed = progress?.dismissed || false;
  
  return {
    tasks,
    progress,
    completedCount,
    totalCount,
    isComplete,
    isDismissed,
    isLoading,
    refreshProgress,
    markTaskComplete,
    dismissChecklist
  };
}
