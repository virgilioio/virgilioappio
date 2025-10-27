import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();
const log = (msg: string, data?: unknown) => console.log(`[create-booking-config] ${msg}`, data ?? "");

interface CreateBookingConfigBody {
  user_id?: string;
  first_name: string;
  last_name: string;
  organization_id: string;
  timezone?: string;
}

/**
 * Generate a unique short code for booking URL
 * Format: {firstName}-{lastName}-{4-char-random}
 * Example: john-smith-k7x9
 */
function generateShortCode(firstName: string, lastName: string): string {
  const baseSlug = `${firstName}-${lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  const suffix = Array.from({ length: 4 }, () => 
    'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
  ).join('');
  
  return `${baseSlug}-${suffix}`;
}

serve(async (req) => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase env vars");
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, { 
      auth: { persistSession: false } 
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Authorization header");
    const token = authHeader.replace("Bearer ", "");

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) throw new Error(`Auth error: ${userErr?.message}`);
    const authenticatedUserId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as CreateBookingConfigBody;
    const {
      user_id = authenticatedUserId,
      first_name,
      last_name,
      organization_id,
      timezone = 'America/New_York'
    } = body;

    if (!first_name?.trim() || !last_name?.trim()) {
      throw new Error("first_name and last_name are required");
    }
    if (!organization_id) {
      throw new Error("organization_id is required");
    }

    if (user_id !== authenticatedUserId) {
      throw new Error("Cannot create booking config for another user");
    }

    log("Creating booking config", { user_id, organization_id });

    const { data: existing } = await supabase
      .from('booking_configurations')
      .select('id, short_code, is_active')
      .eq('user_id', user_id)
      .maybeSingle();

    if (existing) {
      log("Booking config already exists", { short_code: existing.short_code });
      return new Response(
        JSON.stringify({
          status: 'exists',
          booking_config_id: existing.id,
          short_code: existing.short_code,
          booking_url: `${req.headers.get('origin') || supabaseUrl.replace('.supabase.co', '.lovable.app')}/schedule/${existing.short_code}`,
          is_active: existing.is_active
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    let shortCode: string | null = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (!shortCode && attempts < maxAttempts) {
      const candidate = generateShortCode(first_name, last_name);
      const { data: collision } = await supabase
        .from('booking_configurations')
        .select('id')
        .eq('short_code', candidate)
        .maybeSingle();

      if (!collision) {
        shortCode = candidate;
      }
      attempts++;
    }

    if (!shortCode) {
      throw new Error("Failed to generate unique short code after multiple attempts");
    }

    log("Generated short code", { shortCode, attempts });

    const { data: calendarIdentity } = await supabase
      .from('calendar_identities')
      .select('id, is_active')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .maybeSingle();

    const isActive = !!calendarIdentity;

    const { data: bookingConfig, error: insertErr } = await supabase
      .from('booking_configurations')
      .insert({
        user_id,
        organization_id,
        short_code: shortCode,
        display_name: `${first_name} ${last_name}`,
        timezone,
        is_active: isActive,
        available_days: [1, 2, 3, 4, 5],
        start_time: '09:00',
        end_time: '17:00',
        duration_minutes: 30,
        buffer_time_minutes: 15,
        min_notice_hours: 24,
        max_days_ahead: 30
      })
      .select('id, short_code, is_active')
      .single();

    if (insertErr) throw new Error(`Failed to create booking config: ${insertErr.message}`);

    log("Booking config created successfully", { 
      booking_config_id: bookingConfig.id,
      short_code: bookingConfig.short_code,
      is_active: bookingConfig.is_active
    });

    const bookingUrl = `${req.headers.get('origin') || supabaseUrl.replace('.supabase.co', '.lovable.app')}/schedule/${bookingConfig.short_code}`;

    return new Response(
      JSON.stringify({
        status: 'created',
        booking_config_id: bookingConfig.id,
        short_code: bookingConfig.short_code,
        booking_url: bookingUrl,
        is_active: bookingConfig.is_active
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 201 }
    );

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[create-booking-config] ERROR", message);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
