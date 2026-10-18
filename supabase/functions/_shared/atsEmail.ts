// Gio ATS emails to the team: one layout in the Gio design shared with the
// scorecard and member emails and Gio Sign (2026-10-18): a cream card on the
// desk colour, the Gio ATS logo in the masthead with the product on the right
// (a lilac tile and its name), a purple eyebrow, a Poppins title with a lilac
// period, a white inner card, the dark button, a footnote, and the Gio footer.
// The logo is the "gio ats" lockup as a dark PNG (public/brand/gio-ats-logo-dark.png,
// drawn from GioAtsLogo's master paths): Gmail and Outlook don't show SVG.
// Tables and inline styles only. ASCII only in this file: typographic
// characters are HTML entities.

import { appBase } from "./referenceTokens.ts";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const firstName = (name: string) => String(name || "").trim().split(/\s+/)[0] || "there";

const F = "font-family:Inter,-apple-system,'Segoe UI',Arial,sans-serif";
const P = "font-family:Poppins,'Helvetica Neue',Arial,sans-serif";

const AVATAR_PALETTE = ["#6F3FF5", "#12B886", "#E8590C", "#1C7ED6", "#D6336C", "#4C6EF5", "#F59F00", "#0CA678"];

function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type Pill = { text: string; tone: "amber" | "purple" | "green" };
const PILL: Record<Pill["tone"], [string, string, string]> = {
  amber: ["#FEF3C7", "#B45309", "#F59E0B"],
  purple: ["#EDE4FF", "#5B21B6", "#6F3FF5"],
  green: ["#DCFBE9", "#0B7A57", "#12B886"],
};

/** A person (or candidate) row: initials avatar, name, a line under it, and a status pill. */
export function personCard(o: { name: string; sub: string; pill?: Pill; tiles?: { label: string; value: string }[] }) {
  const [bg, fg, dot] = o.pill ? PILL[o.pill.tone] : ["", "", ""];
  const pill = o.pill
    ? `<span style="display:inline-block;background:${bg};color:${fg};${F};font-size:11px;font-weight:600;padding:5px 10px 5px 8px;border-radius:9999px;line-height:1;white-space:nowrap"><span style="display:inline-block;width:6px;height:6px;background:${dot};border-radius:9999px;vertical-align:middle;margin-right:6px"></span>${esc(o.pill.text)}</span>`
    : "";
  const tiles = (o.tiles ?? []).length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px"><tr>${(o.tiles ?? [])
        .map(
          (t, i, all) => `<td width="${Math.floor(100 / all.length)}%" valign="top" style="${i ? "padding-left:6px;" : ""}${i < all.length - 1 ? "padding-right:6px;" : ""}">
  <div style="background:#F1F0EC;border-radius:10px;padding:12px 14px;${F}">
    <div style="font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#6B7080;line-height:1">${esc(t.label)}</div>
    <div style="margin-top:6px;font-size:12.5px;font-weight:500;color:#1F2230;line-height:1.3">${esc(t.value)}</div>
  </div></td>`,
        )
        .join("")}</tr></table>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
  <td width="52" valign="middle" style="width:52px"><div style="width:40px;height:40px;border-radius:9999px;background:${colorFor(o.name)};color:#fffcf9;${P};font-weight:600;font-size:14px;line-height:40px;text-align:center">${esc(initials(o.name))}</div></td>
  <td valign="middle" style="${P}">
    <div style="font-weight:600;font-size:13.5px;color:#0d0d09;letter-spacing:-.01em;line-height:1.25">${esc(o.name)}</div>
    <div style="${F};font-size:11.5px;color:#6B7080;margin-top:2px">${esc(o.sub)}</div>
  </td>
  <td align="right" valign="middle" style="white-space:nowrap">${pill}</td>
</tr></table>${tiles}`;
}

export interface AtsLayout {
  preheader: string;
  /** The product in the masthead, e.g. "Offer approvals". */
  product: string;
  eyebrow: string;
  /** Plain text; the lilac period is added. */
  title: string;
  /** HTML (escape what you put in). */
  lead: string;
  card?: string;
  cta?: { label: string; url: string };
  /** HTML. */
  note?: string;
  /** Why they got it. Plain text. */
  why: string;
  supportEmail?: string;
}

export function atsLayout(o: AtsLayout): string {
  const logo = `${appBase()}/brand/gio-ats-logo-dark.png`;
  const support = esc(o.supportEmail ?? "support@virgilio.tech");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>${esc(o.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600&display=swap" rel="stylesheet">
<style>@media only screen and (max-width:600px){.gio-card{width:100%!important;max-width:100%!important;border-radius:0!important}.gio-pad{padding-left:24px!important;padding-right:24px!important}.gio-headline{font-size:26px!important}}a{color:#6F3FF5}</style>
</head>
<body style="margin:0;padding:0;background:#ECEAE2;-webkit-text-size-adjust:100%">
<div style="display:none;font-size:1px;color:#ECEAE2;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ECEAE2" style="background:#ECEAE2"><tr><td align="center" style="padding:40px 20px">
<table role="presentation" class="gio-card" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#fffcf9;border-radius:20px;box-shadow:0 12px 32px -8px rgba(13,13,9,.08);overflow:hidden">
<tr><td class="gio-pad" style="padding:24px 40px;border-bottom:1px solid #F1F0EC">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="left" valign="middle"><img src="${logo}" width="107" height="34" alt="Gio ATS" style="display:block;border:0;${P};font-size:20px;font-weight:600;color:#0d0d09"></td>
    <td align="right" valign="middle" style="${P};font-weight:600;font-size:15px;color:#1F2230;letter-spacing:-.02em;white-space:nowrap">
      <span style="display:inline-block;width:10px;height:10px;background:#D7C5FB;border-radius:3px;vertical-align:middle;margin-right:8px"></span><span style="vertical-align:middle">${esc(o.product)}</span>
    </td>
  </tr></table>
</td></tr>
<tr><td class="gio-pad" style="padding:38px 40px 34px">
  <p style="margin:0 0 14px;${F};font-weight:600;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6F3FF5">${esc(o.eyebrow)}</p>
  <h1 class="gio-headline" style="margin:0 0 16px;${P};font-weight:600;font-size:30px;line-height:1.12;letter-spacing:-.035em;color:#0d0d09">${esc(o.title)}<span style="color:#D7C5FB">.</span></h1>
  <p style="margin:0 0 24px;${F};font-size:14.5px;line-height:1.62;color:#5A6072">${o.lead}</p>
  ${o.card ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #E7E8EE;border-radius:16px;box-shadow:0 4px 14px -6px rgba(13,13,9,.06);margin:0 0 28px"><tr><td style="padding:18px">${o.card}</td></tr></table>` : ""}
  ${o.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px"><tr><td bgcolor="#0d0d09" style="border-radius:12px;box-shadow:0 6px 16px -6px rgba(13,13,9,.35)"><a href="${esc(o.cta.url)}" style="display:inline-block;padding:14px 26px;${P};font-weight:600;font-size:15px;color:#fffcf9;text-decoration:none;line-height:20px">${esc(o.cta.label)}&nbsp;&nbsp;&rarr;</a></td></tr></table>` : ""}
  ${o.note ? `<p style="margin:0;${F};font-size:12px;line-height:1.5;color:#6B7080">${o.note}</p>` : ""}
</td></tr>
<tr><td class="gio-pad" bgcolor="#FBFAF7" style="padding:20px 40px 28px;background:#FBFAF7;border-top:1px solid #F1F0EC">
  <p style="margin:0 0 12px;padding-bottom:12px;border-bottom:1px solid #F1F0EC;${F};font-size:11.5px;line-height:1.55;color:#6B7080">${esc(o.why)}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="left" style="${P};font-weight:600;font-size:13px;color:#5A6072;letter-spacing:-.02em">Gio ATS<span style="${F};font-weight:400;font-size:11.5px;color:#6B7080;margin-left:6px">&middot; Modern recruiting</span></td>
    <td align="right" style="${F};font-size:11.5px;color:#6B7080">Need help? <a href="mailto:${support}" style="color:#6F3FF5;text-decoration:none;font-weight:600">${support}</a></td>
  </tr></table>
</td></tr>
</table></td></tr></table></body></html>`;
}
