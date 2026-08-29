// Reference-check emails.
//
// Every string is resolved from the REQUEST'S `template_snapshot` — never the
// live template — so editing a template can't change the wording of a request
// already in flight. Placeholder resolution is strict: any unresolved
// {{token}} throws and the caller aborts the send.
//
// Branding is the AGENCY's. Gio appears once, in the footer footnote.

import { Resend } from "npm:resend@2.0.0";

export interface RefEmailTemplate {
  subject: string;
  body: string;
}

export interface AgencyBrand {
  name: string;
  logoUrl?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const CREAM = "#FAF8F3";
const INK = "#1F2230";
const MUTED = "#8B8F9E";
const HAIRLINE = "#EDEBE3";
const PURPLE = "#6F3FF5";

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strict placeholder resolution — throws on any token we can't resolve. */
export function resolveStrict(text: string, vars: Record<string, string>): string {
  const missing: string[] = [];
  const out = (text || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    if (v === undefined || v === null || v === "") {
      missing.push(key);
      return "";
    }
    return v;
  });
  if (missing.length > 0) {
    throw new Error(
      `Unresolved email placeholder${missing.length > 1 ? "s" : ""}: ${[...new Set(missing)].join(", ")}`,
    );
  }
  return out;
}

/** ceil(45s x visible questions), floor 3. */
export function estimatedMinutes(questions: Array<{ internal?: boolean; type?: string }>): number {
  const visible = (questions || []).filter(
    (q) => !q.internal && q.type !== "section_header",
  ).length;
  return Math.max(3, Math.ceil((visible * 45) / 60));
}

export function formatExpiry(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
}

function brandHeader(brand: AgencyBrand): string {
  if (brand.logoUrl) {
    return `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" height="26" style="height:26px;width:auto;display:block;" />`;
  }
  return `<span style="font-family:'Poppins',Helvetica,Arial,sans-serif;font-size:19px;font-weight:700;letter-spacing:-0.03em;color:${INK};">${escapeHtml(brand.name)}</span>`;
}

/**
 * Render one reference email. `{{secure_link}}` in the body is replaced with a
 * CTA button in HTML and with the bare URL in the plain-text part.
 */
export function renderReferenceEmail(input: {
  template: RefEmailTemplate;
  vars: Record<string, string>;
  brand: AgencyBrand;
  ctaLabel: string;
  secureLink: string;
  footnote: string;
}): RenderedEmail {
  const { template, brand, ctaLabel, secureLink, footnote } = input;
  const vars = { ...input.vars, secure_link: secureLink };

  const subject = resolveStrict(template.subject, vars).trim();
  const bodyResolved = resolveStrict(template.body, vars);

  const text = bodyResolved.trim() + `\n\n—\n${footnote}\nRecruitment software by Gio`;

  const paragraphs = bodyResolved
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks = paragraphs
    .map((p) => {
      if (p === secureLink) {
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0;"><tr><td style="border-radius:10px;background:${INK};">
          <a href="${escapeHtml(secureLink)}" style="display:inline-block;padding:13px 22px;font-family:'Poppins',Helvetica,Arial,sans-serif;font-size:13.5px;font-weight:600;letter-spacing:-0.01em;color:#fffcf9;text-decoration:none;">${escapeHtml(ctaLabel)}</a>
        </td></tr></table>`;
      }
      return `<p style="margin:0 0 14px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.62;color:${INK};">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`;
    })
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${CREAM};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(subject)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:22px;box-shadow:0 18px 44px -22px rgba(20,18,12,0.22);overflow:hidden;">
        <tr><td style="padding:24px 30px 18px;border-bottom:1px solid ${HAIRLINE};">${brandHeader(brand)}</td></tr>
        <tr><td style="padding:26px 30px 8px;">${blocks}</td></tr>
        <tr><td style="padding:18px 30px 26px;border-top:1px solid ${HAIRLINE};">
          <p style="margin:0 0 6px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11.5px;line-height:1.6;color:${MUTED};">${escapeHtml(footnote)}</p>
          <p style="margin:0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11.5px;color:${MUTED};">Recruitment software by <span style="color:${PURPLE};font-weight:600;">Gio</span></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");

/** From = agency display name on the platform relay; Reply-To = the recruiter. */
export async function sendReferenceEmail(input: {
  brandName: string;
  to: string;
  replyTo?: string | null;
  rendered: RenderedEmail;
}): Promise<void> {
  const relay = Deno.env.get("EMAIL_DEFAULT_FROM_ADDRESS") || "noreply@app.gogio.io";
  const fromName = input.brandName.replace(/[<>"]/g, "").trim() || "References";
  const payload: Record<string, unknown> = {
    from: `${fromName} <${relay}>`,
    to: [input.to],
    subject: input.rendered.subject,
    html: input.rendered.html,
    text: input.rendered.text,
  };
  if (input.replyTo) payload.reply_to = input.replyTo;

  const { error } = await resend.emails.send(payload as never);
  if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
}
