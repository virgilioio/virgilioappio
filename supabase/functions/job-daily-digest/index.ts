// The hiring team's daily digest (job_settings.daily_digest, 2026-10-19). The
// database writes each person's digest at 9:00 Mexico City time
// (job_digest_prepare, pg_cron 'job-daily-digest') and calls this function
// (x-internal-secret) only when one is owed by email. It claims them
// (job_digest_claim), sends each in the Gio ATS design (_shared/atsEmail.ts) and
// marks it sent (job_digest_finish); a failure is released and retried, up to
// five times. ASCII only.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, appBase } from "../_shared/referenceTokens.ts";
import { atsLayout, esc, firstName } from "../_shared/atsEmail.ts";

interface DigestJob {
  job_id: string;
  title: string | null;
  apps: number;
  names: string[];
  moves: number;
  gio_rejections: number;
}

interface Digest {
  user_id: string;
  day: string;
  email: string | null;
  name: string;
  content: { jobs: DigestJob[]; apps: number; moves: number; gio_rejections: number };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Ana", "Ana and Ben", "Ana, Ben and 3 others". */
function who(names: string[], total: number) {
  const shown = names.slice(0, 2);
  const rest = total - shown.length;
  if (rest > 0) return `${shown.join(", ")} and ${plural(rest, "other", "others")}`;
  if (shown.length === 2) return `${shown[0]} and ${shown[1]}`;
  return shown[0] ?? "";
}

function summary(c: Digest["content"]) {
  return [
    c.apps ? plural(c.apps, "new application", "new applications") : "",
    c.moves ? plural(c.moves, "stage move", "stage moves") : "",
    c.gio_rejections ? plural(c.gio_rejections, "rejected by Gio", "rejected by Gio") : "",
  ].filter(Boolean).join(", ");
}

function message(d: Digest) {
  const base = appBase();
  const head = summary(d.content);
  const rows = d.content.jobs.map((j) => {
    const title = j.title || "Untitled job";
    const parts = [
      j.apps ? `${plural(j.apps, "application", "applications")}${j.names.length ? ` (${who(j.names, j.apps)})` : ""}` : "",
      j.moves ? plural(j.moves, "stage move", "stage moves") : "",
      j.gio_rejections ? `${j.gio_rejections} rejected by Gio` : "",
    ].filter(Boolean);
    return { title, url: `${base}/jobs/${j.job_id}/pipeline`, line: parts.map(esc).join(" &middot; "), text: parts.join(", ") };
  });
  const body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #E7E8EE;border-radius:16px;margin:0 0 24px">${rows
    .map(
      (r, i) => `<tr><td style="padding:14px 18px;${i ? "border-top:1px solid #F1F0EC;" : ""}font-family:Inter,-apple-system,'Segoe UI',Arial,sans-serif">
  <a href="${esc(r.url)}" style="font-family:Poppins,'Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:13.5px;color:#0d0d09;text-decoration:none;letter-spacing:-.01em">${esc(r.title)}</a>
  <div style="margin-top:3px;font-size:12.5px;line-height:1.5;color:#5A6072">${r.line}</div>
</td></tr>`,
    )
    .join("")}</table>`;
  const why = "You're getting this because you're on these jobs' hiring team and keep daily digests by email (Settings > Notifications).";
  const html = atsLayout({
    preheader: head,
    product: "Daily digest",
    eyebrow: "Since yesterday",
    title: "Your jobs since yesterday",
    lead: `Hi <strong style="color:#1F2230;font-weight:600">${esc(firstName(d.name))}</strong>, here's what happened on your jobs: ${esc(head)}.`,
    body,
    cta: { label: "Open your jobs", url: `${base}/jobs` },
    why,
  });
  const text = `Hi ${firstName(d.name)},\n\nHere's what happened on your jobs since yesterday: ${head}.\n\n${rows
    .map((r) => `${r.title}: ${r.text}\n${r.url}`)
    .join("\n\n")}\n\n${why}\nGio ATS - support@virgilio.tech\n`;
  return { subject: `Your jobs since yesterday: ${head}`, html, text };
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY missing");
  const address = Deno.env.get("EMAIL_DEFAULT_FROM_ADDRESS") || "noreply@app.gogio.io";
  const { Resend } = await import("npm:resend@2.0.0");
  const res = await new Resend(key).emails.send({ from: `Gio <${address}>`, to: [to], subject: subject.slice(0, 200), html, text });
  // deno-lint-ignore no-explicit-any
  const err = (res as any)?.error;
  if (err) throw new Error(JSON.stringify(err).slice(0, 400));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected || req.headers.get("x-internal-secret") !== expected) return json(401, { error: "unauthorized" });
  const supabase = adminClient();
  try {
    const { data, error } = await supabase.rpc("job_digest_claim", { _limit: 50 });
    if (error) throw error;
    let sent = 0;
    let failed = 0;
    for (const d of (data ?? []) as Digest[]) {
      try {
        if (!d.email) throw new Error("no email address");
        const m = message(d);
        await sendEmail(d.email, m.subject, m.html, m.text);
        await supabase.rpc("job_digest_finish", { _user_id: d.user_id, _day: d.day, _ok: true });
        sent++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("job-daily-digest", d.user_id, d.day, msg);
        await supabase.rpc("job_digest_finish", { _user_id: d.user_id, _day: d.day, _ok: false, _error: msg });
      }
    }
    return json(200, { sent, failed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("job-daily-digest", msg);
    return json(500, { error: msg });
  }
});
