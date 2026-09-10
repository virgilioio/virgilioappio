import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  AutomationAction, AutomationTrigger, AutomationTiming, AutomationConfig,
} from '@/lib/automations';

export interface StageAutomation {
  id: string;
  job_id: string | null;
  job_hiring_stage_id: string;
  name: string;
  action: AutomationAction;
  trigger: AutomationTrigger;
  trigger_days: number | null;
  timing: AutomationTiming;
  delay_amount: number | null;
  delay_unit: string | null;
  send_at: string | null;
  config: AutomationConfig;
  skip_if_replied: boolean;
  once_per_candidate: boolean;
  is_active: boolean;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRunStats {
  sent: number;
  scheduled: number;
  skipped: number;
  failed: number;
  cancelled: number;
  opened: number;
  lastFailure: string | null;
  lastRunAt: string | null;
}

export interface AutomationRun {
  id: string;
  automation_id: string;
  candidate_id: string;
  association_id: string | null;
  step: number;
  status: 'scheduled' | 'sent' | 'skipped' | 'failed' | 'cancelled';
  reason: string | null;
  scheduled_for: string | null;
  executed_at: string | null;
  created_at: string;
  candidate_name?: string | null;
}

export type AutomationInput = {
  name: string;
  action: AutomationAction;
  trigger: AutomationTrigger;
  trigger_days: number | null;
  timing: AutomationTiming;
  delay_amount: number | null;
  delay_unit: string | null;
  send_at: string | null;
  config: AutomationConfig;
  skip_if_replied: boolean;
  once_per_candidate: boolean;
};

const db = supabase as any;

function mapRow(row: any): StageAutomation {
  return {
    ...row,
    config: (row.config && typeof row.config === 'object') ? row.config : {},
  } as StageAutomation;
}

function emptyStats(): AutomationRunStats {
  return { sent: 0, scheduled: 0, skipped: 0, failed: 0, cancelled: 0, opened: 0, lastFailure: null, lastRunAt: null };
}

export function useStageAutomations(jhsId: string | null, jobId?: string | null) {
  const queryClient = useQueryClient();
  const listKey = ['stage-automations', jhsId];
  const statsKey = ['stage-automation-stats', jhsId];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: listKey });
    queryClient.invalidateQueries({ queryKey: statsKey });
    queryClient.invalidateQueries({ queryKey: ['job-stage-automations'] });
  };

  const { data: automations, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      if (!jhsId) return [] as StageAutomation[];
      const { data, error } = await db
        .from('stage_automations')
        .select('*')
        .eq('job_hiring_stage_id', jhsId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapRow) as StageAutomation[];
    },
    enabled: !!jhsId,
  });

  // Real run counts per automation — never fixtures.
  const automationIds = useMemo(() => (automations || []).map((a) => a.id), [automations]);
  const { data: stats } = useQuery({
    queryKey: [...statsKey, automationIds.join(',')],
    queryFn: async () => {
      const result: Record<string, AutomationRunStats> = {};
      if (automationIds.length === 0) return result;
      const { data, error } = await db
        .from('stage_automation_runs')
        .select('automation_id, status, reason, executed_at, created_at, association_id, candidate_id')
        .in('automation_id', automationIds)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      for (const id of automationIds) result[id] = emptyStats();
      for (const r of data || []) {
        const s = result[r.automation_id] || (result[r.automation_id] = emptyStats());
        if (r.status in s) (s as any)[r.status] += 1;
        const when = r.executed_at || r.created_at;
        if (when && (!s.lastRunAt || when > s.lastRunAt)) s.lastRunAt = when;
        if (r.status === 'failed' && !s.lastFailure) s.lastFailure = r.reason;
      }
      // Opened count for email automations: join sent automated emails to email_logs.opened_at
      const emailAutoIds = (automations || []).filter((a) => a.action === 'email' || a.action === 'sequence').map((a) => a.id);
      if (emailAutoIds.length) {
        const sentRuns = (data || []).filter((r: any) => r.status === 'sent' && emailAutoIds.includes(r.automation_id));
        const candidateIds = Array.from(new Set(sentRuns.map((r: any) => r.candidate_id))).slice(0, 500);
        if (candidateIds.length && jobId) {
          const { data: logs } = await db
            .from('email_logs')
            .select('candidate_id, opened_at')
            .eq('job_id', jobId)
            .eq('direction', 'sent')
            .in('candidate_id', candidateIds)
            .not('opened_at', 'is', null);
          const openedBy = new Set((logs || []).map((l: any) => l.candidate_id));
          for (const id of emailAutoIds) {
            const s = result[id];
            if (!s) continue;
            const cands = new Set(sentRuns.filter((r: any) => r.automation_id === id).map((r: any) => r.candidate_id));
            s.opened = Array.from(cands).filter((c) => openedBy.has(c)).length;
          }
        }
      }
      return result;
    },
    enabled: automationIds.length > 0,
    staleTime: 30_000,
  });

  const createAutomation = useMutation({
    mutationFn: async (input: AutomationInput) => {
      if (!jhsId) throw new Error('No stage selected');
      const { data: { user } } = await supabase.auth.getUser();
      const position = automations?.length || 0;
      const { data, error } = await db
        .from('stage_automations')
        .insert({
          job_hiring_stage_id: jhsId,
          job_id: jobId || null,
          created_by: user?.id || null,
          position,
          is_active: true,
          ...input,
        })
        .select()
        .single();
      if (error) throw error;
      return mapRow(data);
    },
    onSuccess: () => { toast.success('Automation created'); invalidate(); },
    onError: (e: Error) => toast.error(`Couldn't create automation: ${e.message}`),
  });

  const updateAutomation = useMutation({
    mutationFn: async ({ id, ...input }: Partial<AutomationInput> & { id: string }) => {
      const { error } = await db
        .from('stage_automations')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Automation saved'); invalidate(); },
    onError: (e: Error) => toast.error(`Couldn't save automation: ${e.message}`),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await db
        .from('stage_automations')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const prev = queryClient.getQueryData<StageAutomation[]>(listKey);
      queryClient.setQueryData<StageAutomation[]>(listKey, (old) =>
        (old || []).map((a) => (a.id === id ? { ...a, is_active: isActive } : a)));
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(listKey, ctx.prev);
      toast.error(`Couldn't update: ${e.message}`);
    },
    onSettled: invalidate,
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(orderedIds.map((id, idx) =>
        db.from('stage_automations').update({ position: idx }).eq('id', id)));
    },
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const prev = queryClient.getQueryData<StageAutomation[]>(listKey);
      queryClient.setQueryData<StageAutomation[]>(listKey, (old) => {
        const byId = new Map((old || []).map((a) => [a.id, a]));
        return orderedIds.map((id, idx) => ({ ...(byId.get(id) as StageAutomation), position: idx })).filter(Boolean);
      });
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(listKey, ctx.prev);
      toast.error(`Couldn't reorder: ${e.message}`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });

  const duplicateAutomation = useMutation({
    mutationFn: async (source: StageAutomation) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await db.from('stage_automations').insert({
        job_hiring_stage_id: source.job_hiring_stage_id,
        job_id: source.job_id,
        created_by: user?.id || null,
        name: `${source.name} (copy)`,
        action: source.action,
        trigger: source.trigger,
        trigger_days: source.trigger_days,
        timing: source.timing,
        delay_amount: source.delay_amount,
        delay_unit: source.delay_unit,
        send_at: source.send_at,
        config: source.config,
        skip_if_replied: source.skip_if_replied,
        once_per_candidate: source.once_per_candidate,
        is_active: false,
        position: (automations?.length || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Duplicated — the copy starts paused'); invalidate(); },
    onError: (e: Error) => toast.error(`Couldn't duplicate: ${e.message}`),
  });

  const deleteAutomation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('stage_automations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Automation deleted'); invalidate(); },
    onError: (e: Error) => toast.error(`Couldn't delete: ${e.message}`),
  });

  /** How many scheduled runs a delete would cancel. */
  const countScheduledRuns = async (id: string): Promise<number> => {
    const { count } = await db
      .from('stage_automation_runs')
      .select('id', { count: 'exact', head: true })
      .eq('automation_id', id)
      .eq('status', 'scheduled');
    return count || 0;
  };

  return {
    automations: automations || [],
    stats: stats || {},
    isLoading,
    createAutomation,
    updateAutomation,
    toggleActive,
    reorder,
    duplicateAutomation,
    deleteAutomation,
    countScheduledRuns,
  };
}

export function useAutomationRuns(automationId: string | null) {
  return useQuery({
    queryKey: ['stage-automation-runs', automationId],
    queryFn: async () => {
      if (!automationId) return [] as AutomationRun[];
      const { data, error } = await db
        .from('stage_automation_runs')
        .select('*')
        .eq('automation_id', automationId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const runs = (data || []) as AutomationRun[];
      const ids = Array.from(new Set(runs.map((r) => r.candidate_id)));
      if (ids.length) {
        const { data: cands } = await db.from('candidates').select('id, candidate_name').in('id', ids);
        const names = new Map<string, string>((cands || []).map((c: any) => [c.id as string, c.candidate_name as string]));
        for (const r of runs) r.candidate_name = names.get(r.candidate_id) || null;
      }
      return runs;
    },
    enabled: !!automationId,
  });
}
