import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailTemplate {
  id: string;
  organization_id: string | null;
  name: string;
  subject: string;
  body: string;
  source: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type EmailTemplatesContext = 'platform-defaults' | 'organization';

export function useEmailTemplates(context: EmailTemplatesContext = 'organization') {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (context === 'platform-defaults') {
        query = query.is('organization_id', null);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: memberData } = await supabase
          .from('members')
          .select('organization_id')
          .eq('user_id', user.id)
          .single();

        if (!memberData?.organization_id) {
          setTemplates([]);
          return;
        }

        query = query.or(`organization_id.eq.${memberData.organization_id},organization_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching email templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch email templates',
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
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let orgId: string | null = null;
      
      if (context === 'organization') {
        const { data: memberData } = await supabase
          .from('members')
          .select('organization_id')
          .eq('user_id', user.id)
          .single();
        
        orgId = memberData?.organization_id || null;
      }

      const { error } = await supabase
        .from('email_templates')
        .insert({
          name: templateData.name,
          subject: templateData.subject,
          body: templateData.body,
          organization_id: orgId,
          created_by: user.id,
          source: orgId ? 'custom' : 'platform',
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Email template created successfully',
      });

      await fetchTemplates();
    } catch (error: any) {
      console.error('Error creating email template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create email template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateTemplate = async (id: string, templateData: {
    name?: string;
    subject?: string;
    body?: string;
  }) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .update(templateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Email template updated successfully',
      });

      await fetchTemplates();
    } catch (error: any) {
      console.error('Error updating email template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update email template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Email template deleted successfully',
      });

      await fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting email template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete email template',
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
