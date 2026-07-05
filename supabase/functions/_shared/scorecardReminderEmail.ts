// Gio-branded scorecard reminder email — mirrors the candidate chat-invite
// shell (560px cream card, gio wordmark masthead, purple eyebrow, big
// headline with lilac period, white preview card, citron-noir CTA, gio
// footer). Sent to an interviewer who still owes a scorecard.
//
// Used by BOTH:
//   - supabase/functions/send-scorecard-reminders  (automatic cadence loop)
//   - supabase/functions/request-scorecard         (manual "Request" action)

export type ScorecardCadence = "daily" | "every_2_days" | "weekly";

export interface ScorecardReminderMergeVars {
  interviewer_first_name: string;
  candidate_first_name: string;
  candidate_full_name: string;
  candidate_initials: string;
  candidate_color: string;   // deterministic per candidate
  job_title: string;
  stage_name: string;
  interviewed_when: string;  // e.g. "Mar 14" or "Recently"
  submitted_count: number;
  total_count: number;
  cadence: ScorecardCadence;
  scorecard_url: string;
  support_email?: string;
}

export interface RenderedScorecardReminderEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

const CADENCE_LABEL: Record<ScorecardCadence, string> = {
  daily: "daily",
  every_2_days: "every 2 days",
  weekly: "weekly",
};

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function merge(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    key in vars ? vars[key] : `{{${key}}}`,
  );
}

const AVATAR_PALETTE = [
  "#6F3FF5", "#12B886", "#E8590C", "#1C7ED6",
  "#D6336C", "#4C6EF5", "#F59F00", "#0CA678",
];

export function initialsFor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}

export function renderScorecardReminderEmail(
  vars: ScorecardReminderMergeVars,
): RenderedScorecardReminderEmail {
  const cadenceWord = CADENCE_LABEL[vars.cadence] ?? "daily";
  const safe: Record<string, string> = {
    interviewer_first_name: escapeHtml(vars.interviewer_first_name || "there"),
    candidate_first_name: escapeHtml(vars.candidate_first_name || "the candidate"),
    candidate_full_name: escapeHtml(vars.candidate_full_name || vars.candidate_first_name || "Candidate"),
    candidate_initials: escapeHtml(vars.candidate_initials || "?"),
    candidate_color: escapeHtml(vars.candidate_color || "#6F3FF5"),
    job_title: escapeHtml(vars.job_title || "this role"),
    stage_name: escapeHtml(vars.stage_name || "this stage"),
    interviewed_when: escapeHtml(vars.interviewed_when || "Recently"),
    submitted_count: String(vars.submitted_count ?? 0),
    total_count: String(vars.total_count ?? 0),
    cadence_word: escapeHtml(cadenceWord),
    scorecard_url: encodeURI(vars.scorecard_url),
    scorecard_url_text: escapeHtml(vars.scorecard_url),
    support_email: escapeHtml(vars.support_email ?? "support@gogio.com"),
  };

  const avatarBlock = `<div style="width:40px;height:40px;border-radius:9999px;background:${safe.candidate_color};color:#fffcf9;font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:14px;line-height:40px;text-align:center;letter-spacing:-0.01em;">${safe.candidate_initials}</div>`;

  const subject = `Scorecard needed for ${vars.candidate_full_name || vars.candidate_first_name || "your candidate"} · ${vars.stage_name || "interview"}`;
  const preheader = `Your feedback on ${vars.candidate_first_name || "the candidate"} is holding up the pipeline.`;

  const html = merge(BODY_TEMPLATE, {
    ...safe,
    avatar_block: avatarBlock,
    subject: escapeHtml(subject),
    preheader: escapeHtml(preheader),
  });
  const text = merge(TEXT_TEMPLATE, safe);

  return { subject, preheader, html, text };
}

const BODY_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>{{subject}}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600;700&display=swap" rel="stylesheet" />
    <style>
      @media only screen and (max-width: 600px) {
        .gio-card { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
        .gio-pad-40 { padding-left: 24px !important; padding-right: 24px !important; }
        .gio-headline { font-size: 26px !important; line-height: 1.15 !important; }
        .gio-mast-right { text-align: right !important; }
      }
      @media (prefers-color-scheme: dark) {
        body, .gio-desk { background: #ECEAE2 !important; }
      }
      a { color: #6F3FF5; }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#ECEAE2;-webkit-text-size-adjust:100%;">
    <div style="display:none;font-size:1px;color:#ECEAE2;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">{{preheader}}</div>
    <table role="presentation" class="gio-desk" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ECEAE2" style="background:#ECEAE2;">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" class="gio-card" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#fffcf9;border-radius:20px;box-shadow:0 12px 32px -8px rgba(13,13,9,0.08);overflow:hidden;">
            <!-- MASTHEAD -->
            <tr>
              <td class="gio-pad-40" style="padding:28px 40px;border-bottom:1px solid #F1F0EC;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="left" valign="middle" style="font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:22px;letter-spacing:-0.04em;color:#0d0d09;line-height:1;">
                      <span style="display:inline-block;vertical-align:middle;">gio</span><span style="display:inline-block;vertical-align:middle;width:6px;height:6px;background:#6F3FF5;border-radius:9999px;margin-left:4px;"></span>
                    </td>
                    <td align="right" valign="middle" class="gio-mast-right" style="font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:17px;color:#1F2230;letter-spacing:-0.02em;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;">
                        <tr>
                          <td valign="middle" style="padding-right:8px;">
                            <span style="display:inline-block;width:26px;height:26px;background:#EDE4FF;border-radius:8px;text-align:center;line-height:26px;vertical-align:middle;">
                              <span style="display:inline-block;vertical-align:middle;color:#6F3FF5;font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:14px;line-height:26px;">✓</span>
                            </span>
                          </td>
                          <td valign="middle">Scorecards</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td class="gio-pad-40" style="padding:38px 40px 34px;">
                <p style="margin:0 0 14px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-weight:600;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6F3FF5;">Your scorecard is needed</p>
                <h1 class="gio-headline" style="margin:0 0 18px;font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:30px;line-height:1.12;letter-spacing:-0.035em;color:#0d0d09;">
                  Your feedback on {{candidate_full_name}} is holding up the pipeline<span style="color:#D7C5FB;">.</span>
                </h1>
                <p style="margin:0 0 24px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:14.5px;line-height:1.62;color:#5A6072;">
                  Hi <strong style="color:#1F2230;font-weight:600;">{{interviewer_first_name}}</strong> — you interviewed <strong style="color:#1F2230;font-weight:600;">{{candidate_full_name}}</strong> for <strong style="color:#1F2230;font-weight:600;">{{job_title}}</strong>, and a scorecard is required for the <strong style="color:#1F2230;font-weight:600;">{{stage_name}}</strong> stage before {{candidate_first_name}} can advance. It only takes a couple of minutes.
                </p>

                <!-- PREVIEW CARD -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #E7E8EE;border-radius:16px;box-shadow:0 4px 14px -6px rgba(13,13,9,0.06);margin:0 0 28px;">
                  <tr>
                    <td style="padding:18px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="52" valign="middle" style="width:52px;">{{avatar_block}}</td>
                          <td valign="middle" style="font-family:'Poppins','Helvetica Neue',Arial,sans-serif;">
                            <div style="font-weight:600;font-size:13.5px;color:#0d0d09;letter-spacing:-0.01em;line-height:1.2;">{{candidate_full_name}}</div>
                            <div style="font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-weight:400;font-size:11.5px;color:#8B8F9E;margin-top:2px;">{{job_title}} · {{stage_name}}</div>
                          </td>
                          <td align="right" valign="middle" style="white-space:nowrap;">
                            <span style="display:inline-block;background:#FEF3C7;color:#B45309;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:600;padding:5px 10px 5px 8px;border-radius:9999px;line-height:1;">
                              <span style="display:inline-block;width:6px;height:6px;background:#F59E0B;border-radius:9999px;vertical-align:middle;margin-right:6px;"></span>Awaiting your scorecard
                            </span>
                          </td>
                        </tr>
                      </table>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
                        <tr>
                          <td width="50%" valign="top" style="padding-right:6px;">
                            <div style="background:#F1F0EC;border-radius:10px;padding:12px 14px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;">
                              <div style="font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#8B8F9E;line-height:1;">Interviewed</div>
                              <div style="margin-top:6px;font-size:12.5px;font-weight:500;color:#1F2230;line-height:1.2;">{{interviewed_when}}</div>
                            </div>
                          </td>
                          <td width="50%" valign="top" style="padding-left:6px;">
                            <div style="background:#F1F0EC;border-radius:10px;padding:12px 14px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;">
                              <div style="font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#8B8F9E;line-height:1;">Scorecards in</div>
                              <div style="margin-top:6px;font-size:12.5px;font-weight:500;color:#1F2230;line-height:1.2;">{{submitted_count}} of {{total_count}} submitted</div>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- CTA -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
                  <tr>
                    <td bgcolor="#0d0d09" style="border-radius:12px;box-shadow:0 6px 16px -6px rgba(13,13,9,0.35);">
                      <a href="{{scorecard_url}}" style="display:inline-block;padding:14px 26px;font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:15px;color:#fffcf9;text-decoration:none;line-height:20px;letter-spacing:-0.005em;">
                        Submit scorecard&nbsp;&nbsp;→
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 10px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:12px;color:#8B8F9E;line-height:1.5;">
                  <span style="display:inline-block;vertical-align:middle;margin-right:6px;">⏱</span>We'll send a <strong style="color:#5A6072;font-weight:600;">{{cadence_word}}</strong> reminder until your scorecard is in.
                </p>
                <p style="margin:0;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:11.5px;color:#8B8F9E;line-height:1.5;">
                  Already submitted? You can ignore this — reminders stop automatically once your scorecard is received.
                </p>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td class="gio-pad-40" bgcolor="#FBFAF7" style="padding:22px 40px 30px;background:#FBFAF7;border-top:1px solid #F1F0EC;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="left" style="font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:13px;color:#5A6072;letter-spacing:-0.02em;">
                      <span style="vertical-align:middle;">gio</span><span style="display:inline-block;vertical-align:middle;width:4px;height:4px;background:#6F3FF5;border-radius:9999px;margin-left:3px;"></span>
                      <span style="font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-weight:400;font-size:11.5px;color:#8B8F9E;margin-left:6px;">· Modern recruiting</span>
                    </td>
                    <td align="right" style="font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:11.5px;color:#8B8F9E;">
                      Need help? <a href="mailto:{{support_email}}" style="color:#6F3FF5;text-decoration:none;font-weight:600;">{{support_email}}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const TEXT_TEMPLATE = `Your feedback on {{candidate_first_name}} is holding up the pipeline.

Hi {{interviewer_first_name}} — you interviewed {{candidate_full_name}} for {{job_title}}, and a scorecard is required for the {{stage_name}} stage before they can advance. It only takes a couple of minutes.

Interviewed: {{interviewed_when}}
Scorecards in: {{submitted_count}} of {{total_count}} submitted

Submit your scorecard:
{{scorecard_url_text}}

We'll send a {{cadence_word}} reminder until your scorecard is in.
Already submitted? You can ignore this — reminders stop automatically once your scorecard is received.

Need help? {{support_email}}
`;

/** Concise "Mar 14" / "today" / "yesterday" for the Interviewed tile. */
export function formatInterviewedWhen(iso: string | null | undefined): string {
  if (!iso) return "Recently";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Recently";
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
