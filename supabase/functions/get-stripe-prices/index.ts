import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

serve(async (req) => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GoGio ATS Per-Seat Pricing Model
    // $99/seat/month or $999/seat/year
    // Credits: 100/seat/month (monthly) or 120/seat/month (annual, 20% bonus)
    
    const seatMonthlyPriceId = Deno.env.get("STRIPE_PRICE_SEAT_MONTHLY");
    const seatAnnualPriceId = Deno.env.get("STRIPE_PRICE_SEAT_ANNUAL");
    
    // Credit bundle price IDs (optional - can use inline pricing if not set)
    const credits500PriceId = Deno.env.get("STRIPE_PRICE_CREDITS_500");
    const credits1500PriceId = Deno.env.get("STRIPE_PRICE_CREDITS_1500");
    const credits5000PriceId = Deno.env.get("STRIPE_PRICE_CREDITS_5000");

    // Build response with per-seat pricing
    const response = {
      // Per-seat subscription pricing
      seatMonthly: {
        priceId: seatMonthlyPriceId || null,
        amount: 9900, // $99 in cents
        currency: 'usd',
        interval: 'month',
        creditsPerSeat: 100,
      },
      seatAnnual: {
        priceId: seatAnnualPriceId || null,
        amount: 99900, // $999 in cents
        currency: 'usd',
        interval: 'year',
        creditsPerSeat: 120, // 20% bonus for annual
      },
      
      // Credit bundle add-ons (one-time purchases)
      creditBundles: [
        {
          size: '500',
          credits: 500,
          amount: 4900, // $49
          priceId: credits500PriceId || null,
          savings: null, // Base tier
        },
        {
          size: '1500',
          credits: 1500,
          amount: 12900, // $129
          priceId: credits1500PriceId || null,
          savings: '12%', // Better per-credit rate
        },
        {
          size: '5000',
          credits: 5000,
          amount: 34900, // $349
          priceId: credits5000PriceId || null,
          savings: '29%', // Best per-credit rate
        },
      ],

      // Trial configuration
      trialDays: 14,
      trialCredits: 20, // 15 search + 5 collect
      requiresPaymentMethod: true, // CC wall
      
      // Feature highlights for UI
      features: {
        allFeaturesIncluded: true,
        freeHiringManagers: true,
        freeInterviewers: true,
        creditsPooled: true,
        creditsResetMonthly: true,
        bonusCreditsNeverExpire: true,
      },
      
      // Legacy compatibility (deprecated - use seatMonthly/seatAnnual)
      monthly: {
        priceId: seatMonthlyPriceId || '',
        amount: 9900,
        currency: 'usd',
        interval: 'month',
      },
      yearly: {
        priceId: seatAnnualPriceId || '',
        amount: 99900,
        currency: 'usd',
        interval: 'year',
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error("[get-stripe-prices] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
