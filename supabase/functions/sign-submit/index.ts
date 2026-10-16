// Gio Sign: the signer finishes or declines (app.gogio.io/s/<token>). No JWT.
//   submit  { token, session, values, signature }  -> signed (or approved)
//   decline { token, session, reason }             -> the envelope stops
// signature: { kind: "type"|"draw"|"upload", full_name, initials, font,
//              image: data:image/png;base64,..., initials_image?: same }
// The images are stored in sign-files/{tenant}/envelopes/{envelope}/signatures/.
// The next signer's invitation and the sender's email go out right after. ASCII only.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, ipFrom, json, rateLimitOk, resolveLink, sessionOk } from "../_shared/sign/signer.ts";
import { inviteRecipient, notifySenderDeclined, notifySenderSigned } from "../_shared/sign/notify.ts";

/** Emails go out after the response, so the signer isn't kept waiting; the minute job retries invitations. */
function later(work: Promise<unknown>) {
  const p = work.catch((err) => console.error("sign-submit followup", err instanceof Error ? err.message : err));
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
}

const NF = () => json(404, { error: "not_found" }, corsHeaders);
const MAX_IMAGE_BYTES = 400 * 1024;
const FONTS = new Set(["Caveat", "Dancing Script", "Homemade Apple", "Mr Dafoe"]);

function decodePng(dataUrl: unknown): Uint8Array | null {
  if (typeof dataUrl !== "string") return null;
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const bin = atob(m[1]);
  if (bin.length > MAX_IMAGE_BYTES) return null;
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  // PNG signature
  if (out.length < 8 || out[0] !== 0x89 || out[1] !== 0x50 || out[2] !== 0x4e || out[3] !== 0x47) return null;
  return out;
}

const codeOf = (err: any) => String(err?.code ?? "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return NF();
  const supabase = adminClient();
  const ip = ipFrom(req);
  const ua = (req.headers.get("user-agent") || "").slice(0, 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NF();
  }
  if (!(await rateLimitOk(supabase, "sign_submit_ip", ip, 20, 3600))) {
    return json(429, { error: "rate_limited" }, corsHeaders);
  }
  const ctx = await resolveLink(supabase, body?.token);
  if (!ctx) return NF();
  if (!(await sessionOk(ctx, body?.session))) return json(401, { error: "session" }, corsHeaders);
  const { envelope: e, recipient: r } = ctx;
  const ipValue = /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null;
  const action = String(body?.action ?? "");

  try {
    if (action === "decline") {
      const { error } = await supabase.rpc("sign_signer_decline", {
        _recipient_id: r.id,
        _reason: String(body?.reason ?? ""),
        _ip: ipValue,
        _ua: ua,
      });
      if (error) {
        if (codeOf(error) === "GSN25") return json(400, { error: "reason_required" }, corsHeaders);
        if (codeOf(error) === "GSN22") return json(409, { error: "not_your_turn" }, corsHeaders);
        throw error;
      }
      later(notifySenderDeclined(supabase, e.id, r.id));
      return json(200, { ok: true }, corsHeaders);
    }

    if (action === "submit") {
      const sig = body?.signature ?? null;
      let signature: Record<string, unknown> | null = null;
      if (sig) {
        const kind = String(sig.kind ?? "");
        const fullName = String(sig.full_name ?? "").trim().slice(0, 120);
        const initials = String(sig.initials ?? "").trim().slice(0, 4);
        if (!["type", "draw", "upload"].includes(kind) || !fullName) return json(400, { error: "bad_signature" }, corsHeaders);
        if (kind === "type" && !FONTS.has(String(sig.font ?? ""))) return json(400, { error: "bad_signature" }, corsHeaders);
        const image = decodePng(sig.image);
        if (!image) return json(400, { error: "bad_signature" }, corsHeaders);
        const iniImage = sig.initials_image ? decodePng(sig.initials_image) : null;
        const stamp = Date.now();
        const base = `${e.tenant_id}/envelopes/${e.id}/signatures/${r.id}-${stamp}`;
        const up1 = await supabase.storage.from("sign-files").upload(`${base}-sig.png`, image, { contentType: "image/png", upsert: false });
        if (up1.error) throw up1.error;
        let iniPath: string | null = null;
        if (iniImage) {
          const up2 = await supabase.storage.from("sign-files").upload(`${base}-ini.png`, iniImage, { contentType: "image/png", upsert: false });
          if (up2.error) throw up2.error;
          iniPath = `${base}-ini.png`;
        }
        signature = {
          kind,
          full_name: fullName,
          initials: initials || fullName.slice(0, 1).toUpperCase(),
          font: kind === "type" ? sig.font : null,
          image_path: `${base}-sig.png`,
          initials_image_path: iniPath,
        };
      }
      const values = body?.values && typeof body.values === "object" ? body.values : {};
      const { data, error } = await supabase.rpc("sign_signer_submit", {
        _recipient_id: r.id,
        _values: values,
        _signature: signature,
        _ip: ipValue,
        _ua: ua,
      });
      if (error) {
        const c = codeOf(error);
        if (c === "GSN23") return json(400, { error: "signature_required" }, corsHeaders);
        if (c === "GSN24") {
          const ids = String(error.message ?? "").split(":")[1]?.split(",").filter(Boolean) ?? [];
          return json(400, { error: "required_missing", fields: ids }, corsHeaders);
        }
        if (c === "GSN22") return json(409, { error: "not_your_turn" }, corsHeaders);
        if (c === "GSN21") return json(401, { error: "session" }, corsHeaders);
        throw error;
      }
      // Who's next, for the done screen (names only), and their invitations.
      let nextNames: string[] = [];
      const next: string[] = (data as any)?.next ?? [];
      if (Array.isArray(next) && next.length) {
        const { data: ppl } = await supabase.from("sign_recipients").select("name").in("id", next);
        nextNames = (ppl ?? []).map((p: any) => p.name);
      }
      later(
        (async () => {
          for (const id of next) {
            try {
              await inviteRecipient(supabase, id);
            } catch (err) {
              console.error("sign invite next", id, err instanceof Error ? err.message : err);
            }
          }
          await notifySenderSigned(supabase, e.id, r.id);
        })(),
      );
      return json(200, { status: (data as any)?.status ?? "sent", next: nextNames, signed_at: new Date().toISOString() }, corsHeaders);
    }

    return NF();
  } catch (err) {
    console.error("sign-submit", action, err instanceof Error ? err.message : JSON.stringify(err));
    return json(500, { error: "server" }, corsHeaders);
  }
});
