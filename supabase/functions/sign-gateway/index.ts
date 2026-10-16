// Gio Sign gateway for Gio Sales (build step 12).
//
// Reps send agreements from deals in Gio Sales and have no Gio ATS account.
// Gio Sales' server (sign-link) checks the rep and the deal, then calls this
// function. Only Customer envelopes that came from Gio Sales are reachable.
//
// Auth: x-gio-timestamp (unix seconds) and x-gio-signature, the hex
// HMAC-SHA256 of `${timestamp}.${rawBody}` with GIO_LINK_SECRET, as for
// google-gateway. Requests older than 5 minutes are refused.
//
// Body: { action, org_id, user: { id, name, email }, ... }
//   templates                         -> { templates: [...] } Gio Sales templates
//   send     { template_id, deal_id, company_id, label, values, people,
//              send_at?, subject?, body? } -> { envelope_id, dispatch_at }
//   manage   { envelope_id, op: undo|remind|void|send_now, reason? } -> { ok, emailed }
//   files    { envelope_id }          -> { sealed_url, certificate_url } (10 minutes)
//   status   { envelope_id }          -> the same snapshot the events carry
// ASCII only.

import { adminClient } from "../_shared/sign/signer.ts";
import { notifyVoided, remindRecipient } from "../_shared/sign/notify.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);

/** Database errors the rep can act on, in plain words; anything else is generic. */
function refusal(err: { code?: string; message?: string }) {
  const code = String(err?.code ?? "");
  const known: Record<string, number> = { GSN07: 409, GSN08: 400, GSN10: 409, GSN13: 400, GSN14: 400, GSN25: 400, GSN26: 429 };
  if (code in known) return json({ error: String(err.message ?? ""), code }, known[code]);
  console.error("sign-gateway db", code, err?.message);
  return json({ error: "Gio Sign couldn't do that. Try again in a moment.", code: "server" }, 500);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("GIO_LINK_SECRET");
  const tenant = Deno.env.get("GIO_ATS_TENANT_ID");
  if (!secret || !tenant) return json({ error: "Not configured", code: "not_configured" }, 503);

  const raw = await req.text();
  const ts = Number(req.headers.get("x-gio-timestamp") || "0");
  const sig = (req.headers.get("x-gio-signature") || "").trim().toLowerCase();
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300 || !sig || !safeEqual(sig, await hmac(secret, `${ts}.${raw}`))) {
    return json({ error: "Invalid signature", code: "signature" }, 401);
  }
  let p: any;
  try {
    p = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const orgId = uuid(p?.org_id);
  const user = p?.user ?? {};
  const userId = uuid(user.id);
  const userName = String(user.name ?? "").trim().slice(0, 120);
  const userEmail = String(user.email ?? "").trim().toLowerCase();
  if (!orgId || !userId || !userEmail) return json({ error: "org_id and user are required" }, 400);

  const db = adminClient();
  const action = String(p.action ?? "");

  try {
    if (action === "templates") {
      const { data: tpls, error } = await db
        .from("sign_templates")
        .select("id, name, description, ordered, subject, body, reminder_days, expiry_days, updated_at")
        .eq("tenant_id", tenant).eq("app", "sales").eq("kind", "customer").is("archived_at", null)
        .order("name");
      if (error) throw error;
      const ids = (tpls ?? []).map((t: any) => t.id);
      const pick = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];
      const [{ data: roles }, { data: fields }, { data: docs }] = await Promise.all([
        db.from("sign_recipients").select("id, template_id, position, role, label, name, email, fixed, color").in("template_id", pick).is("envelope_id", null).is("removed_at", null).order("position"),
        db.from("sign_fields").select("template_id, type, data_key").in("template_id", pick).is("envelope_id", null).is("removed_at", null),
        db.from("sign_documents").select("template_id, name, page_count").in("template_id", pick).is("envelope_id", null).is("removed_at", null).order("position"),
      ]);
      const templates = (tpls ?? []).map((t: any) => ({
        ...t,
        roles: (roles ?? []).filter((r: any) => r.template_id === t.id).map(({ template_id: _t, ...r }: any) => r),
        data_keys: [...new Set((fields ?? []).filter((f: any) => f.template_id === t.id && f.type === "data").map((f: any) => f.data_key))],
        documents: (docs ?? []).filter((d: any) => d.template_id === t.id).map((d: any) => ({ name: d.name, pages: d.page_count })),
      }));
      return json({ templates });
    }

    if (action === "send") {
      const { data, error } = await db.rpc("sign_send_sales", {
        _template_id: uuid(p.template_id),
        _sales_org_id: orgId,
        _deal_id: uuid(p.deal_id),
        _company_id: uuid(p.company_id),
        _label: String(p.label ?? "").slice(0, 200),
        _sender_sales_user_id: userId,
        _sender_name: userName,
        _sender_email: userEmail,
        _values: p.values && typeof p.values === "object" ? p.values : {},
        _people: Array.isArray(p.people) ? p.people : [],
        _send_at: typeof p.send_at === "string" ? p.send_at : null,
        _subject: typeof p.subject === "string" ? p.subject : null,
        _body: typeof p.body === "string" ? p.body : null,
      });
      if (error) return refusal(error);
      const { data: e } = await db.from("sign_envelopes").select("id, public_id, title, status, dispatch_at, scheduled_at").eq("id", data).maybeSingle();
      return json({ envelope_id: data, public_id: e?.public_id, title: e?.title, status: e?.status, dispatch_at: e?.dispatch_at, scheduled_at: e?.scheduled_at });
    }

    const envelopeId = uuid(p.envelope_id);
    if (!envelopeId) return json({ error: "envelope_id is required" }, 400);
    const { data: env } = await db.from("sign_envelopes").select("id, origin, sales_org_id, sealed_path, certificate_path, public_id, title")
      .eq("id", envelopeId).maybeSingle();
    if (!env || env.origin !== "sales" || env.sales_org_id !== orgId) return json({ error: "Not found", code: "not_found" }, 404);

    if (action === "manage") {
      const op = String(p.op ?? "");
      const { data, error } = await db.rpc("sign_sales_manage", {
        _envelope_id: envelopeId, _sales_org_id: orgId, _action: op,
        _reason: typeof p.reason === "string" ? p.reason : null, _actor_name: userName, _actor_email: userEmail,
      });
      if (error) return refusal(error);
      const ids: string[] = Array.isArray(data?.recipients) ? data.recipients : [];
      let emailed = 0;
      if (op === "remind") {
        for (const id of ids) {
          try {
            if (await remindRecipient(db, id)) emailed++;
          } catch (err) {
            console.error("sign-gateway remind", id, err instanceof Error ? err.message : err);
          }
        }
      } else if (op === "void" && ids.length) {
        await notifyVoided(db, envelopeId, ids);
        emailed = ids.length;
      }
      return json({ ok: data?.ok !== false, emailed });
    }

    if (action === "files") {
      if (!env.sealed_path) return json({ error: "Not sealed yet", code: "not_sealed" }, 409);
      const sealed = await db.storage.from("sign-files").createSignedUrl(env.sealed_path, 600);
      const cert = env.certificate_path ? await db.storage.from("sign-files").createSignedUrl(env.certificate_path, 600) : null;
      if (sealed.error) throw sealed.error;
      return json({ sealed_url: sealed.data.signedUrl, certificate_url: cert?.data?.signedUrl ?? null, public_id: env.public_id, title: env.title });
    }

    if (action === "status") {
      const { data, error } = await db.rpc("sign_sales_snapshot", { _envelope_id: envelopeId });
      if (error) throw error;
      return json(data);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("sign-gateway", action, err instanceof Error ? err.message : JSON.stringify(err));
    return json({ error: "Gio Sign couldn't do that. Try again in a moment.", code: "server" }, 500);
  }
});
