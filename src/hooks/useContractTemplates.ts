import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ContractTemplate {
  id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  content: string;
  source: 'platform' | 'tenant';
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
        query = query.is('tenant_id', null);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: memberData } = await supabase
          .from('members')
          .select('tenant_id')
          .eq('user_id', user.id)
          .eq('user_status', 'active')
          .single();

        if (!memberData?.tenant_id) {
          setTemplates([]);
          return;
        }

        query = query.or(`tenant_id.eq.${memberData.tenant_id},tenant_id.is.null`);
      }

      const { data, error } = await query
        .order('tenant_id', { ascending: true, nullsFirst: true })
        .order('name');

      if (error) throw error;
      
      // Add source identification
      const templatesWithSource = (data || []).map((template: any) => ({
        ...template,
        source: template.tenant_id ? 'tenant' as const : 'platform' as const
      }));
      
      setTemplates(templatesWithSource);
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
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let tenantId: string | null = null;
      
      if (context === 'organization') {
        const { data: memberData } = await supabase
          .from('members')
          .select('tenant_id, user_type')
          .eq('user_id', user.id)
          .eq('user_status', 'active')
          .single();
        
        if (memberData?.user_type === 'workspace_owner') {
          tenantId = memberData?.tenant_id || null;
        }
      }

      const { error } = await supabase
        .from('contract_templates')
        .insert({
          name: templateData.name,
          description: templateData.description,
          content: templateData.content,
          tenant_id: tenantId,
          created_by: user.id,
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

  const copyPlatformTemplate = async (templateId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: memberData } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user?.id)
        .eq('user_status', 'active')
        .single();

      if (!memberData?.tenant_id) {
        throw new Error('No tenant found');
      }

      const { data, error } = await supabase.rpc('copy_platform_template_to_tenant', {
        p_template_table: 'contract_templates',
        p_template_id: templateId,
        p_target_tenant_id: memberData.tenant_id
      });

      if (error) throw error;
      
      await fetchTemplates();
      toast({
        title: 'Success',
        description: 'Template copied to your library',
      });
      
      return data;
    } catch (error: any) {
      console.error('Error copying platform template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to copy template',
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
    copyPlatformTemplate,
    refetchTemplates: fetchTemplates,
  };
}
