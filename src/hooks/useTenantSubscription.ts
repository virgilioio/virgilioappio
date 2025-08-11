
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TenantSubscription {
  id: string;
  tenant_id: string;
  stripe_customer_id?: string | null;
  subscribed: boolean;
  subscription_tier?: string | null;
  billing_interval?: "month" | "year" | null;
  seat_quantity: number;
  trial_end?: string | null;
  subscription_end?: string | null;
  updated_at: string;
  created_at: string;
}

export function useTenantSubscription() {
  return useQuery({
    queryKey: ["tenant-subscription"],
    queryFn: async (): Promise<{ subscription: TenantSubscription | null }> => {
      console.log("[useTenantSubscription] fetching");
      // Get tenant id via RPC
      const { data: tenantId, error: tenantErr } = await supabase.rpc("get_user_tenant_id");
      if (tenantErr) {
        console.error("[useTenantSubscription] get_user_tenant_id error", tenantErr);
        throw tenantErr;
      }
      if (!tenantId) {
        return { subscription: null };
      }
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();
      if (error) {
        // Non-admins may not have SELECT access by RLS; surface as null for UI
        console.warn("[useTenantSubscription] tenant_subscriptions select error (likely RLS):", error.message);
        return { subscription: null };
      }
      return { subscription: data as TenantSubscription };
    },
    staleTime: 15000,
  });
}
