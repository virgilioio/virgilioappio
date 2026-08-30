// Email 05 · Referee — questionnaire request.
//
// The referee is the coldest recipient in the product: no account, no prior
// contact, volunteered by somebody else. So the masthead carries the AGENCY's
// brand (Gio appears once, in the footer), the body answers "why do you have my
// details?", and the decline path sits in the body above the footer.
//
// Engineered for Outlook/Gmail/Apple Mail: nested presentation tables, all
// layout CSS inline, no web fonts, no layout-critical images, no inline SVG,
// one <style> block for media queries only.

import { resolveStrict, type AgencyBrand, type RenderedEmail } from "./referenceEmail.ts";

const BACKDROP = "#ECEAE2";
const CARD = "#fffcf9";
const FOOTER_BAND = "#FBFAF7";
const INNER_CARD = "#FFFFFF";
const TILE = "#F1F0EC";
const HAIRLINE = "#E7E8EE";
const HAIRLINE_SOFT = "#F1F0EC";
const INK = "#0d0d09";
const TEXT = "#1F2230";
const MUTED = "#5A6072";
const TERTIARY = "#8B8F9E";
const PURPLE = "#6F3FF5";
const LILAC = "#D7C5FB";
const GREEN = "#12B886";
const AMBER_BG = "#FEF3C7";
const AMBER_FG = "#B45309";

const POPPINS =
  "'Poppins','Segoe UI',-apple-system,Roboto,Helvetica,Arial,sans-serif";
const INTER = "'Inter',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initialsOf(name: string): string {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** First token of a name, or null when there isn't one to use. */
export function firstNameOf(name?: string | null): string | null {
  const first = String(name ?? "").trim().split(/\s+/)[0];
  return first ? first : null;
}

export interface RefereeReferenceEmailInput {
  brand: AgencyBrand;
  /** Snapshot subject line — resolved strictly. */
  subjectTemplate: string;
  /** This referee's own token URL. Never shared between referees. */
  secureLink: string;
  /** Decline route for this same token. */
  declineLink: string;
  refereeName: string;
  candidateName: string;
  candidateFirstName: string;
  jobTitle: string;
  clientName?: string | null;
  recruiterName: string;
  agencyName: string;
  /** Candidate-entered, shown so the referee can correct it on the form. */
  refereeRelationship?: string | null;
  refereePeriod?: string | null;
  /** Computed from the visible question count — never hardcoded. */
  estimatedMinutes: number;
  expiryDays: number;
  /** From the snapshot's retention setting. Omitted when absent. */
  retentionMonths?: number | null;
  isReminder?: boolean;
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

function tile(label: string, value: string, side: "left" | "right"): string {
  const pad = side === "left" ? "padding-right:5px;" : "padding-left:5px;";
  return `<td class="stack" width="50%" style="width:50%;${pad}vertical-align:top;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${TILE}" style="width:100%;background:${TILE};border-radius:12px;">
      <tr><td style="padding:11px 13px;">
        <div style="font-family:${INTER};font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:${TERTIARY};">${esc(label)}</div>
        <div style="font-family:${INTER};font-size:12.5px;font-weight:500;color:${TEXT};padding-top:3px;">${esc(value)}</div>
      </td></tr>
    </table>
  </td>`;
}

function fullTile(label: string, value: string): string {
  return `<td class="stack" width="100%" style="width:100%;vertical-align:top;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${TILE}" style="width:100%;background:${TILE};border-radius:12px;">
      <tr><td style="padding:11px 13px;">
        <div style="font-family:${INTER};font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:${TERTIARY};">${esc(label)}</div>
        <div style="font-family:${INTER};font-size:12.5px;font-weight:500;color:${TEXT};padding-top:3px;">${esc(value)}</div>
      </td></tr>
    </table>
  </td>`;
}

/**
 * Render the referee questionnaire-request email. Only the subject comes from
 * the snapshot copy; the layout is fixed. An unresolved placeholder throws so
 * the send aborts rather than putting `{{token}}` in a stranger's inbox.
 */
export function renderRefereeReferenceEmail(
  input: RefereeReferenceEmailInput,
): RenderedEmail {
  const {
    brand,
    secureLink,
    declineLink,
    refereeName,
    candidateName,
    candidateFirstName,
    jobTitle,
    clientName,
    recruiterName,
    agencyName,
    refereeRelationship,
    refereePeriod,
    estimatedMinutes,
    expiryDays,
    retentionMonths,
    isReminder = false,
  } = input;

  const refereeFirstName = firstNameOf(refereeName);

  const vars: Record<string, string> = {
    agency_name: agencyName,
    candidate_name: candidateName,
    candidate_first_name: candidateFirstName,
    job_title: jobTitle,
    client_name: clientName || agencyName,
    company_name: clientName || agencyName,
    recruiter_name: recruiterName,
    referee_name: refereeName,
    // Only fed to the resolver when we actually have one — a missing first name
    // must fail loudly rather than ship "Hi ,".
    ...(refereeFirstName ? { referee_first_name: refereeFirstName } : {}),
    ...(refereeRelationship ? { referee_relationship: refereeRelationship } : {}),
    ...(refereePeriod ? { referee_period: refereePeriod } : {}),
    estimated_minutes: String(estimatedMinutes),
    expiry_days: String(expiryDays),
    secure_link: secureLink,
  };

  const baseSubject = resolveStrict(input.subjectTemplate, vars).trim();
  const subject = isReminder ? `Reminder: ${baseSubject}` : baseSubject;

  const strong = (s: string) =>
    `<span style="color:${TEXT};font-weight:600;">${esc(s)}</span>`;

  const salutation = refereeFirstName ? `Hi ${esc(refereeFirstName)} — ` : "";
  const applyingFor = clientName
    ? `is applying for a ${strong(jobTitle)} role with ${strong(clientName)}`
    : `is applying for a ${strong(jobTitle)} role`;

  const bodyParagraph =
    `${salutation}${esc(candidateFirstName)} ${applyingFor}, through ${esc(recruiterName)} at ${esc(agencyName)}. ` +
    `It takes about ${estimatedMinutes} minutes, and your answers go to the hiring team only — never to ${esc(candidateFirstName)}.`;

  // Two candidate-entered facts. A missing one drops its tile rather than
  // rendering an empty box or an em dash.
  const tiles: string[] = [];
  if (refereeRelationship && refereePeriod) {
    tiles.push(tile("Your relationship", refereeRelationship, "left"));
    tiles.push(tile("Worked together", refereePeriod, "right"));
  } else if (refereeRelationship) {
    tiles.push(fullTile("Your relationship", refereeRelationship));
  } else if (refereePeriod) {
    tiles.push(fullTile("Worked together", refereePeriod));
  }

  const tileBlock = tiles.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${tiles.join("")}</tr></table>
       <p style="margin:0;padding-top:11px;font-family:${INTER};font-size:11.5px;line-height:1.5;color:${TERTIARY};">As ${esc(candidateFirstName)} described it — you&rsquo;ll be able to correct this on the form.</p>`
    : "";

  const reminderNudge = isReminder
    ? `<div style="font-family:${INTER};font-size:12px;color:${AMBER_FG};padding-bottom:12px;">${esc(candidateFirstName)}&rsquo;s application is waiting on this — it takes about ${estimatedMinutes} minutes.</div>`
    : "";

  const retentionSentence =
    retentionMonths && retentionMonths > 0
      ? ` Your answers are kept for ${retentionMonths} months, then deleted — you can ask us to remove them at any time.`
      : "";

  const preheader = `About ${estimatedMinutes} minutes. Your answers go to the hiring team only — never to ${candidateFirstName}.`;

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
  .cta{width:100% !important;}
  .cta td{width:100% !important;}
  .cta a{display:block !important;padding:0 12px !important;}
  .stack{display:block !important;width:100% !important;padding-left:0 !important;padding-right:0 !important;padding-bottom:8px !important;}
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

  <div style="font-family:${INTER};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${PURPLE};padding-bottom:14px;">A reference has been requested</div>

  <h1 class="h1" style="margin:0;font-family:${POPPINS};font-size:30px;font-weight:600;line-height:1.12;letter-spacing:-0.035em;color:${INK};">${esc(candidateName)} listed you<br />as a reference<span style="color:${LILAC};">.</span></h1>

  <p style="margin:0;padding-top:16px;font-family:${INTER};font-size:14.5px;line-height:1.62;color:${MUTED};">${bodyParagraph}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:26px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${INNER_CARD}" style="background:${INNER_CARD};border:1px solid ${HAIRLINE};border-radius:16px;box-shadow:0 1px 2px rgba(13,13,9,0.03);">
      <tr><td style="padding:18px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="40" bgcolor="${PURPLE}" align="center" style="width:40px;height:40px;background:${PURPLE};border-radius:20px;text-align:center;vertical-align:middle;font-family:${POPPINS};font-size:15px;font-weight:600;color:#ffffff;line-height:40px;">${esc(initialsOf(candidateName))}</td>
          <td class="stack" style="padding-left:11px;vertical-align:middle;">
            <div style="font-family:${POPPINS};font-size:13.5px;font-weight:600;letter-spacing:-0.01em;color:${INK};">${esc(candidateName)}</div>
            <div style="font-family:${INTER};font-size:11.5px;color:${TERTIARY};padding-top:2px;">Applying for ${esc(jobTitle)}</div>
          </td>
          <td align="right" style="vertical-align:middle;">
            <span style="display:inline-block;background:${AMBER_BG};color:${AMBER_FG};border-radius:999px;padding:3px 9px;font-family:${INTER};font-size:10.5px;font-weight:600;white-space:nowrap;">${estimatedMinutes} min</span>
          </td>
        </tr></table>

        ${
          tileBlock
            ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-top:13px;">${tileBlock}</td></tr></table>`
            : ""
        }

      </td></tr>
    </table>
  </td></tr></table>

  ${reminderNudge}

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="cta" style="width:auto;">
    <tr>
      <td bgcolor="${INK}" style="border-radius:12px;background:${INK};" align="center">
        <a href="${esc(secureLink)}" style="display:inline-block;height:48px;line-height:48px;padding:0 26px;font-family:${POPPINS};font-size:15px;font-weight:600;color:${CARD};text-decoration:none;border-radius:12px;">Answer the reference&nbsp;&nbsp;&rarr;</a>
      </td>
    </tr>
  </table>

  <p style="margin:0;padding-top:15px;font-family:${INTER};font-size:12px;color:${TERTIARY};">&#128274; Your private link is secure and valid for ${expiryDays} days.</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding-top:22px;"><div style="height:1px;background:${HAIRLINE_SOFT};font-size:0;line-height:0;">&nbsp;</div></td></tr>
    <tr><td style="padding-top:18px;">
      <p style="margin:0;font-family:${INTER};font-size:12px;line-height:1.55;color:${MUTED};">Would rather not take part? <a href="${esc(declineLink)}" style="color:${TEXT};font-weight:600;text-decoration:underline;text-underline-offset:2px;">Decline this request</a> — it takes one click, and ${esc(candidateFirstName)} isn&rsquo;t told who declined.</p>
    </td></tr>
  </table>

</td></tr>

<tr><td class="pad" bgcolor="${FOOTER_BAND}" style="padding:22px 40px 30px;background:${FOOTER_BAND};border-top:1px solid ${HAIRLINE_SOFT};">
  <p style="margin:0;font-family:${INTER};font-size:11.5px;line-height:1.55;color:${TERTIARY};">${esc(candidateFirstName)} gave us your name and work email and confirmed they had your permission.${esc(retentionSentence)}</p>
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

  const plainBody = [
    refereeFirstName ? `Hi ${refereeFirstName} —` : null,
    clientName
      ? `${candidateFirstName} is applying for a ${jobTitle} role with ${clientName}, through ${recruiterName} at ${agencyName}.`
      : `${candidateFirstName} is applying for a ${jobTitle} role, through ${recruiterName} at ${agencyName}.`,
    `It takes about ${estimatedMinutes} minutes, and your answers go to the hiring team only — never to ${candidateFirstName}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const text = [
    `${candidateName} listed you as a reference.`,
    "",
    plainBody,
    refereeRelationship ? `Your relationship (as ${candidateFirstName} described it): ${refereeRelationship}` : null,
    refereePeriod ? `Worked together: ${refereePeriod}` : null,
    "",
    `Answer the reference: ${secureLink}`,
    "",
    `Your private link is secure and valid for ${expiryDays} days.`,
    `Would rather not take part? Decline here: ${declineLink} — ${candidateFirstName} isn't told who declined.`,
    "",
    `${candidateFirstName} gave us your name and work email and confirmed they had your permission.${retentionSentence}`,
    "Recruitment software by gio",
  ]
    .filter((l) => l !== null)
    .join("\n");

  return { subject, html, text };
}
