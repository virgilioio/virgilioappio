// Gio Sign: the PDF a document written in Gio will become (2026-10-17), for
// the template editor and the send sheet. Signed-in users only (JWT). It only
// draws what it is given, with the same code sign-dispatch uses when the
// envelope goes out, so the preview is the document.
//   { name, content, values?, tags?, roles?, highlight? } -> application/pdf
// values: the record's values (from sign_send_preview); tags: { key: label }
// to print [Label] in a template preview with no record; highlight: { key:
// label } for the send sheet's preview (values underlined in lilac, empty
// ones as [Label]). ASCII only.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { renderWritten } from "../_shared/sign/written.ts";

const MAX_BODY = 600_000;

function json(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function strings(x: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (x && typeof x === "object" && !Array.isArray(x)) {
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (v != null && typeof v !== "object") out[k] = String(v).slice(0, 4000);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method" }, corsHeaders);
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json(401, { error: "unauthorized" }, corsHeaders);
  const asUser = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return json(401, { error: "unauthorized" }, corsHeaders);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json(413, { error: "too_large" }, corsHeaders);
  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "bad_request" }, corsHeaders);
  }
  if (!body?.content || typeof body.content !== "object" || !body.content.root) {
    return json(400, { error: "bad_request" }, corsHeaders);
  }

  try {
    const tags = body.tags ? strings(body.tags) : null;
    const highlight = body.highlight ? strings(body.highlight) : null;
    const pdf = await renderWritten({
      name: String(body.name ?? "Document").slice(0, 200),
      content: body.content,
      values: strings(body.values),
      roles: strings(body.roles),
      tags,
      highlight,
    });
    return new Response(new Uint8Array(pdf.bytes), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "X-Page-Count": String(pdf.pageCount),
        "Access-Control-Expose-Headers": "X-Page-Count",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sign-written-preview", msg);
    return json(422, { error: "render", message: msg.startsWith("The document is longer") ? msg : "The document couldn't be drawn." }, corsHeaders);
  }
});
