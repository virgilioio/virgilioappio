import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { newInterval } = await req.json();

    if (!newInterval || !['month', 'year'].includes(newInterval)) {
      return new Response(JSON.stringify({ error: 'Invalid interval. Must be "month" or "year"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's organization tenant_id
    const { data: orgData, error: orgError } = await supabase
      .from('members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('user_status', 'active')
      .single();

    if (orgError || !orgData) {
      return new Response(JSON.stringify({ error: 'No active organization found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get tenant subscription
    const { data: tenantData, error: tenantError } = await supabase
      .from('organizations')
      .select('tenant_id')
      .eq('id', orgData.organization_id)
      .single();

    if (tenantError || !tenantData?.tenant_id) {
      return new Response(JSON.stringify({ error: 'No tenant found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Stripe subscription info
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('tenant_subscriptions')
      .select('stripe_subscription_id, stripe_customer_id, billing_interval')
      .eq('tenant_id', tenantData.tenant_id)
      .single();

    if (subscriptionError || !subscriptionData?.stripe_subscription_id) {
      return new Response(JSON.stringify({ error: 'No active subscription found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (subscriptionData.billing_interval === newInterval) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Already on ${newInterval}ly billing` 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the new price ID from Stripe
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
    });

    const newPrice = prices.data.find(price => 
      price.recurring?.interval === newInterval &&
      price.active
    );

    if (!newPrice) {
      return new Response(JSON.stringify({ error: `No ${newInterval}ly price found` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update the subscription in Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionData.stripe_subscription_id);
    
    const updatedSubscription = await stripe.subscriptions.update(
      subscriptionData.stripe_subscription_id,
      {
        items: [{
          id: subscription.items.data[0].id,
          price: newPrice.id,
        }],
        proration_behavior: 'create_prorations',
      }
    );

    // Update billing_interval in database
    await supabase
      .from('tenant_subscriptions')
      .update({ 
        billing_interval: newInterval,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantData.tenant_id);

    console.log(`Billing interval updated to ${newInterval} for tenant ${tenantData.tenant_id}`);

    return new Response(JSON.stringify({ 
      success: true,
      newInterval,
      nextBillingDate: new Date(updatedSubscription.current_period_end * 1000).toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error updating billing interval:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
