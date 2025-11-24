import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Tenant {
  id: string;
  name: string;
  tenant_type: string;
  status: string;
  about?: string | null;
  billing_email?: string | null;
  billing_contact_name?: string | null;
  billing_phone?: string | null;
  created_at: string;
}

export function useTenant() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch current user's tenant
  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['tenant', user?.id],
    queryFn: async (): Promise<Tenant | null> => {
      if (!user) return null;

      // Get tenant_id from user's member record
      const { data: member } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .single();

      if (!member) return null;

      // Fetch tenant
      const { data: tenantData, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', member.tenant_id)
        .single();

      if (error) throw error;
      return tenantData;
    },
    enabled: !!user,
  });

  // Update tenant mutation
  const updateTenant = useMutation({
    mutationFn: async (updates: Partial<Tenant>) => {
      if (!tenant?.id) throw new Error('No tenant ID');

      const { data, error } = await supabase
        .from('tenants')
        .update(updates)
        .eq('id', tenant.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast({
        title: 'Success',
        description: 'Company profile updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update company profile',
        variant: 'destructive',
      });
      console.error('Tenant update error:', error);
    },
  });

  return {
    tenant,
    isLoading,
    error,
    updateTenant,
  };
}
