// Privacy (2026-10-12): the notice we send people we collect, the 3-year
// "keep or remove?" check, and removing a person for good.
//
// Approved wording (Allan, 2026-10-12). Links carry a random token; only its
// SHA-256 is stored (privacy_requests.token_hash).

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { appBase } from "./referenceTokens.ts";

export const VIRGILIO_TENANT_ID =
  Deno.env.get("PRIVACY_TENANT_ID") ?? "5ba7b145-f251-4b18-8900-724cb06028ab";
export const PRIVACY_EMAIL = "privacy@virgilio.tech";

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function choiceUrl(token: string): string {
  return `${appBase()}/privacy/choice/${encodeURIComponent(token)}`;
}

/** Where we found someone, in words for the notice. */
export function sourceLabel(source: string | null | undefined): string {
  switch ((source ?? "").toLowerCase()) {
    case "apollo":
      return "Apollo.io, a business contact database";
    case "pdl":
    case "people_data_labs":
      return "People Data Labs, a business contact database";
    case "coresignal":
      return "Coresignal, a business data provider";
    case "linkedin":
    case "linkedin_extension":
      return "your public LinkedIn profile";
    default:
      return "public professional sources";
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function shell(title: string, paragraphs: string[], button: { label: string; url: string } | null, after: string[]) {
  const p = (t: string) =>
    `<p style="margin:0 0 14px 0;font-family:Inter,-apple-system,'Segoe UI',Arial,sans-serif;font-size:14.5px;line-height:1.6;color:#1F2230;">${t}</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#F6F5F1;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F1;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #ECEAE3;border-radius:16px;">
<tr><td style="padding:32px 32px 8px 32px;">
${paragraphs.map(p).join("\n")}
${button ? `<p style="margin:6px 0 20px 0;"><a href="${button.url}" style="display:inline-block;background:#0d0d09;color:#fffcf9;text-decoration:none;font-family:Poppins,Inter,Arial,sans-serif;font-weight:600;font-size:14px;padding:11px 18px;border-radius:10px;">${esc(button.label)}</a></p>` : ""}
${after.map(p).join("\n")}
</td></tr>
<tr><td style="padding:0 32px 28px 32px;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.5;color:#6B7080;">
Virgilio · <a href="mailto:${PRIVACY_EMAIL}" style="color:#6B7080;">${PRIVACY_EMAIL}</a><br>
Virgilio Technologies LLC, 131 Continental Dr., Suite 305, Newark, Delaware 19713, USA
</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderNoticeEmail(v: { firstName: string | null; source: string | null; url: string }) {
  const hi = v.firstName ? `Hi ${esc(v.firstName)},` : "Hi,";
  const src = esc(sourceLabel(v.source));
  const policy = `${appBase()}/privacy`;
  const subject = "Your professional details at Virgilio";
  const html = shell(
    subject,
    [
      hi,
      `Virgilio is a recruiting firm that hires sales and go-to-market talent. We've added your professional profile to our recruiting database, from ${src}: your name, current role and company, past roles, location and work email.`,
      "We use it only to consider you for roles that may fit, and we may reach out about one. We never sell it.",
      "If you'd rather we didn't keep it, use this link and we'll delete your details and won't add them again:",
    ],
    { label: "Remove my details", url: v.url },
    [`Our <a href="${policy}" style="color:#1F2230;">Privacy Policy</a> explains your rights.`],
  );
  const text = [
    v.firstName ? `Hi ${v.firstName},` : "Hi,",
    "",
    `Virgilio is a recruiting firm that hires sales and go-to-market talent. We've added your professional profile to our recruiting database, from ${sourceLabel(v.source)}: your name, current role and company, past roles, location and work email.`,
    "",
    "We use it only to consider you for roles that may fit, and we may reach out about one. We never sell it.",
    "",
    "If you'd rather we didn't keep it, use this link and we'll delete your details and won't add them again:",
    v.url,
    "",
    `Our Privacy Policy explains your rights: ${policy}`,
    "",
    `Virgilio · ${PRIVACY_EMAIL}`,
  ].join("\n");
  return { subject, html, text };
}

export function renderRetentionEmail(v: { firstName: string | null; url: string }) {
  const hi = v.firstName ? `Hi ${esc(v.firstName)},` : "Hi,";
  const subject = "Should Virgilio keep your details?";
  const html = shell(
    subject,
    [
      hi,
      "Virgilio, the recruiting firm, has had your professional profile for over three years without being in touch. Before we let it go, we'd like to ask.",
      "Keep it, and we'll think of you for sales and go-to-market roles that fit. Otherwise, or if you don't answer within 30 days, we'll delete your details.",
    ],
    { label: "Keep or remove my details", url: v.url },
    [`Our <a href="${appBase()}/privacy" style="color:#1F2230;">Privacy Policy</a> explains your rights.`],
  );
  const text = [
    v.firstName ? `Hi ${v.firstName},` : "Hi,",
    "",
    "Virgilio, the recruiting firm, has had your professional profile for over three years without being in touch. Before we let it go, we'd like to ask.",
    "",
    "Keep it, and we'll think of you for sales and go-to-market roles that fit. Otherwise, or if you don't answer within 30 days, we'll delete your details.",
    "",
    `Keep or remove my details: ${v.url}`,
    "",
    `Our Privacy Policy explains your rights: ${appBase()}/privacy`,
    "",
    `Virgilio · ${PRIVACY_EMAIL}`,
  ].join("\n");
  return { subject, html, text };
}

/** Sends from PRIVACY_FROM (default a verified Gio sender), replies go to
 *  privacy@virgilio.tech. */
export async function sendPrivacyEmail(to: string, msg: { subject: string; html: string; text: string }, unsubscribeUrl: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY missing");
  const from = Deno.env.get("PRIVACY_FROM") || "Virgilio <privacy@app.gogio.io>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: PRIVACY_EMAIL,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Records the person's identifiers (hashed) so sourcing never adds them
 *  again, then removes everything Gio holds about them. */
export async function forgetCandidate(sb: SupabaseClient, candidateId: string, reason: string) {
  const { error: supErr } = await sb.rpc("privacy_suppress_candidate", { p_candidate_id: candidateId, p_reason: reason });
  if (supErr) throw supErr;

  // Files (résumés and attachments) in the private bucket.
  const { data: atts } = await sb.from("candidate_attachments").select("file_url, converted_pdf_url").eq("candidate_id", candidateId);
  const { data: cand } = await sb.from("candidates").select("resume_url").eq("id", candidateId).maybeSingle();
  const urls = [
    ...(atts ?? []).flatMap((a: { file_url: string | null; converted_pdf_url: string | null }) => [a.file_url, a.converted_pdf_url]),
    (cand as { resume_url: string | null } | null)?.resume_url ?? null,
  ].filter((u): u is string => Boolean(u));
  const paths = urls
    .map((u) => {
      const m = u.match(/candidate-attachments\/([^?]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    })
    .filter((p): p is string => Boolean(p));
  if (paths.length) await sb.storage.from("candidate-attachments").remove(paths);

  // Their emails (with the attachment files Gmail sync saved) and chat
  // (not removed by the candidate row's cascade).
  const { data: mails } = await sb.from("email_logs").select("attachments").eq("candidate_id", candidateId);
  const mailFiles = [...new Set(
    (mails ?? [])
      .flatMap((m: { attachments: unknown }) => (Array.isArray(m.attachments) ? m.attachments : []))
      .map((a: { storagePath?: string }) => a?.storagePath)
      .filter((p): p is string => typeof p === "string" && p.length > 0),
  )];
  for (let i = 0; i < mailFiles.length; i += 100) {
    await sb.storage.from("email-attachments").remove(mailFiles.slice(i, i + 100));
  }
  await sb.from("email_logs").delete().eq("candidate_id", candidateId);
  const { data: threads } = await sb.from("chat_threads").select("id").eq("candidate_id", candidateId);
  const threadIds = (threads ?? []).map((t: { id: string }) => t.id);
  if (threadIds.length) {
    await sb.from("chat_messages").delete().in("thread_id", threadIds);
    await sb.from("chat_threads").delete().in("id", threadIds);
  }

  // The candidate; pipelines, scorecards, work history, bookings and the rest cascade.
  const { error } = await sb.from("candidates").delete().eq("id", candidateId);
  if (error) throw error;
}
