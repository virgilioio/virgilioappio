import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type BundleSize = '500' | '1500' | '5000';

interface CreateCreditPurchaseParams {
  bundleSize: BundleSize;
}

interface CreateCreditPurchaseResponse {
  url: string;
  sessionId: string;
}

export function useCreateCreditPurchase() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ bundleSize }: CreateCreditPurchaseParams): Promise<CreateCreditPurchaseResponse> => {
      const { data, error } = await supabase.functions.invoke('create-credit-purchase', {
        body: { bundleSize }
      });

      if (error) {
        console.error('Error creating credit purchase:', error);
        throw error;
      }

      if (!data?.url) {
        throw new Error('No checkout URL returned');
      }

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Redirecting to checkout...',
        description: 'You will be redirected to complete your purchase.',
      });
      // Redirect to Stripe checkout
      window.location.href = data.url;
    },
    onError: (error: Error) => {
      console.error('Credit purchase error:', error);
      const message = error.message || 'Failed to create checkout session';
      toast({
        title: 'Purchase Failed',
        description: message,
        variant: 'destructive',
      });
    },
  });
}
