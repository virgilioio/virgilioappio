// Gio Sign: the public signing page's session (app.gogio.io/s/<token>).
// No JWT. Actions:
//   open       { token }                 -> where the signer stands, what they're signing
//   send_code  { token, consent: true }  -> records consent, emails a 6-digit code
//   verify     { token, code }           -> checks the code, opens a 2-hour session
//   load       { token, session }        -> the documents (5-minute URLs) and fields
// Every auth-shaped failure is { error: "not_found" }. ASCII only.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient,
  codeHash,
  ipFrom,
  json,
  logEvent,
  maskEmail,
  randomCode,
  randomToken,
  rateLimitOk,
  resolveLink,
  sendCodeEmail,
  sessionOk,
  sha256Hex,
  signerState,
} from "../_shared/sign/signer.ts";
import { notifySenderViewed } from "../_shared/sign/notify.ts";

/** Runs after the response when the runtime allows it. */
function later(work: Promise<unknown>) {
  const guarded = work.catch((err) => console.error("sign-session later", String(err)));
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(guarded);
}

const NF = () => json(404, { error: "not_found" }, corsHeaders);
const CODE_MINUTES = 10;
const RESEND_SECONDS = 30;
const MAX_TRIES = 5;
const SESSION_HOURS = 2;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return NF();
  const supabase = adminClient();
  const ip = ipFrom(req);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NF();
  }
  if (!(await rateLimitOk(supabase, "sign_public_ip", ip, 120, 300))) {
    return json(429, { error: "rate_limited" }, corsHeaders);
  }

  const ctx = await resolveLink(supabase, body?.token);
  if (!ctx) return NF();
  const { envelope: e, recipient: r, secret: s } = ctx;
  const action = String(body?.action ?? "");

  try {
    const state = await signerState(supabase, ctx);

    if (action === "open") {
      if (state === "open" && !r.viewed_at) {
        // First open of the link (before the code): logged once.
        const { count } = await supabase
          .from("sign_events")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", r.id)
          .eq("kind", "opened");
        if (!count) await logEvent(supabase, ctx, "opened", `Opened by ${r.name}`, req, ip);
      }
      const { data: docs } = await supabase
        .from("sign_documents")
        .select("name, page_count")
        .eq("envelope_id", e.id)
        .is("removed_at", null)
        .order("position");
      const { data: decliner } = state === "declined"
        ? await supabase.from("sign_recipients").select("name").eq("envelope_id", e.id).eq("status", "declined").maybeSingle()
        : { data: null };
      return json(200, {
        state,
        brand: ctx.brand,
        title: e.title,
        public_id: e.public_id,
        sender_name: e.sender_name,
        sender_email: e.sender_email,
        documents: (docs ?? []).map((d: any) => ({ name: d.name, pages: d.page_count })),
        recipient: { name: r.name, first_name: String(r.name || "").split(/\s+/)[0], email_masked: maskEmail(r.email), role: r.role },
        consented: !!r.consent_at,
        code_sent_at: s.code_sent_at,
        expires_at: e.expires_at,
        declined_by: decliner?.name ?? null,
      }, corsHeaders);
    }

    if (action === "send_code") {
      if (state !== "open") return json(409, { error: state }, corsHeaders);
      if (body?.consent !== true && !r.consent_at) return json(400, { error: "consent_required" }, corsHeaders);
      if (s.code_sent_at && Date.now() - new Date(s.code_sent_at).getTime() < RESEND_SECONDS * 1000) {
        const wait = Math.ceil(RESEND_SECONDS - (Date.now() - new Date(s.code_sent_at).getTime()) / 1000);
        return json(429, { error: "wait", wait }, corsHeaders);
      }
      if (!(await rateLimitOk(supabase, "sign_code_recipient", r.id, 8, 3600))) {
        return json(429, { error: "rate_limited" }, corsHeaders);
      }
      if (!r.consent_at) {
        await supabase.from("sign_recipients").update({ consent_at: new Date().toISOString() }).eq("id", r.id);
        await logEvent(supabase, ctx, "consented", `${r.name} agreed to sign electronically`, req, ip);
      }
      const code = randomCode();
      const now = new Date();
      await supabase
        .from("sign_recipient_secrets")
        .update({
          code_hash: await codeHash(r.id, code),
          code_sent_at: now.toISOString(),
          code_expires_at: new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString(),
          code_attempts: 0,
          updated_at: now.toISOString(),
        })
        .eq("recipient_id", r.id);
      await sendCodeEmail({ to: r.email, name: r.name, code, brand: ctx.brand, title: e.title });
      await logEvent(supabase, ctx, "code_sent", `Code sent to ${maskEmail(r.email)}`, req, ip);
      return json(200, { ok: true, email_masked: maskEmail(r.email), wait: RESEND_SECONDS }, corsHeaders);
    }

    if (action === "verify") {
      if (state !== "open") return json(409, { error: state }, corsHeaders);
      const code = String(body?.code ?? "").replace(/\D/g, "");
      if (code.length !== 6) return json(400, { error: "bad_code" }, corsHeaders);
      if (!s.code_hash || !s.code_expires_at || new Date(s.code_expires_at).getTime() < Date.now()) {
        return json(400, { error: "code_expired" }, corsHeaders);
      }
      if ((s.code_attempts ?? 0) >= MAX_TRIES) return json(400, { error: "too_many_tries" }, corsHeaders);
      if ((await codeHash(r.id, code)) !== s.code_hash) {
        const tries = (s.code_attempts ?? 0) + 1;
        await supabase.from("sign_recipient_secrets").update({ code_attempts: tries }).eq("recipient_id", r.id);
        await logEvent(supabase, ctx, "code_failed", `Wrong code entered for ${r.name}`, req, ip);
        return json(400, { error: tries >= MAX_TRIES ? "too_many_tries" : "bad_code", left: MAX_TRIES - tries }, corsHeaders);
      }
      const session = randomToken();
      const now = new Date();
      await supabase
        .from("sign_recipient_secrets")
        .update({
          code_hash: null,
          code_expires_at: null,
          code_attempts: 0,
          session_hash: await sha256Hex(session),
          session_expires_at: new Date(now.getTime() + SESSION_HOURS * 3_600_000).toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("recipient_id", r.id);
      const patch: Record<string, unknown> = {};
      if (!r.verified_at) patch.verified_at = now.toISOString();
      if (!r.viewed_at) patch.viewed_at = now.toISOString();
      if (r.status === "sent") patch.status = "viewed";
      if (Object.keys(patch).length) await supabase.from("sign_recipients").update(patch).eq("id", r.id);
      if (!r.viewed_at) later(notifySenderViewed(supabase, e.id, r.id));
      await logEvent(supabase, ctx, "code_verified", `Code verified by ${r.name}`, req, ip);
      return json(200, { session, expires_at: new Date(now.getTime() + SESSION_HOURS * 3_600_000).toISOString() }, corsHeaders);
    }

    if (action === "load") {
      if (!(await sessionOk(ctx, body?.session))) return json(401, { error: "session" }, corsHeaders);
      if (state !== "open") return json(409, { error: state }, corsHeaders);
      const { data: docs } = await supabase
        .from("sign_documents")
        .select("id, name, storage_path, page_count, page_sizes, position")
        .eq("envelope_id", e.id)
        .is("removed_at", null)
        .order("position");
      const documents = [];
      for (const d of docs ?? []) {
        const { data: signed } = await supabase.storage.from("sign-files").createSignedUrl(d.storage_path, 300);
        documents.push({ id: d.id, name: d.name, pages: d.page_count, page_sizes: d.page_sizes, url: signed?.signedUrl ?? null });
      }
      const { data: people } = await supabase
        .from("sign_recipients")
        .select("id, name, label, role, status, position")
        .eq("envelope_id", e.id)
        .is("removed_at", null)
        .order("position");
      const { data: fields } = await supabase
        .from("sign_fields")
        .select("id, recipient_id, type, page, x, y, w, h, required, data_key, data_style, font_size, label, value")
        .eq("envelope_id", e.id)
        .is("removed_at", null);
      const names = new Map((people ?? []).map((p: any) => [p.id, p.name]));
      const today = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", month: "long", day: "numeric", year: "numeric" }).format(new Date());
      return json(200, {
        title: e.title,
        brand: ctx.brand,
        public_id: e.public_id,
        sender_name: e.sender_name,
        recipient: { id: r.id, name: r.name, email: r.email, role: r.role },
        today,
        documents,
        people: (people ?? []).filter((p: any) => p.role !== "cc").map((p: any) => ({
          id: p.id, name: p.name, label: p.label, status: p.status, me: p.id === r.id,
        })),
        fields: (fields ?? []).map((f: any) => {
          const mine = f.recipient_id === r.id;
          const base = { id: f.id, type: f.type, page: f.page, x: Number(f.x), y: Number(f.y), w: Number(f.w), h: Number(f.h) };
          if (f.type === "data") return { ...base, owner: "data", value: f.value, style: f.data_style ?? null, font_size: f.font_size == null ? null : Number(f.font_size) };
          if (mine) return { ...base, owner: "me", required: f.required, label: f.label };
          // Someone else's field: whose it is, and a value only once they've signed.
          return { ...base, owner: "other", owner_name: names.get(f.recipient_id) ?? "", value: f.type === "signature" || f.type === "initials" ? (f.value ? "signed" : null) : f.value };
        }),
      }, corsHeaders);
    }

    return NF();
  } catch (err) {
    console.error("sign-session", action, err instanceof Error ? err.message : err);
    return json(500, { error: "server" }, corsHeaders);
  }
});
