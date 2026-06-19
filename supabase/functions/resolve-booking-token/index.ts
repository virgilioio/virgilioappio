import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role key since this is a public endpoint
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get token from query params or body
    let token: string | null = null;
    
    const url = new URL(req.url);
    token = url.searchParams.get('token');
    
    if (!token && req.method === 'POST') {
      const body = await req.json();
      token = body.token;
    }

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up the token
    const { data: tokenData, error: lookupError } = await supabase
      .from('booking_link_tokens')
      .select('*')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (lookupError) {
      console.error('Error looking up token:', lookupError);
      return new Response(
        JSON.stringify({ error: 'Failed to lookup token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokenData) {
      return new Response(
        JSON.stringify({ error: 'Token not found or expired', context: null, token_status: 'expired' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return the booking context in the same format as the original base64 context
    const context = {
      jobId: tokenData.job_id,
      candidateId: tokenData.candidate_id,
      jhsId: tokenData.jhs_id,
      associationId: tokenData.association_id,
      candidateName: tokenData.candidate_name,
      candidateEmail: tokenData.candidate_email,
      jobTitle: tokenData.job_title,
      stageName: tokenData.stage_name,
    };

    // Check for existing confirmed booking for this candidate + stage
    let existingBooking = null;
    let tokenStatus: 'active' | 'expired' = 'active';

    if (tokenData.candidate_id && tokenData.jhs_id) {
      const { data: bookings } = await supabase
        .from('scheduled_bookings')
        .select('id, scheduled_start, scheduled_end, duration_minutes, status, candidate_name, candidate_email, candidate_phone, candidate_timezone, meeting_location, meeting_type, google_meet_link, notes, ics_uid, booking_config_id, interviewer_id, job_id, job_hiring_stage_id')
        .eq('candidate_id', tokenData.candidate_id)
        .eq('job_hiring_stage_id', tokenData.jhs_id)
        .eq('status', 'confirmed')
        .order('scheduled_start', { ascending: false })
        .limit(1);

      if (bookings && bookings.length > 0) {
        const booking = bookings[0];
        const scheduledEnd = new Date(booking.scheduled_end);
        const now = new Date();
        const tokenCreatedAt = tokenData.created_at ? new Date(tokenData.created_at) : null;

        if (scheduledEnd < now) {
          // Past booking exists. Only treat as expired if the token predates the booking end
          // (i.e. it's the original invite). A token minted AFTER the booking ended is a
          // deliberate renewal/reschedule and should resolve as active.
          if (!tokenCreatedAt || tokenCreatedAt <= scheduledEnd) {
            tokenStatus = 'expired';
          }
        } else {
          // Active future booking exists
          existingBooking = booking;

          // Also fetch interviewer profile for the existing booking view
          if (booking.interviewer_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name, avatar_url, email')
              .eq('user_id', booking.interviewer_id)
              .maybeSingle();

            if (profile) {
              existingBooking = { ...existingBooking, interviewer_profile: profile };
            }
          }

          // Fetch booking config display info
          if (booking.booking_config_id) {
            const { data: config } = await supabase
              .from('booking_configurations')
              .select('display_name, description')
              .eq('id', booking.booking_config_id)
              .maybeSingle();

            if (config) {
              existingBooking = { ...existingBooking, booking_config: config };
            }
          }
        }
      }

    }

    // For group tokens, fetch interviewer names so the public page can render
    // "Interview with Alice, Bob & Carol" without an extra round-trip.
    let groupInterviewers: Array<{ first_name: string; last_name: string; avatar_url: string | null }> | null = null;
    if (tokenData.scheduling_mode === 'group' && Array.isArray(tokenData.booking_config_ids) && tokenData.booking_config_ids.length > 0) {
      const { data: groupConfigs } = await supabase
        .from('booking_configurations')
        .select('user_id')
        .in('id', tokenData.booking_config_ids);

      const userIds = (groupConfigs || []).map(c => c.user_id);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, avatar_url')
          .in('user_id', userIds);

        // Preserve order matching booking_config_ids
        const profileByUser = new Map((profiles || []).map(p => [p.user_id, p]));
        groupInterviewers = (groupConfigs || [])
          .map(c => profileByUser.get(c.user_id))
          .filter(Boolean)
          .map((p: any) => ({ first_name: p.first_name, last_name: p.last_name, avatar_url: p.avatar_url }));
      }
    }

    return new Response(
      JSON.stringify({
        context,
        existing_booking: existingBooking,
        token_status: tokenStatus,
        scheduling_mode: tokenData.scheduling_mode || 'single',
        booking_config_ids: tokenData.booking_config_ids || null,
        primary_short_code: tokenData.short_code || null,
        group_interviewers: groupInterviewers,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in resolve-booking-token:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
