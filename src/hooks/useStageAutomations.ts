import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AutomationEmail {
  id: string;
  sequence_order: number;
  delay_value: number | null;
  delay_unit: 'days' | 'weeks' | null;
  is_recurring: boolean;
  recurrence_interval_value: number | null;
  recurrence_interval_unit: 'days' | 'weeks' | null;
  max_occurrences: number | null;
  email_template_id: string | null;
  template_name?: string;
  subject: string;
  body: string;
  from_email: string;
  send_to: 'candidate' | 'hiring_team' | 'interviewers' | 'custom';
  custom_recipients: string[] | null;
}

export interface StageAutomation {
  id: string;
  job_hiring_stage_id: string;
  automation_type: 'single_email' | 'email_sequence';
  trigger_event: 'on_stage_enter' | 'on_stage_exit';
  is_active: boolean;
  emails: AutomationEmail[];
  created_at: string;
  updated_at: string;
}

export function useStageAutomations(jhsId: string | null) {
  const queryClient = useQueryClient();
  
  const { data: automations, isLoading } = useQuery({
    queryKey: ['stage-automations', jhsId],
    queryFn: async () => {
      if (!jhsId) return [];
      
      const { data, error } = await supabase
        .from('stage_automations')
        .select(`
          *,
          stage_automation_emails(
            *,
            email_templates(name)
          )
        `)
        .eq('job_hiring_stage_id', jhsId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data.map(automation => ({
        ...automation,
        emails: automation.stage_automation_emails.map((email: any) => ({
          ...email,
          template_name: email.email_templates?.name
        }))
      })) as StageAutomation[];
    },
    enabled: !!jhsId
  });
  
  const createAutomation = useMutation({
    mutationFn: async (data: {
      job_hiring_stage_id: string;
      automation_type: 'single_email' | 'email_sequence';
      trigger_event: 'on_stage_enter' | 'on_stage_exit';
      emails: Omit<AutomationEmail, 'id' | 'template_name'>[];
    }) => {
      const { data: automation, error: automationError } = await supabase
        .from('stage_automations')
        .insert({
          job_hiring_stage_id: data.job_hiring_stage_id,
          automation_type: data.automation_type,
          trigger_event: data.trigger_event,
          is_active: true
        })
        .select()
        .single();
      
      if (automationError) throw automationError;
      
      const { error: emailsError } = await supabase
        .from('stage_automation_emails')
        .insert(
          data.emails.map((email, index) => ({
            ...email,
            stage_automation_id: automation.id,
            sequence_order: index + 1
          }))
        );
      
      if (emailsError) throw emailsError;
      
      return automation;
    },
    onSuccess: () => {
      toast.success('Automation created successfully');
      queryClient.invalidateQueries({ queryKey: ['stage-automations', jhsId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create automation: ${error.message}`);
    }
  });
  
  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('stage_automations')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-automations', jhsId] });
    }
  });
  
  const updateAutomation = useMutation({
    mutationFn: async (data: {
      id: string;
      automation_type: 'single_email' | 'email_sequence';
      trigger_event: 'on_stage_enter' | 'on_stage_exit';
      emails: Omit<AutomationEmail, 'id' | 'template_name'>[];
    }) => {
      // Update the automation record
      const { error: updateError } = await supabase
        .from('stage_automations')
        .update({
          automation_type: data.automation_type,
          trigger_event: data.trigger_event,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.id);
      
      if (updateError) throw updateError;
      
      // Delete existing emails
      const { error: deleteError } = await supabase
        .from('stage_automation_emails')
        .delete()
        .eq('stage_automation_id', data.id);
      
      if (deleteError) throw deleteError;
      
      // Insert updated emails
      const { error: insertError } = await supabase
        .from('stage_automation_emails')
        .insert(
          data.emails.map((email, index) => ({
            ...email,
            stage_automation_id: data.id,
            sequence_order: index + 1
          }))
        );
      
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success('Automation updated successfully');
      queryClient.invalidateQueries({ queryKey: ['stage-automations', jhsId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update automation: ${error.message}`);
    }
  });
  
  const deleteAutomation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stage_automations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Automation deleted');
      queryClient.invalidateQueries({ queryKey: ['stage-automations', jhsId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    }
  });
  
  return {
    automations: automations || [],
    isLoading,
    createAutomation,
    updateAutomation,
    toggleActive,
    deleteAutomation
  };
}
