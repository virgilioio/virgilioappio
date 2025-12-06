import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RejectionEmailTemplate {
  id: string;
  tenant_id: string | null;
  name: string;
  subject: string;
  body: string;
  rejection_reason_id: string | null;
  source: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type RejectionEmailTemplatesContext = 'platform-defaults' | 'organization';

export function useRejectionEmailTemplates(context: RejectionEmailTemplatesContext = 'organization') {
  const [templates, setTemplates] = useState<RejectionEmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('rejection_email_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter based on context
      if (context === 'platform-defaults') {
        setTemplates((data || []).filter(t => t.tenant_id === null));
      } else {
        setTemplates(data || []);
      }
    } catch (error: any) {
      console.error('Error fetching rejection email templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch rejection email templates',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createTemplate = async (templateData: {
    name: string;
    subject: string;
    body: string;
    rejection_reason_id?: string | null;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let tenantId: string | null = null;
      
      if (context === 'organization') {
        const { data: memberData } = await supabase
          .from('members')
          .select('tenant_id')
          .eq('user_id', user.id)
          .eq('user_status', 'active')
          .single();
        
        tenantId = memberData?.tenant_id || null;
      }

      const { error } = await supabase
        .from('rejection_email_templates')
        .insert({
          name: templateData.name,
          subject: templateData.subject,
          body: templateData.body,
          rejection_reason_id: templateData.rejection_reason_id || null,
          tenant_id: tenantId,
          created_by: user.id,
          source: tenantId ? 'custom' : 'platform',
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Rejection email template created successfully',
      });

      await fetchTemplates();
    } catch (error: any) {
      console.error('Error creating rejection email template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create rejection email template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateTemplate = async (id: string, templateData: {
    name?: string;
    subject?: string;
    body?: string;
    rejection_reason_id?: string | null;
  }) => {
    try {
      const { error } = await supabase
        .from('rejection_email_templates')
        .update(templateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Rejection email template updated successfully',
      });

      await fetchTemplates();
    } catch (error: any) {
      console.error('Error updating rejection email template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update rejection email template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('rejection_email_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Rejection email template deleted successfully',
      });

      await fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting rejection email template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete rejection email template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [context]);

  return {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetchTemplates: fetchTemplates,
  };
}
