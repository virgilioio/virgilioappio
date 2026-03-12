import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CONTENT_API_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

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
    const { action, ...params } = await req.json();

    switch (action) {
      case "list": {
        // Return global templates + tenant-specific templates
        const { data: templates, error } = await supabase
          .from("whatsapp_templates")
          .select("*")
          .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
          .order("created_at", { ascending: true });

        if (error) throw error;

        return new Response(JSON.stringify({ templates: templates || [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create": {
        const { name, category, language, body_template, variable_mapping } = params;

        if (!name || !body_template) {
          return new Response(
            JSON.stringify({ error: "Missing required fields: name, body_template" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Convert named placeholders like {{candidate_name}} → {{1}} and build variable_mapping
        const namedVarRegex = /\{\{([a-z_]+)\}\}/g;
        const foundVars: string[] = [];
        let match;
        const tempBody = body_template;
        while ((match = namedVarRegex.exec(tempBody)) !== null) {
          const varName = match[1];
          // Skip if it's already a number (legacy format)
          if (/^\d+$/.test(varName)) continue;
          if (!foundVars.includes(varName)) {
            foundVars.push(varName);
          }
        }

        let convertedBody = body_template;
        const derivedMapping: Record<string, string> = {};

        if (foundVars.length > 0) {
          foundVars.forEach((varName, index) => {
            const num = String(index + 1);
            convertedBody = convertedBody.replace(
              new RegExp(`\\{\\{${varName}\\}\\}`, 'g'),
              `{{${num}}}`
            );
            derivedMapping[num] = varName;
          });
        }

        // Use provided variable_mapping if no named vars were found, otherwise use derived
        const finalMapping = foundVars.length > 0 ? derivedMapping : (variable_mapping || {});

        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

        const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
        if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

        // Save as draft in our DB with converted body and mapping
        const { data: template, error: insertError } = await supabase
          .from("whatsapp_templates")
          .insert({
            tenant_id: tenantId,
            name,
            category: category || "UTILITY",
            language: language || "en",
            body_template: convertedBody,
            variable_mapping: finalMapping,
            approval_status: "pending",
            created_by: userId,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        return new Response(JSON.stringify({ template }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check-status": {
        const { template_id } = params;

        if (!template_id) {
          return new Response(
            JSON.stringify({ error: "Missing template_id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: template, error } = await supabase
          .from("whatsapp_templates")
          .select("*")
          .eq("id", template_id)
          .single();

        if (error) throw error;

        // If it has a Twilio Content SID, we could poll Twilio for status
        // For now return current DB status
        return new Response(JSON.stringify({ template }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("Error in manage-whatsapp-templates:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
