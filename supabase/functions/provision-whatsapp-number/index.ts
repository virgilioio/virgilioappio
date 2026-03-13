import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's tenant
    const { data: member } = await supabase
      .from("members")
      .select("tenant_id")
      .eq("user_id", userId)
      .eq("user_status", "active")
      .limit(1)
      .single();

    if (!member?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = member.tenant_id;

    // Check if already provisioned
    const { data: existing } = await supabase
      .from("workspace_automations")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("automation_type", "whatsapp_config")
      .maybeSingle();

    if (existing?.config?.whatsapp_number) {
      return new Response(
        JSON.stringify({
          success: true,
          number: existing.config.whatsapp_number,
          already_provisioned: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    // Parse optional country code from request body
    let countryCode = "US";
    try {
      const body = await req.json();
      if (body?.country_code) countryCode = body.country_code;
    } catch {
      // No body or invalid JSON, use default
    }

    // Step 1: Search for available phone numbers
    const searchResponse = await fetch(
      `${GATEWAY_URL}/AvailablePhoneNumbers/${countryCode}/Local.json?SmsEnabled=true&VoiceEnabled=true&Limit=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
        },
      }
    );

    const searchData = await searchResponse.json();
    if (!searchResponse.ok || !searchData.available_phone_numbers?.length) {
      console.error("No available numbers:", searchData);
      return new Response(
        JSON.stringify({ error: "No phone numbers available. Try a different country." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const availableNumber = searchData.available_phone_numbers[0];

    // Step 2: Purchase the number
    const purchaseResponse = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        PhoneNumber: availableNumber.phone_number,
        FriendlyName: `GoGio WhatsApp - ${tenantId.substring(0, 8)}`,
      }),
    });

    const purchaseData = await purchaseResponse.json();
    if (!purchaseResponse.ok) {
      console.error("Purchase error:", purchaseData);
      return new Response(
        JSON.stringify({ error: `Failed to purchase number: ${purchaseData.message || JSON.stringify(purchaseData)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phoneNumber = purchaseData.phone_number;
    const phoneSid = purchaseData.sid;

    // Step 3: Configure webhook URL on the purchased number
    try {
      const webhookResponse = await fetch(
        `${GATEWAY_URL}/IncomingPhoneNumbers/${phoneSid}.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            SmsUrl: `${supabaseUrl}/functions/v1/whatsapp-inbound-webhook`,
            SmsMethod: "POST",
          }),
        }
      );

      if (!webhookResponse.ok) {
        const webhookError = await webhookResponse.json();
        console.error("Webhook config warning (non-fatal):", webhookError);
      } else {
        console.log("Webhook URL configured on number:", phoneSid);
      }
    } catch (webhookErr) {
      console.error("Webhook config failed (non-fatal):", webhookErr);
    }

    // Step 4: Register number as WhatsApp Sender via Messaging Service
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && MESSAGING_SERVICE_SID) {
      try {
        const senderResponse = await fetch(
          `https://messaging.twilio.com/v1/Services/${MESSAGING_SERVICE_SID}/PhoneNumbers`,
          {
            method: "POST",
            headers: {
              Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ PhoneNumberSid: phoneSid }),
          }
        );

        if (!senderResponse.ok) {
          const senderError = await senderResponse.json();
          console.error("WhatsApp Sender registration warning (non-fatal):", senderError);
        } else {
          console.log("Number registered as WhatsApp Sender:", phoneSid);
        }
      } catch (senderErr) {
        console.error("WhatsApp Sender registration failed (non-fatal):", senderErr);
      }

      // Step 4b: Configure Messaging Service InboundRequestUrl for inbound WhatsApp messages
      try {
        const msgServiceResponse = await fetch(
          `https://messaging.twilio.com/v1/Services/${MESSAGING_SERVICE_SID}`,
          {
            method: "POST",
            headers: {
              Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              InboundRequestUrl: `${supabaseUrl}/functions/v1/whatsapp-inbound-webhook`,
              InboundMethod: "POST",
            }),
          }
        );

        if (!msgServiceResponse.ok) {
          const msgServiceError = await msgServiceResponse.json();
          console.error("Messaging Service InboundRequestUrl config warning (non-fatal):", msgServiceError);
        } else {
          console.log("Messaging Service InboundRequestUrl configured successfully");
        }
      } catch (msgServiceErr) {
        console.error("Messaging Service InboundRequestUrl config failed (non-fatal):", msgServiceErr);
      }
    } else {
      console.warn("Twilio master credentials not configured — WhatsApp Sender registration skipped");
    }

    // Step 5: Save to workspace_automations
    const { error: upsertError } = await supabase
      .from("workspace_automations")
      .upsert(
        {
          tenant_id: tenantId,
          automation_type: "whatsapp_config",
          created_by: userId,
          is_active: true,
          config: {
            whatsapp_number: phoneNumber,
            whatsapp_number_sid: phoneSid,
            twilio_from_number: `whatsapp:${phoneNumber}`,
            is_connected: true,
            provisioned_at: new Date().toISOString(),
          },
        },
        { onConflict: "tenant_id,automation_type" }
      );

    if (upsertError) {
      console.error("DB save error:", upsertError);
      throw new Error("Failed to save provisioned number");
    }

    return new Response(
      JSON.stringify({
        success: true,
        number: phoneNumber,
        sid: phoneSid,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in provision-whatsapp-number:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
