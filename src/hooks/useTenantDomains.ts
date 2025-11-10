import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

export interface TenantDomain {
  id: string;
  tenant_id: string;
  domain: string;
  verified: boolean;
  verification_token: string | null;
  verification_method: 'dns' | 'email' | 'manual' | null;
  added_by: string;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useTenantDomains(tenantId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: domains, isLoading, error } = useQuery({
    queryKey: ['tenant-domains', tenantId],
    queryFn: async () => {
      let query = supabase
        .from('tenant_domains')
        .select('*')
        .order('created_at', { ascending: false });

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TenantDomain[];
    },
    enabled: !!tenantId,
  });

  const addDomainMutation = useMutation({
    mutationFn: async ({ domain, tenantId: targetTenantId }: { domain: string; tenantId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('tenant_domains')
        .insert({
          tenant_id: targetTenantId,
          domain: domain.toLowerCase().trim(),
          added_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-domains'] });
      toast({
        title: 'Domain added',
        description: 'Domain added successfully. Verification pending.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to add domain',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateDomainMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TenantDomain> }) => {
      const { data, error } = await supabase
        .from('tenant_domains')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-domains'] });
      toast({
        title: 'Domain updated',
        description: 'Domain updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update domain',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tenant_domains')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-domains'] });
      toast({
        title: 'Domain deleted',
        description: 'Domain removed successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete domain',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: async ({ id, method }: { id: string; method: 'manual' | 'email' }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('tenant_domains')
        .update({
          verified: true,
          verification_method: method,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-domains'] });
      toast({
        title: 'Domain verified',
        description: 'Domain verified successfully. Users with this domain can now auto-join.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to verify domain',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    domains: domains || [],
    isLoading,
    error,
    addDomain: addDomainMutation.mutate,
    updateDomain: updateDomainMutation.mutate,
    deleteDomain: deleteDomainMutation.mutate,
    verifyDomain: verifyDomainMutation.mutate,
    isAddingDomain: addDomainMutation.isPending,
    isUpdatingDomain: updateDomainMutation.isPending,
    isDeletingDomain: deleteDomainMutation.isPending,
    isVerifyingDomain: verifyDomainMutation.isPending,
  };
}
