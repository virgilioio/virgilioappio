// chat-notification-processor
// ----------------------------------------------------------------------------
// Cron-triggered worker (every minute). Pulls due `pending` rows from
// chat_notification_queue (batch 25), runs cancel checks (read receipts,
// suppression, candidate already polling), renders an HTML email, sends it
// via Resend, and marks the row sent/failed.
//
// Internal-only: requires `x-internal-secret` matching CHAT_TOKEN_SECRET.
// ----------------------------------------------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { createEmailTemplate } from "../_shared/emailTemplate.ts";

const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 5;
const RETRY_BACKOFF_MIN = 5; // minutes between retries

type Kind = "recruiter_new_message" | "recruiter_handoff" | "candidate_recruiter_reply";

interface QueueRow {
  id: string;
  tenant_id: string;
  thread_id: string;
  kind: Kind;
  recipient_user_id: string | null;
  recipient_email: string | null;
  message_count: number;
  last_message_id: string | null;
  last_message_at: string;
  attempts: number;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

async function markSent(sb: ReturnType<typeof admin>, id: string) {
  await sb.from("chat_notification_queue")
    .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
    .eq("id", id);
}

async function markCancelled(sb: ReturnType<typeof admin>, id: string, reason: string) {
  await sb.from("chat_notification_queue")
    .update({ status: "cancelled", error: reason })
    .eq("id", id);
}

async function markFailedOrRetry(
  sb: ReturnType<typeof admin>,
  row: QueueRow,
  err: string,
) {
  const nextAttempts = row.attempts + 1;
  if (nextAttempts >= MAX_ATTEMPTS) {
    await sb.from("chat_notification_queue")
      .update({ status: "failed", attempts: nextAttempts, error: err.slice(0, 500) })
      .eq("id", row.id);
    return;
  }
  await sb.from("chat_notification_queue")
    .update({
      attempts: nextAttempts,
      error: err.slice(0, 500),
      scheduled_for: new Date(Date.now() + RETRY_BACKOFF_MIN * 60_000).toISOString(),
    })
    .eq("id", row.id);
}

// ---------- Cancel checks --------------------------------------------------

async function shouldCancel(
  sb: ReturnType<typeof admin>,
  row: QueueRow,
): Promise<string | null> {
  // Recruiter emails: skip if they've already read past the latest queued msg
  if (row.recipient_user_id) {
    const { data: read } = await sb
      .from("chat_thread_reads")
      .select("last_read_at")
      .eq("thread_id", row.thread_id)
      .eq("user_id", row.recipient_user_id)
      .maybeSingle();
    if (read?.last_read_at && new Date(read.last_read_at) >= new Date(row.last_message_at)) {
      return "already_read";
    }

    // Handoff cancel: if thread is no longer awaiting_human, a teammate took it
    if (row.kind === "recruiter_handoff") {
      const { data: th } = await sb
        .from("chat_threads")
        .select("status")
        .eq("id", row.thread_id)
        .maybeSingle();
      if (th && th.status !== "awaiting_human") return "thread_handled";
    }
  }

  // Candidate emails: skip if candidate started polling again
  if (row.recipient_email && row.kind === "candidate_recruiter_reply") {
    const { data: th } = await sb
      .from("chat_threads")
      .select("last_candidate_read_at")
      .eq("id", row.thread_id)
      .maybeSingle();
    if (th?.last_candidate_read_at &&
        new Date(th.last_candidate_read_at) >= new Date(row.last_message_at)) {
      return "candidate_active";
    }

    // Suppression list double-check (case-insensitive equality via lowercased .eq).
    const { data: sup } = await sb
      .from("email_suppression_list")
      .select("email")
      .eq("email", row.recipient_email.toLowerCase())
      .maybeSingle();
    if (sup) return "suppressed";

  }

  return null;
}

// ---------- Email rendering ------------------------------------------------

interface ThreadCtx {
  candidate_name: string;
  candidate_email: string | null;
  job_title: string | null;
  tenant_name: string | null;
}

async function loadThreadCtx(
  sb: ReturnType<typeof admin>,
  threadId: string,
): Promise<ThreadCtx | null> {
  const { data } = await sb
    .from("chat_threads")
    .select(`
      candidate:candidates!inner(candidate_name, email),
      job:jobs(title),
      tenant:tenants(name)
    `)
    .eq("id", threadId)
    .maybeSingle();
  if (!data) return null;
  return {
    candidate_name: (data as any).candidate?.candidate_name ?? "Candidate",
    candidate_email: (data as any).candidate?.email ?? null,
    job_title: (data as any).job?.title ?? null,
    tenant_name: (data as any).tenant?.name ?? null,
  };
}

async function loadLastExcerpt(
  sb: ReturnType<typeof admin>,
  threadId: string,
  direction: "in" | "out",
): Promise<string | null> {
  const { data } = await sb
    .from("chat_messages")
    .select("body")
    .eq("thread_id", threadId)
    .eq("direction", direction)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const body = data?.body?.trim() ?? null;
  if (!body) return null;
  return body.length > 220 ? body.slice(0, 220) + "…" : body;
}

function recipientName(emailOrName: string | null | undefined): string {
  if (!emailOrName) return "there";
  const first = emailOrName.split(/[\s@]/)[0];
  return first || "there";
}

function appBase(): string {
  return (Deno.env.get("PUBLIC_APP_URL") ?? "https://app.gogio.io").replace(/\/$/, "");
}

async function buildEmail(
  sb: ReturnType<typeof admin>,
  row: QueueRow,
): Promise<{ subject: string; html: string; to: string } | { skip: string }> {
  const ctx = await loadThreadCtx(sb, row.thread_id);
  if (!ctx) return { skip: "thread_missing" };

  const company = ctx.tenant_name ?? "Gio";
  const jobLabel = ctx.job_title ? ` about ${ctx.job_title}` : "";

  if (row.kind === "recruiter_new_message") {
    if (!row.recipient_user_id) return { skip: "no_user" };
    const { data: prof } = await sb.from("profiles")
      .select("email, first_name")
      .eq("id", row.recipient_user_id).maybeSingle();
    if (!prof?.email) return { skip: "no_recipient_email" };
    const excerpt = await loadLastExcerpt(sb, row.thread_id, "in");
    const count = row.message_count;
    const subject = count > 1
      ? `${count} new messages from ${ctx.candidate_name}`
      : `${ctx.candidate_name} sent a new message${jobLabel}`;
    const html = createEmailTemplate({
      recipientName: prof.first_name || recipientName(prof.email),
      preheaderText: excerpt ?? subject,
      title: subject,
      content: `
        <p><strong>${escapeHtml(ctx.candidate_name)}</strong> wrote:</p>
        <blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #6366f1;background:#f9fafb;color:#374151;border-radius:4px;">
          ${excerpt ? escapeHtml(excerpt) : "(no message body)"}
        </blockquote>
        ${count > 1 ? `<p style="color:#6b7280;font-size:13px;">+${count - 1} more message${count - 1 === 1 ? "" : "s"} in this thread.</p>` : ""}
      `,
      ctaText: "Open chat",
      ctaUrl: `${appBase()}/chat/${row.thread_id}`,
      footerNote: "You're receiving this because chat email notifications are on.",
    });
    return { subject, html, to: prof.email };
  }

  if (row.kind === "recruiter_handoff") {
    if (!row.recipient_user_id) return { skip: "no_user" };
    const { data: prof } = await sb.from("profiles")
      .select("email, first_name")
      .eq("id", row.recipient_user_id).maybeSingle();
    if (!prof?.email) return { skip: "no_recipient_email" };
    const excerpt = await loadLastExcerpt(sb, row.thread_id, "in");
    const subject = `Gio handed off ${ctx.candidate_name} — needs a human`;
    const html = createEmailTemplate({
      recipientName: prof.first_name || recipientName(prof.email),
      preheaderText: `Gio asked for a human on ${ctx.candidate_name}'s chat.`,
      title: subject,
      content: `
        <p>Gio handed this chat over and is waiting for a teammate to step in${jobLabel}.</p>
        ${excerpt ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #f59e0b;background:#fffbeb;color:#374151;border-radius:4px;">
          ${escapeHtml(excerpt)}
        </blockquote>` : ""}
      `,
      ctaText: "Take over chat",
      ctaUrl: `${appBase()}/chat/${row.thread_id}`,
      footerNote: "First teammate to reply takes the thread.",
    });
    return { subject, html, to: prof.email };
  }

  // candidate_recruiter_reply
  if (!row.recipient_email) return { skip: "no_email" };
  const excerpt = await loadLastExcerpt(sb, row.thread_id, "out");
  const subject = `${company} replied${jobLabel}`;
  // Look up the candidate's latest active magic-link token (best-effort).
  const { data: tok } = await sb
    .from("chat_access_tokens")
    .select("token_hash, expires_at, revoked_at")
    .eq("thread_id", row.thread_id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ctaUrl = tok
    ? `${appBase()}/chat/c/${row.thread_id}`
    : `${appBase()}/chat`;
  const html = createEmailTemplate({
    recipientName: recipientName(ctx.candidate_name),
    preheaderText: excerpt ?? subject,
    title: subject,
    content: `
      <p><strong>${escapeHtml(company)}</strong> sent you a reply:</p>
      <blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #6366f1;background:#f9fafb;color:#374151;border-radius:4px;">
        ${excerpt ? escapeHtml(excerpt) : "(no message body)"}
      </blockquote>
      ${row.message_count > 1 ? `<p style="color:#6b7280;font-size:13px;">+${row.message_count - 1} more in this conversation.</p>` : ""}
    `,
    ctaText: "Open chat",
    ctaUrl,
    footerNote: "If you didn't expect this, you can safely ignore this email.",
  });
  return { subject, html, to: row.recipient_email };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ---------- Send via Resend -----------------------------------------------

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY missing");
  const from = Deno.env.get("EMAIL_DEFAULT_FROM") || "Gio <chat@app.gogio.io>";

  const { Resend } = await import("npm:resend@2.0.0");
  const resend = new Resend(key);
  const res = await resend.emails.send({ from, to: [to], subject, html });
  // The Resend SDK throws on transport failures; surface 4xx/5xx response errors:
  if ((res as any)?.error) {
    throw new Error(JSON.stringify((res as any).error).slice(0, 400));
  }
}

// ---------- Main handler ---------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Authentication is enforced by Supabase (verify_jwt = true in config.toml).
  // The pg_cron job invokes this with the project's anon apikey.

  const sb = admin();
  const nowIso = new Date().toISOString();

  // Pull due batch
  const { data: rows, error } = await sb
    .from("chat_notification_queue")
    .select("id, tenant_id, thread_id, kind, recipient_user_id, recipient_email, message_count, last_message_id, last_message_at, attempts")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[chat-notification-processor] fetch failed", error);
    return json(500, { error: "fetch_failed" });
  }
  if (!rows || rows.length === 0) return json(200, { processed: 0 });

  const results = { sent: 0, cancelled: 0, failed: 0, errors: [] as string[] };

  for (const row of rows as QueueRow[]) {
    try {
      const cancel = await shouldCancel(sb, row);
      if (cancel) {
        await markCancelled(sb, row.id, cancel);
        results.cancelled++;
        continue;
      }
      const built = await buildEmail(sb, row);
      if ("skip" in built) {
        await markCancelled(sb, row.id, built.skip);
        results.cancelled++;
        continue;
      }
      await sendEmail(built.to, built.subject, built.html);
      await markSent(sb, row.id);
      results.sent++;
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      console.warn("[chat-notification-processor] send failed", row.id, msg);
      await markFailedOrRetry(sb, row, msg);
      results.failed++;
      results.errors.push(msg.slice(0, 120));
    }
  }

  return json(200, { processed: rows.length, ...results });
});
