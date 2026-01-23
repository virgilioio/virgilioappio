import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SeatPricing {
  priceId: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  bonus?: string;
}

interface CreditBundle {
  id: string;
  priceId: string;
  credits: number;
  amount: number;
  currency: string;
  savings?: string;
}

export interface StripePricingResponse {
  seatMonthly: SeatPricing;
  seatAnnual: SeatPricing;
  creditBundles: CreditBundle[];
  trialDays: number;
  trialCredits: number;
  requiresPaymentMethod: boolean;
  features: {
    unlimitedJobs: boolean;
    unlimitedCandidates: boolean;
    emailIntegration: boolean;
    calendarSync: boolean;
    automations: boolean;
    aiScreening: boolean;
    customPipelines: boolean;
  };
  // Legacy compatibility
  monthly: { priceId: string; amount: number; currency: string; interval: string } | null;
  yearly: { priceId: string; amount: number; currency: string; interval: string } | null;
}

export function useStripePricing() {
  return useQuery({
    queryKey: ['stripe-pricing'],
    queryFn: async (): Promise<StripePricingResponse> => {
      const { data, error } = await supabase.functions.invoke('get-stripe-prices');
      
      if (error) {
        console.error('Error fetching Stripe pricing:', error);
        // Return fallback values for per-seat model
        return {
          seatMonthly: { priceId: '', amount: 9900, currency: 'usd', interval: 'month' },
          seatAnnual: { priceId: '', amount: 99900, currency: 'usd', interval: 'year', bonus: '~17% off + 20% more credits' },
          creditBundles: [
            { id: 'bundle_500', priceId: '', credits: 500, amount: 4900, currency: 'usd' },
            { id: 'bundle_1500', priceId: '', credits: 1500, amount: 12900, currency: 'usd', savings: 'Save 12%' },
            { id: 'bundle_5000', priceId: '', credits: 5000, amount: 34900, currency: 'usd', savings: 'Save 29%' },
          ],
          trialDays: 14,
          trialCredits: 20,
          requiresPaymentMethod: true,
          features: {
            unlimitedJobs: true,
            unlimitedCandidates: true,
            emailIntegration: true,
            calendarSync: true,
            automations: true,
            aiScreening: true,
            customPipelines: true,
          },
          monthly: { priceId: '', amount: 9900, currency: 'usd', interval: 'month' },
          yearly: { priceId: '', amount: 99900, currency: 'usd', interval: 'year' },
        };
      }
      
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 3,
  });
}
