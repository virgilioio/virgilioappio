// Retired (2026-11-07). This was a placeholder that never converted a document
// (it would have stored a blank one-page PDF in place of a résumé preview).
// Word résumés are shown as they are, and nothing calls this any more
// (trigger_document_conversion no longer does). It answers and touches nothing.
import { createSecureCorsHeaders, handleSecureCorsPreFlight, withRequestCors } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

Deno.serve(withRequestCors(async (req) => {
  const preflight = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflight) return preflight;
  return new Response(JSON.stringify({ error: "not_used", message: "Documents are no longer converted to PDF." }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}));
