// Email 04 · Candidate — reference request.
//
// A transactional email, engineered for Outlook/Gmail/Apple Mail: nested
// presentation tables, all layout CSS inline, no web fonts, no images, no
// inline SVG, one <style> block for media queries only.
//
// The masthead carries the AGENCY's brand — the candidate has no Gio account
// and has never heard of Gio, so an unfamiliar logo above the fold reads as
// phishing. Gio appears exactly once, in the footer.

import { resolveStrict, type AgencyBrand, type RenderedEmail } from "./referenceEmail.ts";

const BACKDROP = "#ECEAE2";
const CARD = "#fffcf9";
const FOOTER_BAND = "#FBFAF7";
const HAIRLINE = "#E7E8EE";
const HAIRLINE_SOFT = "#F1F0EC";
const INK = "#0d0d09";
const TEXT = "#1F2230";
const MUTED = "#5A6072";
const TERTIARY = "#8B8F9E";
const PURPLE = "#6F3FF5";
const LILAC = "#D7C5FB";
const LILAC_FILL = "#EDE4FF";
const LILAC_DEEP = "#5B21B6";
const GREEN = "#12B886";
const AMBER = "#B45309";

const POPPINS =
  "'Poppins','Segoe UI',-apple-system,Roboto,Helvetica,Arial,sans-serif";
const INTER = "'Inter',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six"];

export function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

function esc(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "3 Sep" — the short form the security line and reminders use. */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  // en-GB renders "Sept" for September — the design calls for a 3-letter month.
  const month = d
    .toLocaleString("en-GB", { month: "short", timeZone: "UTC" })
    .replace(".", "")
    .slice(0, 3);
  return `${d.getUTCDate()} ${month}`;
}

function initialsOf(name: string): string {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export interface RelationshipRuleLike {
  count?: number;
  relationship?: string;
  enforced?: boolean;
}

export interface CandidateReferenceEmailInput {
  brand: AgencyBrand;
  subjectTemplate: string;
  /** Snapshot body copy. Used for the body paragraph when present. */
  bodyTemplate?: string | null;
  secureLink: string;
  candidateFirstName: string;
  jobTitle: string;
  clientName?: string | null;
  refereeCount: number;
  recruiterName: string;
  recruiterTitle?: string | null;
  agencyName: string;
  expiryIso: string;
  expiryDays: number;
  relationshipRules?: RelationshipRuleLike[];
  /** Reminder sends prefix the subject and add the expiry nudge above the CTA. */
  isReminder?: boolean;
  daysRemaining?: number | null;
}

/** Masthead brand lockup. No placeholder box or monogram when there is no logo. */
function masthead(brand: AgencyBrand): string {
  const left = brand.logoUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;"><img src="${esc(brand.logoUrl)}" alt="${esc(brand.name)}" height="34" style="height:34px;width:auto;max-width:160px;display:block;border:0;" /></td>
        <td width="13" style="width:13px;">&nbsp;</td>
        <td width="1" bgcolor="${HAIRLINE}" style="width:1px;height:20px;background:${HAIRLINE};font-size:0;line-height:0;">&nbsp;</td>
        <td width="13" style="width:13px;">&nbsp;</td>
        <td style="vertical-align:middle;font-family:${POPPINS};font-size:18px;font-weight:600;letter-spacing:-0.025em;color:${INK};">${esc(brand.name)}</td>
      </tr></table>`
    : `<span class="brand" style="font-family:${POPPINS};font-size:24px;font-weight:700;letter-spacing:-0.035em;color:${INK};">${esc(brand.name)}</span>`;

  return `<tr><td class="pad" style="padding:28px 40px;border-bottom:1px solid ${HAIRLINE_SOFT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="left" style="vertical-align:middle;">${left}</td>
      <td class="kind" align="right" style="vertical-align:middle;white-space:nowrap;font-family:${INTER};font-size:12px;color:${TERTIARY};">
        <span style="color:${GREEN};font-size:13px;">&#10003;</span>&nbsp;Secure link
      </td>
    </tr></table>
  </td></tr>`;
}

function requirementRow(icon: string, title: string, body: string, first: boolean): string {
  return `<tr><td style="padding-top:${first ? 0 : 12}px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="26" bgcolor="${HAIRLINE_SOFT}" align="center" style="width:26px;height:26px;background:${HAIRLINE_SOFT};border-radius:7px;vertical-align:top;font-family:${INTER};font-size:13px;color:${MUTED};line-height:26px;">${icon}</td>
      <td style="padding-left:11px;">
        <div style="font-family:${POPPINS};font-size:13px;font-weight:600;letter-spacing:-0.01em;color:${TEXT};">${esc(title)}</div>
        <div style="font-family:${INTER};font-size:12px;line-height:1.45;color:${TERTIARY};padding-top:2px;">${esc(body)}</div>
      </td>
    </tr></table>
  </td></tr>`;
}

/**
 * Render the candidate reference-request email. Copy is resolved strictly from
 * the caller's snapshot values — an unresolved placeholder throws so the send
 * aborts rather than putting `{{token}}` in somebody's inbox.
 */
export function renderCandidateReferenceEmail(
  input: CandidateReferenceEmailInput,
): RenderedEmail {
  const {
    brand,
    secureLink,
    candidateFirstName,
    jobTitle,
    clientName,
    refereeCount,
    recruiterName,
    recruiterTitle,
    agencyName,
    expiryIso,
    expiryDays,
    relationshipRules = [],
    isReminder = false,
    daysRemaining = null,
  } = input;

  const countWordValue = countWord(refereeCount);
  const expiryDate = formatShortDate(expiryIso);

  const vars: Record<string, string> = {
    candidate_first_name: candidateFirstName,
    candidate_name: candidateFirstName,
    job_title: jobTitle,
    client_name: clientName || agencyName,
    company_name: clientName || agencyName,
    agency_name: agencyName,
    referee_count: String(refereeCount),
    referee_count_word: countWordValue,
    recruiter_name: recruiterName,
    expiry_date: expiryDate,
    expiry_days: String(expiryDays),
    secure_link: secureLink,
  };

  const baseSubject = resolveStrict(input.subjectTemplate, vars).trim();
  const subject = isReminder ? `Reminder: ${baseSubject}` : baseSubject;

  const strong = (s: string) =>
    `<span style="color:${TEXT};font-weight:600;">${esc(s)}</span>`;

  // The body paragraph carries three load-bearing facts: where the candidate is
  // in the process, that referees never see each other, and that the candidate
  // never sees the answers.
  const bodyParagraph = clientName
    ? `You're at the final stage for ${strong(jobTitle)} at ${strong(clientName)}. Add your referees and we'll email each of them their own short questionnaire — they never see each other, and you never see their answers.`
    : `You're at the final stage for ${strong(jobTitle)}. Add your referees and we'll email each of them their own short questionnaire — they never see each other, and you never see their answers.`;

  const eyebrow = clientName ? `${clientName} · ${jobTitle}` : jobTitle;

  const headlineCount =
    refereeCount === 1 ? "one reference" : `${countWordValue} references`;

  const enforced = relationshipRules.filter((r) => r.enforced && r.relationship);
  const relationshipRows = enforced.map((r) =>
    requirementRow(
      "&#10003;",
      `${countWord(r.count || 1).replace(/^./, (c) => c.toUpperCase())} ${String(
        r.relationship,
      ).toLowerCase()}`,
      `At least ${countWord(r.count || 1)} referee who ${
        String(r.relationship).toLowerCase().includes("manager")
          ? "managed you"
          : `worked with you as a ${String(r.relationship).toLowerCase()}`
      }`,
      false,
    ),
  );

  const rows =
    requirementRow(
      "&#9679;&#9679;",
      `${countWordValue.replace(/^./, (c) => c.toUpperCase())} referee${refereeCount === 1 ? "" : "s"}`,
      "Name, work email and how you worked together",
      true,
    ) +
    relationshipRows.join("") +
    requirementRow(
      "&#10073;&#10073;",
      "Hold anyone you need to",
      "Flag a current employer and we won't contact them",
      false,
    );

  const reminderNudge =
    isReminder && daysRemaining !== null && daysRemaining >= 0
      ? `<div style="font-family:${INTER};font-size:12px;color:${AMBER};padding-bottom:12px;">Your link expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.</div>`
      : "";

  const preheader =
    "Add your referees — we'll email each of them a short questionnaire. Nobody is contacted until you submit.";

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(subject)}</title>
<style>
@media only screen and (max-width:600px){
  .card{width:100% !important;border-radius:0 !important;border-left:none !important;border-right:none !important;}
  .pad{padding-left:22px !important;padding-right:22px !important;}
  .h1{font-size:25px !important;}
  .cta{display:block !important;width:100% !important;}
  .stack{display:block !important;width:100% !important;}
  .brand{font-size:21px !important;}
  .kind{display:none !important;}
}
</style>
</head>
<body style="margin:0;padding:0;background:${BACKDROP};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</div>
<div style="display:none;white-space:nowrap;font:15px courier;line-height:0;">&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BACKDROP}" style="background:${BACKDROP};">
<tr><td align="center" style="padding:40px 0;">

<table role="presentation" class="card" width="560" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${CARD}" style="width:560px;max-width:560px;background:${CARD};border:1px solid ${HAIRLINE};border-radius:20px;box-shadow:0 12px 40px rgba(15,18,34,0.12);">

${masthead(brand)}

<tr><td class="pad" style="padding:38px 40px 34px;">

  <div style="font-family:${INTER};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${PURPLE};padding-bottom:14px;">${esc(eyebrow)}</div>

  <h1 class="h1" style="margin:0;font-family:${POPPINS};font-size:30px;font-weight:600;line-height:1.12;letter-spacing:-0.035em;color:${INK};">${esc(candidateFirstName)} — we need<br />${esc(headlineCount)}<span style="color:${LILAC};">.</span></h1>

  <p style="margin:0;padding-top:16px;font-family:${INTER};font-size:14.5px;line-height:1.62;color:${MUTED};">${bodyParagraph}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:26px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background:#FFFFFF;border:1px solid ${HAIRLINE};border-radius:16px;box-shadow:0 1px 2px rgba(13,13,9,0.03);">
      <tr><td style="padding:18px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="40" bgcolor="${PURPLE}" align="center" style="width:40px;height:40px;background:${PURPLE};border-radius:20px;text-align:center;vertical-align:middle;font-family:${POPPINS};font-size:15px;font-weight:600;color:#ffffff;line-height:40px;">${esc(initialsOf(recruiterName))}</td>
          <td class="stack" style="padding-left:11px;vertical-align:middle;">
            <div style="font-family:${POPPINS};font-size:13.5px;font-weight:600;letter-spacing:-0.01em;color:${INK};">${esc(recruiterName)}</div>
            <div style="font-family:${INTER};font-size:11.5px;color:${TERTIARY};padding-top:2px;">${esc([recruiterTitle, agencyName].filter(Boolean).join(" · "))}</div>
          </td>
          <td align="right" style="vertical-align:middle;">
            <span style="display:inline-block;background:${LILAC_FILL};color:${LILAC_DEEP};border-radius:999px;padding:3px 9px;font-family:${INTER};font-size:10.5px;font-weight:600;white-space:nowrap;">Is asking</span>
          </td>
        </tr></table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding-top:15px;"><div style="height:1px;background:${HAIRLINE_SOFT};font-size:0;line-height:0;">&nbsp;</div></td></tr>
          <tr><td style="padding-top:14px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
          </td></tr>
        </table>

      </td></tr>
    </table>
  </td></tr></table>

  ${reminderNudge}

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="cta">
    <tr>
      <td bgcolor="${INK}" style="border-radius:12px;background:${INK};" align="center">
        <a href="${esc(secureLink)}" style="display:inline-block;height:48px;line-height:48px;padding:0 26px;font-family:${POPPINS};font-size:15px;font-weight:600;color:${CARD};text-decoration:none;border-radius:12px;">Add your references&nbsp;&nbsp;&rarr;</a>
      </td>
    </tr>
  </table>

  <p style="margin:0;padding-top:15px;font-family:${INTER};font-size:12px;color:${TERTIARY};">&#128274; Your private link is secure and valid for ${expiryDays} days — until ${esc(expiryDate)}.</p>

  <p style="margin:0;padding-top:22px;font-family:${INTER};font-size:11.5px;line-height:1.5;color:${TERTIARY};">We'll ask you to confirm you have each person's permission before anyone is contacted.</p>

</td></tr>

<tr><td class="pad" bgcolor="${FOOTER_BAND}" style="padding:22px 40px 30px;background:${FOOTER_BAND};border-top:1px solid ${HAIRLINE_SOFT};">
  <p style="margin:0;font-family:${INTER};font-size:11.5px;line-height:1.55;color:${TERTIARY};">You're receiving this because you applied for a role through ${esc(agencyName)}. If this wasn't you, you can safely ignore this email — nobody is contacted until you submit.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:14px 0;">
    <div style="height:1px;background:${HAIRLINE_SOFT};font-size:0;line-height:0;">&nbsp;</div>
  </td></tr></table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="left" style="font-family:${INTER};font-size:11px;color:${TERTIARY};">Recruitment software by <span style="font-family:${POPPINS};font-size:12px;font-weight:600;color:${MUTED};">gio</span></td>
    <td align="right" style="white-space:nowrap;font-family:${INTER};font-size:11px;">
      <a href="https://app.gogio.io/privacy" style="color:${PURPLE};text-decoration:none;">Privacy</a>
      <span style="color:#D1D0CB;padding:0 10px;">&bull;</span>
      <a href="mailto:abuse@gogio.io?subject=Report%20this%20email" style="color:${TERTIARY};text-decoration:none;">Report this email</a>
    </td>
  </tr></table>
</td></tr>

</table>

</td></tr></table>
</body></html>`;

  const text = [
    `${candidateFirstName} — we need ${headlineCount}.`,
    "",
    clientName
      ? `You're at the final stage for ${jobTitle} at ${clientName}. Add your referees and we'll email each of them their own short questionnaire — they never see each other, and you never see their answers.`
      : `You're at the final stage for ${jobTitle}. Add your referees and we'll email each of them their own short questionnaire — they never see each other, and you never see their answers.`,
    "",
    `Add your references: ${secureLink}`,
    "",
    `Your private link is secure and valid for ${expiryDays} days — until ${expiryDate}.`,
    "We'll ask you to confirm you have each person's permission before anyone is contacted.",
    "",
    `You're receiving this because you applied for a role through ${agencyName}.`,
    "Recruitment software by gio",
  ].join("\n");

  return { subject, html, text };
}
