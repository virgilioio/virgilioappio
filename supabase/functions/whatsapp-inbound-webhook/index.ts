import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Twilio sends webhooks as application/x-www-form-urlencoded
    const formData = await req.formData();
    const from = (formData.get("From") as string) || "";
    const to = (formData.get("To") as string) || "";
    const body = (formData.get("Body") as string) || "";
    const messageSid = (formData.get("MessageSid") as string) || "";

    console.log(`Inbound WhatsApp: From=${from}, To=${to}, Body=${body.substring(0, 50)}`);

    if (!from || !to) {
      return new Response("<Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Strip "whatsapp:" prefix for matching
    const candidatePhone = from.replace("whatsapp:", "").replace(/^\+/, "");
    const workspacePhone = to.replace("whatsapp:", "");

    // Find workspace_automations that owns this number
    const { data: automation } = await supabase
      .from("workspace_automations")
      .select("tenant_id, config")
      .eq("automation_type", "whatsapp_config")
      .single();

    // Try to match by number — check multiple formats
    let tenantId: string | null = null;

    if (automation) {
      const configNumber = (automation.config?.whatsapp_number as string) || "";
      const configClean = configNumber.replace(/[^\d]/g, "");
      const workspaceClean = workspacePhone.replace(/[^\d]/g, "");

      if (configClean && workspaceClean && configClean === workspaceClean) {
        tenantId = automation.tenant_id;
      }
    }

    // If single match failed, search all automations
    if (!tenantId) {
      const { data: allAutomations } = await supabase
        .from("workspace_automations")
        .select("tenant_id, config")
        .eq("automation_type", "whatsapp_config");

      const workspaceClean = workspacePhone.replace(/[^\d]/g, "");
      const match = (allAutomations || []).find((a) => {
        const num = ((a.config?.whatsapp_number as string) || "").replace(/[^\d]/g, "");
        return num && workspaceClean && num === workspaceClean;
      });

      if (match) tenantId = match.tenant_id;
    }

    if (!tenantId) {
      console.warn(`No tenant found for inbound number: ${workspacePhone}`);
      return new Response("<Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Find existing conversation by candidate phone + tenant
    // Normalize candidate phone for lookup (try with and without +)
    const candidatePhoneFormats = [
      candidatePhone,
      `+${candidatePhone}`,
      candidatePhone.replace(/^0+/, ""),
    ];

    const { data: conversations } = await supabase
      .from("whatsapp_conversations")
      .select("id, candidate_id, job_id")
      .eq("tenant_id", tenantId)
      .in("phone_number", candidatePhoneFormats)
      .order("last_message_at", { ascending: false })
      .limit(1);

    const conversation = conversations?.[0];

    if (!conversation) {
      console.log(`No existing conversation for phone ${candidatePhone} in tenant ${tenantId}. Storing as orphan.`);
      // Could create a new conversation here in the future
      return new Response("<Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Insert inbound message
    const { error: msgError } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversation.id,
        tenant_id: tenantId,
        candidate_id: conversation.candidate_id,
        job_id: conversation.job_id,
        sender_id: null, // inbound from candidate
        to_phone: workspacePhone,
        from_phone: from.replace("whatsapp:", ""),
        body: body,
        twilio_sid: messageSid,
        status: "received",
        direction: "inbound",
      });

    if (msgError) {
      console.error("Failed to insert inbound message:", msgError);
    }

    // Update conversation: last message + increment unread
    const previewText = body.substring(0, 100) || "[media]";
    const { error: convError } = await supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: previewText,
        unread_count: (conversation as any).unread_count
          ? (conversation as any).unread_count + 1
          : 1,
      })
      .eq("id", conversation.id);

    if (convError) {
      console.error("Failed to update conversation:", convError);
    }

    // Return empty TwiML (no auto-reply)
    return new Response("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error: unknown) {
    console.error("Error in whatsapp-inbound-webhook:", error);
    // Always return 200 to Twilio to prevent retries
    return new Response("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
});
