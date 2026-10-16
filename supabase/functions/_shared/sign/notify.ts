// Gio Sign: who gets which email, and when. Used by sign-dispatch (every
// minute) and sign-submit (right after someone signs or declines). ASCII only.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { appBase } from "../referenceTokens.ts";
import { randomToken, sha256Hex } from "./signer.ts";
import {
  fillTags,
  inviteEmail,
  sendMail,
  senderCompletedEmail,
  senderDeclinedEmail,
  senderSignedEmail,
  senderExpiryEmail,
  reminderEmail,
  voidedEmail,
  type PersonRow,
} from "./emails.ts";

export async function brandOf(supabase: SupabaseClient, tenantId: string) {
  const { data } = await supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle();
  return (data?.name as string) || "Gio Sign";
}

/** Where the sender looks at this envelope in the ATS. */
export function recordUrl(e: Record<string, any>): string | null {
  const base = appBase();
  if (e.kind === "candidate" && e.ats_job_id && e.ats_candidate_id) return `${base}/jobs/${e.ats_job_id}/candidates/${e.ats_candidate_id}`;
  if (e.kind === "member" && e.source_id) return `${base}/os/people/${e.source_id}`;
  if (e.origin === "sales" && e.source_type === "deal" && e.source_id) {
    const sales = (Deno.env.get("GIO_SALES_APP_URL") ?? "https://sales.gogio.io").replace(/\/$/, "");
    return `${sales}/deals/${e.source_id}`;
  }
  return null;
}

async function event(supabase: SupabaseClient, e: Record<string, any>, recipientId: string | null, kind: string, label: string, key = false, detail: Record<string, unknown> = {}) {
  await supabase.from("sign_events").insert({
    tenant_id: e.tenant_id,
    envelope_id: e.id,
    recipient_id: recipientId,
    kind,
    label,
    key,
    actor_name: "Gio Sign",
    detail,
  });
}

/**
 * Send one person their invitation, exactly once: claim it (stores the new
 * link's hash), email it, and release the claim if the email fails so the
 * next run retries. Returns true when this call sent it.
 */
export async function inviteRecipient(supabase: SupabaseClient, recipientId: string): Promise<boolean> {
  const { data: r } = await supabase.from("sign_recipients").select("*").eq("id", recipientId).maybeSingle();
  if (!r || r.role === "cc" || r.status !== "sent" || r.removed_at) return false;
  const { data: e } = await supabase.from("sign_envelopes").select("*").eq("id", r.envelope_id).maybeSingle();
  if (!e || e.status !== "sent" || e.deleted_at) return false;

  const token = randomToken();
  const expiresAt = e.expires_at ?? new Date(Date.now() + 30 * 86_400_000).toISOString();
  const { data: claimed, error } = await supabase.rpc("sign_claim_invite", {
    _recipient_id: r.id,
    _token_hash: await sha256Hex(token),
    _expires_at: expiresAt,
  });
  if (error) throw error;
  if (!claimed) return false;

  try {
    const { data: docs } = await supabase
      .from("sign_documents")
      .select("name, page_count")
      .eq("envelope_id", e.id)
      .is("removed_at", null)
      .order("position");
    const pages = (docs ?? []).reduce((a: number, d: any) => a + (d.page_count ?? 0), 0);
    const docName = String(docs?.[0]?.name ?? e.title).replace(/\.pdf$/i, "") + ((docs?.length ?? 0) > 1 ? ` + ${docs!.length - 1} more` : "");
    const values = (e.data_snapshot ?? {}) as Record<string, unknown>;
    await sendMail(
      inviteEmail({
        brand: await brandOf(supabase, e.tenant_id),
        senderName: e.sender_name,
        senderEmail: e.sender_email,
        recipientName: r.name,
        recipientEmail: r.email,
        role: r.role,
        subject: fillTags(e.subject, values),
        body: fillTags(e.body, values),
        docName,
        pages,
        expiresAt,
        link: `${appBase()}/s/${token}`,
      }),
    );
  } catch (err) {
    await supabase.rpc("sign_release_invite", { _recipient_id: r.id });
    throw err;
  }
  await event(supabase, e, r.id, "sent", `Invitation emailed to ${r.name}`);
  return true;
}

/** Everyone the minute job owes an invitation (new envelopes, next turns, retries). */
export async function invitePending(supabase: SupabaseClient, limit = 100) {
  const { data, error } = await supabase.rpc("sign_pending_invites", { _limit: limit });
  if (error) throw error;
  let sent = 0;
  let failed = 0;
  for (const row of (data ?? []) as { recipient_id: string }[]) {
    try {
      if (await inviteRecipient(supabase, row.recipient_id)) sent++;
    } catch (err) {
      failed++;
      console.error("sign invite", row.recipient_id, err instanceof Error ? err.message : err);
    }
  }
  return { sent, failed };
}

type SignEvent = "signed" | "declined" | "completed" | "viewed" | "expiring";

/** The sender's Sign preferences for one event (defaults when unset). */
async function prefs(supabase: SupabaseClient, tenantId: string, email: string, ev: SignEvent) {
  const { data } = await supabase.rpc("sign_pref", { _tenant_id: tenantId, _email: String(email || "").toLowerCase(), _event: ev });
  const row = Array.isArray(data) ? data[0] : data;
  return { email: row?.by_email !== false, inApp: row?.in_app !== false };
}

/** The record's page inside the app (relative, for the bell). */
export function recordPath(e: Record<string, any>): string {
  if (e.kind === "candidate" && e.ats_job_id && e.ats_candidate_id) return `/jobs/${e.ats_job_id}/candidates/${e.ats_candidate_id}`;
  if (e.kind === "member" && e.source_id) return `/os/people/${e.source_id}`;
  return `/sign?envelope=${e.id}`;
}

/** A row in the sender's bell (ATS senders only; Gio Sales senders are told in Sales). */
export async function bell(
  supabase: SupabaseClient,
  e: Record<string, any>,
  n: { title: string; subtitle?: string | null; preview?: string | null; actor?: string | null; event: string },
) {
  if (!e.sender_user_id) return;
  const { error } = await supabase.rpc("emit_notification", {
    _user_id: e.sender_user_id,
    _tenant_id: e.tenant_id,
    _category: "sign",
    _actor_user_id: null,
    _actor_name: n.actor ?? null,
    _actor_avatar_url: null,
    _title: n.title,
    _subtitle: n.subtitle ?? e.title,
    _preview: n.preview ?? null,
    _entity_kind: "sign_envelope",
    _entity_id: e.id,
    _job_id: e.ats_job_id ?? null,
    _candidate_id: e.ats_candidate_id ?? null,
    _action_url: recordPath(e),
    _metadata: { event: n.event, envelope_id: e.id, public_id: e.public_id },
  });
  if (error) console.error("sign bell", e.id, error.message);
}

export async function people(supabase: SupabaseClient, envelopeId: string): Promise<PersonRow[]> {
  const { data } = await supabase
    .from("sign_recipients")
    .select("name, role, status, signed_at, approved_at, position, email")
    .eq("envelope_id", envelopeId)
    .is("removed_at", null)
    .order("position");
  return (data ?? []) as PersonRow[];
}

/** Tell the sender someone signed (and, when it's the last one, that it's complete). */
export async function notifySenderSigned(supabase: SupabaseClient, envelopeId: string, recipientId: string) {
  const { data: e } = await supabase.from("sign_envelopes").select("*").eq("id", envelopeId).maybeSingle();
  const { data: r } = await supabase.from("sign_recipients").select("*").eq("id", recipientId).maybeSingle();
  if (!e || !r) return;
  const brand = await brandOf(supabase, e.tenant_id);
  const list = await people(supabase, e.id);
  const sender = String(e.sender_email || "").toLowerCase();
  const signerIsSender = String(r.email).toLowerCase() === sender;

  if (e.status === "completed") {
    const p = await prefs(supabase, e.tenant_id, sender, "completed");
    if (p.inApp) await bell(supabase, e, { title: "Everyone has signed", event: "completed" });
    if (p.email) {
      await sendMail(senderCompletedEmail({ brand, senderEmail: e.sender_email, title: e.title, people: list, publicId: e.public_id, recordUrl: recordUrl(e) }));
    }
    return;
  }
  if (signerIsSender) return;
  const p = await prefs(supabase, e.tenant_id, sender, "signed");
  const did = r.status === "approved" ? "approved" : "signed";
  const yourTurn = list.some((x) => x.email.toLowerCase() === sender && x.status === "sent");
  if (p.inApp) {
    await bell(supabase, e, {
      title: yourTurn ? `${r.name} ${did}. Your turn to sign` : `${r.name} ${did}`,
      actor: r.name,
      event: "signed",
    });
  }
  if (!p.email) return;
  await sendMail(
    senderSignedEmail({
      brand,
      senderName: e.sender_name,
      senderEmail: e.sender_email,
      title: e.title,
      signerName: r.name,
      approved: r.status === "approved",
      people: list,
      yourTurn,
      recordUrl: recordUrl(e),
    }),
  );
}

export async function notifySenderDeclined(supabase: SupabaseClient, envelopeId: string, recipientId: string) {
  const { data: e } = await supabase.from("sign_envelopes").select("*").eq("id", envelopeId).maybeSingle();
  const { data: r } = await supabase.from("sign_recipients").select("*").eq("id", recipientId).maybeSingle();
  if (!e || !r) return;
  if (String(r.email).toLowerCase() === String(e.sender_email).toLowerCase()) return;
  const p = await prefs(supabase, e.tenant_id, e.sender_email, "declined");
  if (p.inApp) await bell(supabase, e, { title: `${r.name} declined to sign`, preview: r.decline_reason ?? null, actor: r.name, event: "declined" });
  if (!p.email) return;
  await sendMail(
    senderDeclinedEmail({
      brand: await brandOf(supabase, e.tenant_id),
      senderEmail: e.sender_email,
      title: e.title,
      signerName: r.name,
      reason: r.decline_reason ?? "",
      recordUrl: recordUrl(e),
    }),
  );
}

/** Log the envelope-level "sent" step once it's claimed. */
export async function logSent(supabase: SupabaseClient, envelopeId: string) {
  const { data: e } = await supabase.from("sign_envelopes").select("*").eq("id", envelopeId).maybeSingle();
  if (!e) return;
  const { count } = await supabase
    .from("sign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("envelope_id", e.id)
    .neq("role", "cc")
    .is("removed_at", null);
  await event(supabase, e, null, "sent", `Sent to ${count ?? 0} ${count === 1 ? "person" : "people"}`, true);
}

async function docNameOf(supabase: SupabaseClient, e: Record<string, any>) {
  const { data: docs } = await supabase
    .from("sign_documents")
    .select("name")
    .eq("envelope_id", e.id)
    .is("removed_at", null)
    .order("position");
  return String(docs?.[0]?.name ?? e.title).replace(/\.pdf$/i, "") + ((docs?.length ?? 0) > 1 ? ` + ${docs!.length - 1} more` : "");
}

/** A reminder: a fresh link (the previous one keeps working) by email. */
export async function remindRecipient(supabase: SupabaseClient, recipientId: string): Promise<boolean> {
  const { data: r } = await supabase.from("sign_recipients").select("*").eq("id", recipientId).maybeSingle();
  if (!r || r.role === "cc" || !["sent", "viewed"].includes(r.status) || r.removed_at) return false;
  const { data: e } = await supabase.from("sign_envelopes").select("*").eq("id", r.envelope_id).maybeSingle();
  if (!e || e.status !== "sent") return false;
  const token = randomToken();
  const { data: rotated, error } = await supabase.rpc("sign_rotate_link", { _recipient_id: r.id, _token_hash: await sha256Hex(token) });
  if (error) throw error;
  if (!rotated) return false;
  await sendMail(
    reminderEmail({
      brand: await brandOf(supabase, e.tenant_id),
      senderName: e.sender_name,
      senderEmail: e.sender_email,
      recipientName: r.name,
      recipientEmail: r.email,
      role: r.role,
      docName: await docNameOf(supabase, e),
      expiresAt: e.expires_at ?? new Date(Date.now() + 7 * 86_400_000).toISOString(),
      link: `${appBase()}/s/${token}`,
    }),
  );
  await event(supabase, e, r.id, "reminded", `Reminder emailed to ${r.name}`);
  return true;
}

/** After a void: tell everyone who had a link. */
export async function notifyVoided(supabase: SupabaseClient, envelopeId: string, recipientIds: string[]) {
  const { data: e } = await supabase.from("sign_envelopes").select("*").eq("id", envelopeId).maybeSingle();
  if (!e || !recipientIds.length) return;
  const brand = await brandOf(supabase, e.tenant_id);
  const docName = await docNameOf(supabase, e);
  const { data: rs } = await supabase.from("sign_recipients").select("*").in("id", recipientIds);
  for (const r of rs ?? []) {
    if (String(r.email).toLowerCase() === String(e.sender_email).toLowerCase()) continue;
    try {
      await sendMail(voidedEmail({ brand, senderName: e.sender_name, senderEmail: e.sender_email, recipientName: r.name, recipientEmail: r.email, docName, reason: e.void_reason ?? "" }));
    } catch (err) {
      console.error("sign void email", r.id, err instanceof Error ? err.message : err);
    }
  }
}

/** Expiring soon (once) or expired: tell the sender. */
export async function notifySenderExpiry(supabase: SupabaseClient, envelopeId: string, expired: boolean) {
  const { data: e } = await supabase.from("sign_envelopes").select("*").eq("id", envelopeId).maybeSingle();
  if (!e) return;
  // Expired always goes out; the 3-day warning follows the "expiring" preference.
  const p = expired ? { email: true, inApp: true } : await prefs(supabase, e.tenant_id, e.sender_email, "expiring");
  if (p.inApp) {
    await bell(supabase, e, {
      title: expired ? "Expired before everyone signed" : `Expires ${new Date(e.expires_at).toLocaleDateString("en-US", { timeZone: "America/Mexico_City", month: "short", day: "numeric" })}`,
      event: expired ? "expired" : "expiring",
    });
  }
  if (!p.email) return;
  await sendMail(
    senderExpiryEmail({
      brand: await brandOf(supabase, e.tenant_id),
      senderEmail: e.sender_email,
      title: e.title,
      expiresAt: e.expires_at,
      expired,
      people: await people(supabase, e.id),
      recordUrl: recordUrl(e),
    }),
  );
}

/** The first time a signer opens it (after their code): a bell row, if wanted. */
export async function notifySenderViewed(supabase: SupabaseClient, envelopeId: string, recipientId: string) {
  const { data: e } = await supabase.from("sign_envelopes").select("*").eq("id", envelopeId).maybeSingle();
  const { data: r } = await supabase.from("sign_recipients").select("*").eq("id", recipientId).maybeSingle();
  if (!e || !r) return;
  if (String(r.email).toLowerCase() === String(e.sender_email).toLowerCase()) return;
  const p = await prefs(supabase, e.tenant_id, e.sender_email, "viewed");
  if (p.inApp) await bell(supabase, e, { title: `${r.name} opened it`, actor: r.name, event: "viewed" });
}
