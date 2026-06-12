import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export interface OnboardingTask {
  id: string;
  tenant_id: string;
  application_id: string;
  label: string;
  done: boolean;
  owner_user_id: string | null;
  owner_label: string | null;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TASKS: Array<{ label: string; owner_label: string | null }> = [
  { label: 'Background check', owner_label: 'People Ops' },
  { label: 'I-9 verification', owner_label: 'People Ops' },
  { label: 'Hardware provisioning', owner_label: 'IT' },
  { label: 'Welcome packet sent', owner_label: 'People Ops' },
  { label: 'Slack + email accounts', owner_label: 'IT' },
  { label: 'Onboarding buddy assigned', owner_label: 'Hiring manager' },
  { label: 'Day-1 schedule prepared', owner_label: 'Hiring manager' },
  { label: '30-60-90 plan drafted', owner_label: 'Hiring manager' },
  { label: 'Equity grant processed', owner_label: 'Finance' },
];

export function useOnboardingTasks(applicationId: string | null, opts?: { enabled?: boolean }) {
  const { organizationId } = useAuth();
  const qc = useQueryClient();
  const enabled = !!applicationId && !!organizationId && opts?.enabled !== false;

  const query = useQuery({
    queryKey: ['onboarding-tasks', applicationId],
    enabled,
    queryFn: async (): Promise<OnboardingTask[]> => {
      if (!applicationId) return [];
      const { data, error } = await supabase
        .from('onboarding_tasks' as any)
        .select('*')
        .eq('application_id', applicationId)
        .order('position', { ascending: true });
      if (error) throw error;

      let rows = (data || []) as unknown as OnboardingTask[];

      // Seed defaults the first time
      if (rows.length === 0 && organizationId) {
        const seed = DEFAULT_TASKS.map((t, i) => ({
          tenant_id: organizationId,
          application_id: applicationId,
          label: t.label,
          owner_label: t.owner_label,
          position: i,
        }));
        const { data: inserted, error: insertErr } = await supabase
          .from('onboarding_tasks' as any)
          .insert(seed)
          .select('*');
        if (insertErr) throw insertErr;
        rows = (inserted || []) as unknown as OnboardingTask[];
        rows.sort((a, b) => a.position - b.position);
      }

      return rows;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from('onboarding_tasks' as any)
        .update({ done })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: ['onboarding-tasks', applicationId] });
      const prev = qc.getQueryData<OnboardingTask[]>(['onboarding-tasks', applicationId]);
      qc.setQueryData<OnboardingTask[]>(['onboarding-tasks', applicationId], (old) =>
        (old || []).map((t) => (t.id === id ? { ...t, done } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['onboarding-tasks', applicationId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['onboarding-tasks', applicationId] }),
  });

  const add = useMutation({
    mutationFn: async (label: string) => {
      if (!applicationId || !organizationId) return;
      const nextPosition = (query.data?.length || 0);
      const { error } = await supabase.from('onboarding_tasks' as any).insert({
        tenant_id: organizationId,
        application_id: applicationId,
        label,
        position: nextPosition,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding-tasks', applicationId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('onboarding_tasks' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding-tasks', applicationId] }),
  });

  const tasks = query.data || [];
  const doneCount = tasks.filter((t) => t.done).length;

  return {
    tasks,
    isLoading: query.isLoading,
    doneCount,
    totalCount: tasks.length,
    toggle: toggle.mutate,
    add: add.mutate,
    remove: remove.mutate,
  };
}
