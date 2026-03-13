const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !MESSAGING_SERVICE_SID) {
      return new Response(
        JSON.stringify({ error: "Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_MESSAGING_SERVICE_SID" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inboundUrl = `${supabaseUrl}/functions/v1/whatsapp-inbound-webhook`;

    const response = await fetch(
      `https://messaging.twilio.com/v1/Services/${MESSAGING_SERVICE_SID}`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          InboundRequestUrl: inboundUrl,
          InboundMethod: "POST",
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to configure Messaging Service:", data);
      return new Response(
        JSON.stringify({ error: "Failed to configure Messaging Service", details: data }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Messaging Service InboundRequestUrl configured to:", inboundUrl);

    return new Response(
      JSON.stringify({
        success: true,
        inbound_url: inboundUrl,
        messaging_service_sid: MESSAGING_SERVICE_SID,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in fix-whatsapp-webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
