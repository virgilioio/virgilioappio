// Gio Sign: the PDF a document written in Gio will become (2026-10-17), for
// the template editor and the send sheet. Signed-in users only (JWT). It only
// draws what it is given, with the same code sign-dispatch uses when the
// envelope goes out, so the preview is the document.
//   { name, content, values?, tags?, roles?, highlight?, empty? } -> application/pdf
// values: the record's values (from sign_send_preview); tags: { key: label }
// to print [Label] in a template preview with no record; highlight: { key:
// label } for the send sheet's preview (values underlined in lilac, empty
// ones as [Label]; empty: "red" prints those in red, for the template
// editor). Formatted values come as values["key|format"]. Images are read
// from sign-files with the service role, but only under the templates of a
// workspace the caller is an active member of (2026-10-18). ASCII only.

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

  // Images: the send sheet's sender may not be a template admin, so read with
  // the service role, limited to the caller's own workspaces' template files.
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let mine: Set<string> | null = null;
  const loadImage = async (path: string) => {
    const [tenant, folder] = path.split("/");
    if (folder !== "templates" || path.includes("..") || !/^[0-9a-f-]{36}$/.test(tenant)) return null;
    if (!mine) {
      const { data } = await admin.from("members").select("tenant_id").eq("user_id", who.user.id).eq("user_status", "active");
      mine = new Set((data ?? []).map((m: { tenant_id: string }) => m.tenant_id));
    }
    if (!mine.has(tenant)) return null;
    const { data, error } = await admin.storage.from("sign-files").download(path);
    return error || !data ? null : new Uint8Array(await data.arrayBuffer());
  };

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
      emptyRed: body.empty === "red",
      loadImage,
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
