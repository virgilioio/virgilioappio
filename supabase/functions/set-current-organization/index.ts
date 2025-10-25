import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

// Timeout wrapper utility
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([promise, timeoutPromise]);
}

serve(async (req) => {
  const startTime = Date.now();
  console.log('[set-current-organization] Invocation started', {
    timestamp: new Date().toISOString(),
    method: req.method
  });

  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    
    // Auth check with 3s timeout
    const { data: userData, error: userError } = await withTimeout(
      supabase.auth.getUser(token),
      3000,
      'Auth verification'
    );
    
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");
    
    console.log('[set-current-organization] User authenticated', {
      userId: user.id,
      email: user.email
    });

    const body = await req.json().catch(() => ({}));
    const organizationId = body.organizationId as string | undefined;
    if (!organizationId) throw new Error("organizationId is required");

    // Verify membership with 3s timeout
    const { data: member, error: memberError } = await withTimeout(
      supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .eq("user_status", "active")
        .maybeSingle(),
      3000,
      'Membership verification'
    );

    if (memberError) throw new Error(memberError.message);
    if (!member) {
      console.warn('[set-current-organization] Not a member', {
        userId: user.id,
        organizationId
      });
      return new Response(JSON.stringify({ error: "Not a member of this organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log('[set-current-organization] Membership verified', {
      memberId: member.id,
      organizationId
    });

    const currentMeta = user.user_metadata || {};
    const updatedMeta = { ...currentMeta, organization_id: organizationId };

    console.log('[set-current-organization] Updating user metadata...');
    
    // Metadata update with 5s timeout
    const { error: updateError } = await withTimeout(
      supabase.auth.admin.updateUserById(user.id, {
        user_metadata: updatedMeta,
      }),
      5000,
      'Metadata update'
    );
    
    if (updateError) throw new Error(updateError.message);

    const duration = Date.now() - startTime;
    console.log('[set-current-organization] Success', { duration });
    
    if (duration > 5000) {
      console.warn(`[set-current-organization] Slow operation: ${duration}ms`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const duration = Date.now() - startTime;
    
    console.error('[set-current-organization] Error', {
      error: message,
      duration
    });
    
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
