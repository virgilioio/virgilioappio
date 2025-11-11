import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface StripePriceData {
  priceId: string;
  amount: number;
  currency: string;
  interval: string;
  productImage?: string | null;
  productName?: string | null;
}

interface StripePricingResponse {
  monthly: StripePriceData | null;
  yearly: StripePriceData | null;
  trialDays: number;
}

export function useStripePricing() {
  return useQuery({
    queryKey: ['stripe-pricing'],
    queryFn: async (): Promise<StripePricingResponse> => {
      const { data, error } = await supabase.functions.invoke('get-stripe-prices');
      
      if (error) {
        console.error('Error fetching Stripe pricing:', error);
        // Return fallback values
        return {
          monthly: { priceId: '', amount: 1000, currency: 'usd', interval: 'month' },
          yearly: { priceId: '', amount: 9900, currency: 'usd', interval: 'year' },
          trialDays: 14
        };
      }
      
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 3,
  });
}
