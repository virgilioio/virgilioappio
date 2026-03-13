import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sanitizeTemplateName(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function twilioBasicAuth(): string {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured");
  return "Basic " + btoa(`${sid}:${token}`);
}

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
        const { data: templates, error } = await supabase
          .from("whatsapp_templates")
          .select("*")
          .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
          .order("created_at", { ascending: true });

        if (error) throw error;

        // Auto-refresh pending templates by polling Twilio
        const pendingTemplates = (templates || []).filter(
          (t: Record<string, unknown>) => t.twilio_content_sid && t.approval_status === "pending"
        );

        for (const tmpl of pendingTemplates) {
          try {
            const statusRes = await fetch(
              `https://content.twilio.com/v1/Content/${tmpl.twilio_content_sid}/ApprovalRequests`,
              { headers: { Authorization: twilioBasicAuth() } }
            );
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              console.log(`[WhatsApp Templates] Poll ${tmpl.id} (${tmpl.twilio_content_sid}) raw:`, JSON.stringify(statusData));
              const mapped = extractWhatsAppStatus(statusData);
              if (mapped && mapped !== tmpl.approval_status) {
                console.log(`[WhatsApp Templates] Auto-refresh: ${tmpl.id} ${tmpl.approval_status} → ${mapped}`);
                await supabase
                  .from("whatsapp_templates")
                  .update({ approval_status: mapped })
                  .eq("id", tmpl.id);
                tmpl.approval_status = mapped;
              }
            }
          } catch (e) {
            console.error(`[WhatsApp Templates] Failed to poll status for ${tmpl.id}:`, e);
          }
        }

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
        const namedVarRegex = /\{\{([a-z_.]+)\}\}/g;
        const foundVars: string[] = [];
        let match;
        const tempBody = body_template;
        while ((match = namedVarRegex.exec(tempBody)) !== null) {
          const varName = match[1];
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

        const finalMapping = foundVars.length > 0 ? derivedMapping : (variable_mapping || {});

        const { data: template, error: insertError } = await supabase
          .from("whatsapp_templates")
          .insert({
            tenant_id: tenantId,
            name,
            category: category || "UTILITY",
            language: language || "en",
            body_template: convertedBody,
            variable_mapping: finalMapping,
            approval_status: "draft",
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

      case "submit": {
        const { template_id } = params;

        if (!template_id) {
          return new Response(
            JSON.stringify({ error: "Missing template_id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch template and validate tenant ownership
        const { data: tmpl, error: tmplError } = await supabase
          .from("whatsapp_templates")
          .select("*")
          .eq("id", template_id)
          .single();

        if (tmplError || !tmpl) {
          return new Response(
            JSON.stringify({ error: "Template not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (tmpl.tenant_id && tmpl.tenant_id !== tenantId) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: template belongs to another tenant" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (tmpl.twilio_content_sid) {
          return new Response(
            JSON.stringify({ error: "Template already submitted" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const authHeaderTwilio = twilioBasicAuth();

        // Step 1: Create Content resource on Twilio
        const variableMapping = tmpl.variable_mapping || {};
        const varKeys = Object.keys(variableMapping);

        const contentPayload: Record<string, unknown> = {
          friendly_name: sanitizeTemplateName(tmpl.name),
          language: tmpl.language || "en",
          types: {
            "twilio/text": {
              body: tmpl.body_template,
            },
          },
        };

        // Add variables definition if template has variables
        if (varKeys.length > 0) {
          contentPayload.variables = Object.fromEntries(
            varKeys.map((k) => [k, `{{${k}}}`])
          );
        }

        console.log(`[WhatsApp Templates] Creating Content resource for template ${template_id}`);

        const contentRes = await fetch("https://content.twilio.com/v1/Content", {
          method: "POST",
          headers: {
            Authorization: authHeaderTwilio,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(contentPayload),
        });

        const contentData = await contentRes.json();

        if (!contentRes.ok) {
          console.error("[WhatsApp Templates] Content API error:", JSON.stringify(contentData));
          throw new Error(`Twilio Content API error: ${contentData.message || JSON.stringify(contentData)}`);
        }

        const contentSid = contentData.sid;
        console.log(`[WhatsApp Templates] Content created: ${contentSid}`);

        // Step 2: Submit for WhatsApp approval
        const approvalRes = await fetch(
          `https://content.twilio.com/v1/Content/${contentSid}/ApprovalRequests/whatsapp`,
          {
            method: "POST",
            headers: {
              Authorization: authHeaderTwilio,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: sanitizeTemplateName(tmpl.name),
              category: (tmpl.category || "UTILITY").toLowerCase(),
            }),
          }
        );

        const approvalData = await approvalRes.json();

        if (!approvalRes.ok) {
          console.error("[WhatsApp Templates] Approval submission error:", JSON.stringify(approvalData));
          // Still save the content SID even if approval submission fails
          await supabase
            .from("whatsapp_templates")
            .update({ twilio_content_sid: contentSid, approval_status: "error" })
            .eq("id", template_id);

          throw new Error(`Approval submission error: ${approvalData.message || JSON.stringify(approvalData)}`);
        }

        console.log(`[WhatsApp Templates] Approval submitted for ${contentSid}`);

        // Step 3: Update DB with Content SID and pending status
        const { data: updated, error: updateError } = await supabase
          .from("whatsapp_templates")
          .update({
            twilio_content_sid: contentSid,
            approval_status: "pending",
          })
          .eq("id", template_id)
          .select()
          .single();

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ template: updated }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        const { template_id, name, body_template, category, language } = params;

        if (!template_id) {
          return new Response(
            JSON.stringify({ error: "Missing template_id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: tmplUpd, error: tmplUpdErr } = await supabase
          .from("whatsapp_templates")
          .select("*")
          .eq("id", template_id)
          .single();

        if (tmplUpdErr || !tmplUpd) {
          return new Response(
            JSON.stringify({ error: "Template not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (tmplUpd.tenant_id !== tenantId) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (tmplUpd.twilio_content_sid) {
          return new Response(
            JSON.stringify({ error: "Cannot edit a template that has already been submitted" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Re-derive variable mapping from the new body
        const updBody = body_template || tmplUpd.body_template;
        const updNamedVarRegex = /\{\{([a-z_.]+)\}\}/g;
        const updFoundVars: string[] = [];
        let updMatch;
        while ((updMatch = updNamedVarRegex.exec(updBody)) !== null) {
          const varName = updMatch[1];
          if (/^\d+$/.test(varName)) continue;
          if (!updFoundVars.includes(varName)) updFoundVars.push(varName);
        }

        let updConvertedBody = updBody;
        const updDerivedMapping: Record<string, string> = {};

        if (updFoundVars.length > 0) {
          updFoundVars.forEach((varName, index) => {
            const num = String(index + 1);
            updConvertedBody = updConvertedBody.replace(
              new RegExp(`\\{\\{${varName}\\}\\}`, 'g'),
              `{{${num}}}`
            );
            updDerivedMapping[num] = varName;
          });
        }

        const updateFields: Record<string, unknown> = {
          body_template: updConvertedBody,
          variable_mapping: updFoundVars.length > 0 ? updDerivedMapping : {},
        };
        if (name) updateFields.name = name;
        if (category) updateFields.category = category;
        if (language) updateFields.language = language;

        const { data: updatedTmpl, error: updErr } = await supabase
          .from("whatsapp_templates")
          .update(updateFields)
          .eq("id", template_id)
          .select()
          .single();

        if (updErr) throw updErr;

        return new Response(JSON.stringify({ template: updatedTmpl }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { template_id } = params;

        if (!template_id) {
          return new Response(
            JSON.stringify({ error: "Missing template_id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: tmpl, error: tmplErr } = await supabase
          .from("whatsapp_templates")
          .select("*")
          .eq("id", template_id)
          .single();

        if (tmplErr || !tmpl) {
          return new Response(
            JSON.stringify({ error: "Template not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (tmpl.tenant_id !== tenantId) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: template belongs to another tenant" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // If submitted to Twilio, delete the Content resource
        if (tmpl.twilio_content_sid) {
          try {
            const authHeaderTwilio = twilioBasicAuth();
            const delRes = await fetch(
              `https://content.twilio.com/v1/Content/${tmpl.twilio_content_sid}`,
              { method: "DELETE", headers: { Authorization: authHeaderTwilio } }
            );
            console.log(`[WhatsApp Templates] Twilio Content DELETE ${tmpl.twilio_content_sid}: ${delRes.status}`);
          } catch (twilioErr) {
            console.error("[WhatsApp Templates] Twilio delete error (continuing):", twilioErr);
          }
        }

        const { error: deleteErr } = await supabase
          .from("whatsapp_templates")
          .delete()
          .eq("id", template_id);

        if (deleteErr) throw deleteErr;

        return new Response(JSON.stringify({ success: true }), {
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

        // If it has a Twilio Content SID, poll Twilio for real approval status
        if (template.twilio_content_sid) {
          try {
            const authHeaderTwilio = twilioBasicAuth();
            const statusRes = await fetch(
              `https://content.twilio.com/v1/Content/${template.twilio_content_sid}/ApprovalRequests`,
              {
                headers: { Authorization: authHeaderTwilio },
              }
            );

            if (statusRes.ok) {
              const statusData = await statusRes.json();
              // Twilio returns approval_requests array; find the whatsapp one
              const whatsappApproval = statusData.approval_requests?.find(
                (r: Record<string, unknown>) => r.channel === "whatsapp"
              );

              if (whatsappApproval) {
                // Map Twilio status to our status
                let mappedStatus = "pending";
                const twilioStatus = (whatsappApproval.status || "").toLowerCase();

                if (twilioStatus === "approved") {
                  mappedStatus = "approved";
                } else if (twilioStatus === "rejected" || twilioStatus === "failed") {
                  mappedStatus = "rejected";
                } else if (twilioStatus === "pending" || twilioStatus === "received" || twilioStatus === "in-review") {
                  mappedStatus = "pending";
                }

                // Update DB if status changed
                if (mappedStatus !== template.approval_status) {
                  console.log(`[WhatsApp Templates] Status changed for ${template_id}: ${template.approval_status} → ${mappedStatus}`);
                  const { data: updated } = await supabase
                    .from("whatsapp_templates")
                    .update({ approval_status: mappedStatus })
                    .eq("id", template_id)
                    .select()
                    .single();

                  if (updated) {
                    return new Response(JSON.stringify({ template: updated }), {
                      status: 200,
                      headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                  }
                }
              }
            }
          } catch (pollError) {
            console.error("[WhatsApp Templates] Error polling status:", pollError);
            // Fall through to return current DB status
          }
        }

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
