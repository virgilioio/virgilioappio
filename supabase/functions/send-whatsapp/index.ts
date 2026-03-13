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
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth client to verify user
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

    // Service role client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { to, body, candidate_id, job_id, template_id, template_variables } = await req.json();

    if (!to || !candidate_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, candidate_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Must have either body (freeform) or template_id
    if (!body && !template_id) {
      return new Response(
        JSON.stringify({ error: "Must provide either body or template_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Get WhatsApp config from workspace_automations
    const { data: config } = await supabase
      .from("workspace_automations")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("automation_type", "whatsapp_config")
      .single();

    if (!config?.config?.twilio_from_number) {
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured. Set up your WhatsApp sender number in Settings > Integrations." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromNumber = config.config.twilio_from_number as string;

    // Check Twilio credentials
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    // Sanitize and format WhatsApp numbers to E.164
    const sanitize = (phone: string) => phone.replace(/[^\d+]/g, '');
    const toClean = sanitize(to.startsWith("whatsapp:") ? to.slice(9) : to);
    const fromClean = sanitize(fromNumber.startsWith("whatsapp:") ? fromNumber.slice(9) : fromNumber);
    const toWhatsApp = `whatsapp:+${toClean.replace(/^\+/, '')}`;
    const fromWhatsApp = `whatsapp:+${fromClean.replace(/^\+/, '')}`;

    // Build message params - template or freeform
    const messageParams: Record<string, string> = {
      To: toWhatsApp,
      From: fromWhatsApp,
    };

    let messageBody = body || "";

    if (template_id) {
      // Look up template to get ContentSid and body
      const { data: template } = await supabase
        .from("whatsapp_templates")
        .select("twilio_content_sid, body_template")
        .eq("id", template_id)
        .single();

      if (template?.twilio_content_sid) {
        // Use Twilio Content API template
        messageParams.ContentSid = template.twilio_content_sid;
        if (template_variables) {
          messageParams.ContentVariables = JSON.stringify(template_variables);
        }
      } else {
        // Template exists but no ContentSid yet - send body with variables substituted
        messageBody = template?.body_template || body || "";
        if (template_variables) {
          Object.entries(template_variables as Record<string, string>).forEach(([key, value]) => {
            messageBody = messageBody.replace(`{{${key}}}`, value);
          });
        }
        messageParams.Body = messageBody;
      }
    } else {
      messageParams.Body = body;
      messageBody = body;
    }

    // Send via Twilio gateway
    const twilioResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(messageParams),
    });

    const twilioData = await twilioResponse.json();
    if (!twilioResponse.ok) {
      console.error("Twilio API error:", JSON.stringify(twilioData));

      // Map known Twilio error codes to actionable messages
      const twilioCode = twilioData?.code;
      const errorMap: Record<number, string> = {
        63007: `The From number (${fromWhatsApp}) is not registered as an active WhatsApp Sender in Twilio. Please verify the number in your Twilio console and update it in Settings > Integrations.`,
        63016: `The message body or template is not valid for WhatsApp. Please check your template content.`,
        63049: `This marketing template was blocked by Meta. Since April 2025, WhatsApp marketing messages are blocked for US numbers. Please delete this template and re-create it as a Utility template.`,
        21211: `The 'To' phone number (${toWhatsApp}) is not valid. Please verify the candidate's phone number.`,
        21608: `The From number is not enabled for WhatsApp. Register it as a WhatsApp Sender in Twilio first.`,
      };

      const friendlyError = errorMap[twilioCode] || `Twilio error (${twilioCode || 'unknown'}): ${twilioData.message || JSON.stringify(twilioData)}`;

      return new Response(
        JSON.stringify({ error: friendlyError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Safe preview text
    const previewText = (messageBody || "").substring(0, 100) || "[template message]";

    // Upsert conversation
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        {
          tenant_id: tenantId,
          candidate_id,
          job_id: job_id || null,
          phone_number: to,
          last_message_at: new Date().toISOString(),
          last_message_preview: previewText,
          unread_count: 0,
        },
        { onConflict: "tenant_id,candidate_id,job_id" }
      )
      .select("id")
      .single();

    if (!conversation) {
      throw new Error("Failed to create/update conversation");
    }

    // Insert message
    const { data: message, error: msgError } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversation.id,
        tenant_id: tenantId,
        candidate_id,
        job_id: job_id || null,
        sender_id: userId,
        to_phone: to,
        from_phone: fromNumber,
        body: messageBody || previewText,
        twilio_sid: twilioData.sid || null,
        status: "sent",
        direction: "outbound",
      })
      .select("*")
      .single();

    if (msgError) {
      console.error("Message insert error:", msgError);
      throw new Error("Failed to save message");
    }

    return new Response(
      JSON.stringify({ success: true, message, twilio_sid: twilioData.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-whatsapp:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
