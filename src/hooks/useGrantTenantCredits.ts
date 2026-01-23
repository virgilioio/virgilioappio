import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

interface GrantCreditsParams {
  tenantId: string;
  credits: number;
  reason: string;
}

export function useGrantTenantCredits() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ tenantId, credits, reason }: GrantCreditsParams) => {
      const { data, error } = await supabase.functions.invoke('grant-tenant-credits', {
        body: { tenantId, credits, reason }
      });

      if (error) {
        console.error('Error granting credits:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data, variables) => {
      toast({
        title: 'Credits Granted',
        description: `Successfully granted ${variables.credits} credits to the customer.`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription', variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['credit-purchases', variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['saas-customer', variables.tenantId] });
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'sourcing-credits' 
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Grant Credits',
        description: error?.message || 'An error occurred while granting credits.',
        variant: 'destructive',
      });
    },
  });
}
