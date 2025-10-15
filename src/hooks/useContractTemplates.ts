import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ContractTemplate {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  content: string;
  source: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type ContractTemplatesContext = 'platform-defaults' | 'organization';

export function useContractTemplates(context: ContractTemplatesContext = 'organization') {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('contract_templates')
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
      console.error('Error fetching contract templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch contract templates',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createTemplate = async (templateData: {
    name: string;
    description?: string;
    content: string;
    organization_id?: string | null;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('contract_templates')
        .insert({
          ...templateData,
          created_by: user.id,
          source: templateData.organization_id ? 'custom' : 'platform',
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Contract template created successfully',
      });

      await fetchTemplates();
    } catch (error: any) {
      console.error('Error creating contract template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create contract template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateTemplate = async (id: string, templateData: {
    name?: string;
    description?: string;
    content?: string;
  }) => {
    try {
      const { error } = await supabase
        .from('contract_templates')
        .update(templateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Contract template updated successfully',
      });

      await fetchTemplates();
    } catch (error: any) {
      console.error('Error updating contract template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update contract template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('contract_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Contract template deleted successfully',
      });

      await fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting contract template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete contract template',
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
