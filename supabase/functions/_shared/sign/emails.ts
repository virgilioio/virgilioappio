// Gio Sign emails: one layout (the Sign design: cream card, logo masthead,
// eyebrow, Poppins title with a purple period, a white inner card, a dark
// button, a footnote) and the messages built on it. Tables and inline
// styles only, so it holds up in Gmail and Outlook. ASCII only in this file:
// typographic characters are HTML entities.

import { Resend } from "npm:resend@2.0.0";
import { appBase } from "../referenceTokens.ts";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Fill {{tags}} from the envelope's frozen values; unknown tags stay as written. */
export const fillTags = (text: string, values: Record<string, unknown> | null) =>
  String(text ?? "").replace(/\{\{(\w+)\}\}/g, (m, k) => (values && values[k] != null ? String(values[k]) : m));

export const firstName = (name: string) => String(name || "").trim().split(/\s+/)[0] || "there";

export function longDate(iso: string | Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}
export function dateTime(iso: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso));
}

/** A middle dot, kept out of the source as a character code (this file is ASCII only). */
export const DOT = String.fromCharCode(183);

const F = "font-family:Inter,'Segoe UI',Arial,sans-serif";
const P = "font-family:Poppins,'Segoe UI',Arial,sans-serif";

interface Layout {
  preheader: string;
  kind: string;
  eyebrow: string;
  eyebrowColor?: string;
  title: string;
  lead: string;
  card?: string;
  cta?: { label: string; url: string };
  note?: string;
  foot: string;
  brand: string;
}

export function layout(o: Layout): string {
  const logo = `${appBase()}/gio-sign-logo.png`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#F6F5F1">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F1"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffcf9;border:1px solid #E7E8EE;border-radius:20px;overflow:hidden">
<tr><td style="padding:24px 36px;border-bottom:1px solid #F1F0EC">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><img src="${logo}" width="92" height="32" alt="Gio Sign" style="display:block;border:0;${P};font-size:18px;font-weight:600;color:#0d0d09"></td>
    <td align="right" style="${F};font-size:12px;color:#6B7080;white-space:nowrap">${esc(o.kind)}</td>
  </tr></table>
</td></tr>
<tr><td style="padding:34px 36px 30px">
  <div style="${F};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:${o.eyebrowColor ?? "#6F3FF5"};margin-bottom:14px">${o.eyebrow}</div>
  <h1 style="margin:0;${P};font-size:28px;line-height:1.15;font-weight:600;letter-spacing:-.03em;color:#0d0d09">${o.title}<span style="color:#6F3FF5">.</span></h1>
  <p style="margin:16px 0 0;${F};font-size:14.5px;line-height:1.6;color:#5A6072">${o.lead}</p>
  ${o.card ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#ffffff;border:1px solid #E7E8EE;border-radius:16px"><tr><td style="padding:18px">${o.card}</td></tr></table>` : `<div style="height:24px"></div>`}
  ${o.cta ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0d0d09;border-radius:12px"><a href="${esc(o.cta.url)}" style="display:inline-block;padding:14px 26px;${P};font-size:15px;font-weight:600;color:#fffcf9;text-decoration:none">${esc(o.cta.label)} &rarr;</a></td></tr></table>` : ""}
  ${o.note ? `<p style="margin:15px 0 0;${F};font-size:12px;line-height:1.5;color:#6B7080">${o.note}</p>` : ""}
</td></tr>
<tr><td style="padding:20px 36px 26px;border-top:1px solid #F1F0EC;background:#FBFAF7">
  <p style="margin:0 0 12px;padding-bottom:12px;border-bottom:1px solid #F1F0EC;${F};font-size:11.5px;line-height:1.55;color:#6B7080">${o.foot}</p>
  <p style="margin:0;${F};font-size:11px;color:#6B7080">Gio Sign &middot; Sent on behalf of ${esc(o.brand)}</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

const person = (name: string, sub: string, pill?: { text: string; ok?: boolean }) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td width="40" style="vertical-align:middle"><div style="width:40px;height:40px;border-radius:20px;background:#F2EBFF;color:#6F3FF5;${P};font-size:15px;font-weight:600;line-height:40px;text-align:center">${esc(String(name || "?").trim()[0]?.toUpperCase() ?? "?")}</div></td>
  <td style="padding-left:11px;vertical-align:middle"><div style="${P};font-size:13.5px;font-weight:600;color:#0d0d09">${esc(name)}</div><div style="${F};font-size:11.5px;color:#6B7080">${esc(sub)}</div></td>
  ${pill ? `<td align="right" style="vertical-align:middle"><span style="display:inline-block;padding:3px 9px;border-radius:999px;${F};font-size:10.5px;font-weight:600;background:${pill.ok ? "#E3F3EA" : "#F1EAFE"};color:${pill.ok ? "#16704A" : "#5B21B6"};white-space:nowrap">${esc(pill.text)}</span></td>` : ""}
</tr></table>`;

const docRow = (name: string, sub: string) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-top:1px solid #F1F0EC"><tr>
  <td width="34" style="padding-top:14px;vertical-align:middle"><div style="width:34px;height:42px;border-radius:6px;background:#F4F3EF"></div></td>
  <td style="padding:14px 0 0 12px;vertical-align:middle"><div style="${P};font-size:13px;font-weight:600;color:#0d0d09">${esc(name)}</div><div style="${F};font-size:11.5px;color:#6B7080">${esc(sub)}</div></td>
</tr></table>`;

const steps = (rows: { done: boolean; n: number; name: string; sub: string }[]) =>
  rows.map((r) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px"><tr>
  <td width="26" style="vertical-align:top"><div style="width:26px;height:26px;border-radius:7px;background:${r.done ? "#E3F3EA" : "#F1F0EC"};color:${r.done ? "#16704A" : "#5A6072"};${P};font-size:12px;font-weight:600;line-height:26px;text-align:center">${r.done ? "&#10003;" : r.n}</div></td>
  <td style="padding-left:11px"><div style="${P};font-size:13px;font-weight:600;color:#0d0d09">${esc(r.name)}</div><div style="${F};font-size:12px;color:#6B7080;line-height:1.45">${esc(r.sub)}</div></td>
</tr></table>`).join("");

/* ------------------------------------------------------------------ send */

export interface Mail {
  from: string;
  to: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(m: Mail) {
  const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");
  const payload: Record<string, unknown> = { from: m.from, to: [m.to], subject: m.subject.slice(0, 200), html: m.html, text: m.text };
  if (m.replyTo) payload.reply_to = m.replyTo;
  const { error } = await resend.emails.send(payload as never);
  if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
}

const relay = () => Deno.env.get("EMAIL_DEFAULT_FROM_ADDRESS") || "noreply@app.gogio.io";
const clean = (s: string) => String(s || "").replace(/[<>"]/g, "").trim();
export const fromVia = (name: string) => `${clean(name) || "Gio Sign"} via Gio Sign <${relay()}>`;
export const fromSign = () => `Gio Sign <${relay()}>`;

/* -------------------------------------------------------------- messages */

export function inviteEmail(i: {
  brand: string;
  senderName: string;
  senderEmail: string;
  recipientName: string;
  recipientEmail: string;
  role: string;
  subject: string;
  body: string;
  docName: string;
  pages: number;
  expiresAt: string;
  link: string;
}): Mail {
  const first = firstName(i.recipientName);
  const verb = i.role === "approver" ? "approve" : "sign";
  const card =
    person(i.senderName, i.brand, { text: "Sent you" }) +
    (i.body.trim()
      ? `<div style="border-top:1px solid #F1F0EC;margin-top:14px;padding-top:14px;${F};font-size:13.5px;line-height:1.6;color:#0d0d09;white-space:pre-wrap">${esc(i.body)}</div>`
      : "") +
    docRow(i.docName, `${i.pages} page${i.pages === 1 ? "" : "s"} ${DOT} link valid until ${longDate(i.expiresAt)}`);
  return {
    from: fromVia(i.senderName),
    to: i.recipientEmail,
    replyTo: i.senderEmail,
    subject: i.subject || `${i.docName} to ${verb}`,
    html: layout({
      preheader: `${i.senderName} sent you a document to ${verb}.`,
      kind: "Secure link",
      eyebrow: `Document to review and ${verb}`,
      title: `${esc(first)}, your document is ready to ${verb}`,
      lead: `<b style="color:#0d0d09">${esc(i.senderName)}</b> at ${esc(i.brand)} sent you a document for your electronic ${verb === "sign" ? "signature" : "approval"}. It takes a couple of minutes.`,
      card,
      cta: { label: "Review document", url: i.link },
      note: `Your private link is valid until ${esc(longDate(i.expiresAt))}.`,
      foot: `Don&rsquo;t forward this email: the link is personal to you. Gio Sign asks for a one-time code sent to ${esc(i.recipientEmail)} before the document opens. Questions? Reply to reach ${esc(i.senderName)} directly.`,
      brand: i.brand,
    }),
    text:
      `Hi ${first},\n\n${i.senderName} at ${i.brand} sent you a document to ${verb}: ${i.docName}.\n\n` +
      (i.body.trim() ? `${i.body.trim()}\n\n` : "") +
      `Review it here: ${i.link}\n\nYour private link is valid until ${longDate(i.expiresAt)}. Don't forward this email: the link is personal to you.\n\nGio Sign - sent on behalf of ${i.brand}`,
  };
}

export function codeEmail(i: { brand: string; recipientName: string; recipientEmail: string; code: string; title: string }): Mail {
  const spaced = `${i.code.slice(0, 3)} ${i.code.slice(3)}`;
  return {
    from: fromVia(i.brand),
    to: i.recipientEmail,
    subject: `${spaced} is your Gio Sign code`,
    html: layout({
      preheader: `Your code is ${spaced}. It works for 10 minutes.`,
      kind: "Verification",
      eyebrow: "Your one-time code",
      title: `Here&rsquo;s your code, ${esc(firstName(i.recipientName))}`,
      lead: `Enter it on the signing page to open <b style="color:#0d0d09">${esc(i.title)}</b>.`,
      card: `<div style="${P};font-size:34px;font-weight:600;letter-spacing:8px;color:#0d0d09;text-align:center">${esc(spaced)}</div>`,
      note: "It works for 10 minutes. If you didn&rsquo;t ask for it, you can ignore this email.",
      foot: "Gio Sign asks for a code before a document opens, so only you can sign it.",
      brand: i.brand,
    }),
    text: `Your Gio Sign code is ${spaced}. Enter it on the signing page to open ${i.title}. It works for 10 minutes. If you didn't ask for it, you can ignore this email.`,
  };
}

export interface PersonRow {
  name: string;
  role: string;
  status: string;
  signed_at: string | null;
  approved_at: string | null;
  position: number;
  email: string;
}

const peopleSteps = (people: PersonRow[], senderEmail: string) =>
  steps(
    people
      .filter((p) => p.role !== "cc")
      .map((p, i) => {
        const done = p.status === "signed" || p.status === "approved";
        const you = p.email.toLowerCase() === senderEmail.toLowerCase();
        return {
          done,
          n: i + 1,
          name: you ? `You ${DOT} ${p.name}` : p.name,
          sub: done
            ? `${p.status === "approved" ? "Approved" : "Signed"} ${dateTime((p.signed_at ?? p.approved_at)!)}`
            : p.status === "sent" || p.status === "viewed"
            ? p.status === "viewed" ? "Opened, not signed yet" : "Has the link, waiting"
            : "Waiting for their turn",
        };
      }),
  );

export function senderSignedEmail(i: {
  brand: string;
  senderName: string;
  senderEmail: string;
  title: string;
  signerName: string;
  approved: boolean;
  people: PersonRow[];
  yourTurn: boolean;
  recordUrl: string | null;
}): Mail {
  const did = i.approved ? "approved" : "signed";
  const left = i.people.filter((p) => p.role !== "cc" && p.status !== "signed" && p.status !== "approved").length;
  return {
    from: fromSign(),
    to: i.senderEmail,
    subject: `${i.signerName} ${did} ${i.title}`,
    html: layout({
      preheader: i.yourTurn ? "It's your turn to countersign." : `${left} still to go.`,
      kind: "Gio Sign",
      eyebrow: esc(i.title),
      title: i.yourTurn ? `${esc(i.signerName)} ${did}. Your turn` : `${esc(i.signerName)} ${did}`,
      lead: i.yourTurn
        ? `It&rsquo;s your turn to sign. Your personal signing link is in the invitation email from Gio Sign.`
        : `${left} ${left === 1 ? "person still signs" : "people still sign"} before it&rsquo;s complete. We&rsquo;ll email you when everyone has.`,
      card: peopleSteps(i.people, i.senderEmail),
      cta: i.recordUrl ? { label: "Open in Gio ATS", url: i.recordUrl } : undefined,
      foot: "You&rsquo;re getting this because you sent this envelope.",
      brand: i.brand,
    }),
    text: `${i.signerName} ${did} ${i.title}.${i.yourTurn ? " It's your turn to sign: your link is in the invitation email from Gio Sign." : ""}${i.recordUrl ? `\n\n${i.recordUrl}` : ""}`,
  };
}

export function senderDeclinedEmail(i: {
  brand: string;
  senderEmail: string;
  title: string;
  signerName: string;
  reason: string;
  recordUrl: string | null;
}): Mail {
  return {
    from: fromSign(),
    to: i.senderEmail,
    subject: `${i.signerName} declined ${i.title}`,
    html: layout({
      preheader: `Reason: ${i.reason}`,
      kind: "Gio Sign",
      eyebrow: esc(i.title),
      eyebrowColor: "#B42318",
      title: `${esc(i.signerName)} declined to sign`,
      lead: "The envelope has stopped, and its links no longer open. If something needs changing, send a new envelope from the right template.",
      card: `<div style="${F};font-size:12px;color:#6B7080;margin-bottom:6px">Their reason</div><div style="${F};font-size:14px;line-height:1.55;color:#0d0d09">&ldquo;${esc(i.reason)}&rdquo;</div>`,
      cta: i.recordUrl ? { label: "Open in Gio ATS", url: i.recordUrl } : undefined,
      foot: "You&rsquo;re getting this because you sent this envelope.",
      brand: i.brand,
    }),
    text: `${i.signerName} declined ${i.title}. Reason: "${i.reason}"${i.recordUrl ? `\n\n${i.recordUrl}` : ""}`,
  };
}

export function senderCompletedEmail(i: {
  brand: string;
  senderEmail: string;
  title: string;
  people: PersonRow[];
  publicId: string;
  recordUrl: string | null;
}): Mail {
  return {
    from: fromSign(),
    to: i.senderEmail,
    subject: `Completed: ${i.title}`,
    html: layout({
      preheader: "Everyone has signed.",
      kind: "Completed",
      eyebrow: "Completed",
      eyebrowColor: "#16704A",
      title: "Everyone has signed",
      lead: `<b style="color:#0d0d09">${esc(i.title)}</b> is complete. We&rsquo;ll email the sealed PDF and its certificate of completion to everyone once it&rsquo;s sealed.`,
      card: peopleSteps(i.people, i.senderEmail),
      cta: i.recordUrl ? { label: "Open in Gio ATS", url: i.recordUrl } : undefined,
      note: `Envelope ID ${esc(i.publicId)}`,
      foot: "You&rsquo;re getting this because you sent this envelope.",
      brand: i.brand,
    }),
    text: `Everyone has signed ${i.title}. The sealed PDF follows once it's sealed. Envelope ID ${i.publicId}.${i.recordUrl ? `\n\n${i.recordUrl}` : ""}`,
  };
}
