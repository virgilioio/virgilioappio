import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@16";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

serve(async (req) => {
  // Handle CORS preflight requests
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  try {
    // Verify JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Stripe prices for user:', user.id);

    // Get Price IDs from environment variables
    const monthlyPriceId = Deno.env.get('STRIPE_PRICE_MONTHLY');
    const yearlyPriceId = Deno.env.get('STRIPE_PRICE_YEARLY');

    console.log('Price IDs:', { monthlyPriceId, yearlyPriceId });

    // Fetch prices from Stripe
    const [monthlyPrice, yearlyPrice] = await Promise.all([
      monthlyPriceId ? stripe.prices.retrieve(monthlyPriceId, { expand: ['product'] }).catch(err => {
        console.error('Error fetching monthly price:', err);
        return null;
      }) : Promise.resolve(null),
      yearlyPriceId ? stripe.prices.retrieve(yearlyPriceId, { expand: ['product'] }).catch(err => {
        console.error('Error fetching yearly price:', err);
        return null;
      }) : Promise.resolve(null),
    ]);

    console.log('Fetched prices:', { 
      monthly: monthlyPrice ? { amount: monthlyPrice.unit_amount, currency: monthlyPrice.currency } : null,
      yearly: yearlyPrice ? { amount: yearlyPrice.unit_amount, currency: yearlyPrice.currency } : null
    });

    // Extract product data
    const monthlyProduct = monthlyPrice?.product && typeof monthlyPrice.product === 'object' ? monthlyPrice.product : null;
    const yearlyProduct = yearlyPrice?.product && typeof yearlyPrice.product === 'object' ? yearlyPrice.product : null;

    const response = {
      monthly: monthlyPrice ? {
        priceId: monthlyPrice.id,
        amount: monthlyPrice.unit_amount || 0,
        currency: monthlyPrice.currency,
        interval: 'month',
        productImage: monthlyProduct?.images?.[0] || null,
        productName: monthlyProduct?.name || null,
      } : null,
      yearly: yearlyPrice ? {
        priceId: yearlyPrice.id,
        amount: yearlyPrice.unit_amount || 0,
        currency: yearlyPrice.currency,
        interval: 'year',
        productImage: yearlyProduct?.images?.[0] || null,
        productName: yearlyProduct?.name || null,
      } : null,
      trialDays: 14 // Default trial period
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
        } 
      }
    );

  } catch (error) {
    console.error('Error in get-stripe-prices function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
