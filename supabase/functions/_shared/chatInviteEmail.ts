// Gio-branded candidate chat-invite email template.
//
// Renders a warm, on-brand HTML email (plus a plain-text alternative) that
// invites a candidate to open their private chat with the hiring team.
// All personalization goes through `{{placeholder}}` merge tokens so the
// same template can be reused wherever the invite is sent from.

export interface ChatInviteMergeVars {
  recruiter_first_name: string;
  recruiter_full_name: string;
  recruiter_title: string;
  recruiter_initials: string; // e.g. "MR"
  recruiter_color: string;    // hex, e.g. "#6F3FF5"
  recruiter_avatar?: string | null; // optional photo URL
  candidate_first_name: string;
  job_title: string;
  recruiter_message: string;
  chat_url: string;
  link_expiry: string;        // e.g. "14 days"
  support_email?: string;     // defaults to support@gogio.com
}

export interface RenderedChatInviteEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

const SUBJECT_TEMPLATE =
  "{{recruiter_first_name}} from the hiring team wants to chat";
const PREHEADER_TEMPLATE =
  "You've got a private chat about {{job_title}} — open it anytime.";

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

/**
 * Build the personalised chat-invite email.
 * Every value is HTML-escaped before it lands in the template — safe to pass
 * arbitrary strings (recruiter messages, job titles, names).
 */
export function renderChatInviteEmail(
  vars: ChatInviteMergeVars,
): RenderedChatInviteEmail {
  const safe: Record<string, string> = {
    recruiter_first_name: escapeHtml(vars.recruiter_first_name),
    recruiter_full_name: escapeHtml(vars.recruiter_full_name),
    recruiter_title: escapeHtml(vars.recruiter_title),
    recruiter_initials: escapeHtml(vars.recruiter_initials),
    recruiter_color: escapeHtml(vars.recruiter_color),
    candidate_first_name: escapeHtml(vars.candidate_first_name),
    job_title: escapeHtml(vars.job_title),
    recruiter_message: escapeHtml(vars.recruiter_message).replace(
      /\n/g,
      "<br />",
    ),
    chat_url: encodeURI(vars.chat_url),
    chat_url_text: escapeHtml(vars.chat_url),
    link_expiry: escapeHtml(vars.link_expiry),
    support_email: escapeHtml(vars.support_email ?? "support@gogio.com"),
  };

  const avatarBlock = vars.recruiter_avatar
    ? `<img src="${encodeURI(vars.recruiter_avatar)}" width="40" height="40" alt="${safe.recruiter_full_name}" style="display:block;border-radius:9999px;object-fit:cover;border:0;outline:none;text-decoration:none;" />`
    : `<div style="width:40px;height:40px;border-radius:9999px;background:${safe.recruiter_color};color:#fffcf9;font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:14px;line-height:40px;text-align:center;letter-spacing:-0.01em;">${safe.recruiter_initials}</div>`;

  const subject = merge(SUBJECT_TEMPLATE, safe);
  const preheader = merge(PREHEADER_TEMPLATE, safe);

  const html = merge(BODY_TEMPLATE, { ...safe, avatar_block: avatarBlock });
  const text = merge(TEXT_TEMPLATE, safe);

  return { subject, preheader, html, text };
}

// ---------------------------------------------------------------------------
// HTML template — table-based, inline styles, email-client safe.
// Uses {{merge}} tokens so the same string is truly template-driven.
// ---------------------------------------------------------------------------

const BODY_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>{{recruiter_first_name}} from the hiring team wants to chat</title>
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
    <div style="display:none;font-size:1px;color:#ECEAE2;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">You've got a private chat about {{job_title}} — open it anytime.</div>
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
                    <td align="right" valign="middle" class="gio-mast-right" style="font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:17px;color:#0d0d09;letter-spacing:-0.02em;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;">
                        <tr>
                          <td valign="middle" style="padding-right:8px;">
                            <span style="display:inline-block;width:22px;height:22px;background:#0d0d09;border-radius:11px 11px 11px 4px;position:relative;vertical-align:middle;"></span><span style="display:inline-block;width:6px;height:6px;background:#6F3FF5;border-radius:9999px;vertical-align:middle;margin-left:-6px;margin-bottom:-10px;"></span>
                          </td>
                          <td valign="middle">Chat</td>
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
                <p style="margin:0 0 14px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-weight:600;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6F3FF5;">A message is waiting for you</p>
                <h1 class="gio-headline" style="margin:0 0 18px;font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:30px;line-height:1.12;letter-spacing:-0.035em;color:#0d0d09;">
                  {{recruiter_first_name}} from the hiring team<br />wants to chat<span style="color:#D7C5FB;">.</span>
                </h1>
                <p style="margin:0 0 24px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:14.5px;line-height:1.62;color:#5A6072;">
                  Hi <strong style="color:#1F2230;font-weight:600;">{{candidate_first_name}}</strong> — thanks for applying to <strong style="color:#1F2230;font-weight:600;">{{job_title}}</strong>. We've opened a private chat so you can ask questions, share your availability, and hear back from the team, all in one place.
                </p>

                <!-- PREVIEW CARD -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #E7E8EE;border-radius:16px;box-shadow:0 4px 14px -6px rgba(13,13,9,0.06);margin:0 0 28px;">
                  <tr>
                    <td style="padding:18px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="52" valign="middle" style="width:52px;">{{avatar_block}}</td>
                          <td valign="middle" style="font-family:'Poppins','Helvetica Neue',Arial,sans-serif;">
                            <div style="font-weight:600;font-size:13.5px;color:#0d0d09;letter-spacing:-0.01em;line-height:1.2;">{{recruiter_full_name}}</div>
                            <div style="font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-weight:400;font-size:11.5px;color:#8B8F9E;margin-top:2px;">{{recruiter_title}}</div>
                          </td>
                          <td align="right" valign="middle" style="white-space:nowrap;">
                            <span style="display:inline-block;background:#E3F6EE;color:#0F8A5B;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:600;padding:5px 10px 5px 8px;border-radius:9999px;line-height:1;">
                              <span style="display:inline-block;width:6px;height:6px;background:#12B886;border-radius:9999px;vertical-align:middle;margin-right:6px;"></span>Online
                            </span>
                          </td>
                        </tr>
                      </table>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
                        <tr>
                          <td style="background:#F1F0EC;border-radius:14px 14px 14px 5px;padding:12px 15px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:13.5px;line-height:1.5;color:#1F2230;">
                            {{recruiter_message}}
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
                      <a href="{{chat_url}}" style="display:inline-block;padding:14px 26px;font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:15px;color:#fffcf9;text-decoration:none;line-height:20px;letter-spacing:-0.005em;">
                        Open the chat&nbsp;&nbsp;→
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:12px;color:#8B8F9E;line-height:1.5;">
                  <span style="display:inline-block;vertical-align:middle;margin-right:6px;">🔒</span>Your private link is secure and valid for <strong style="color:#5A6072;font-weight:600;">{{link_expiry}}</strong>.
                </p>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td class="gio-pad-40" bgcolor="#FBFAF7" style="padding:22px 40px 30px;background:#FBFAF7;border-top:1px solid #F1F0EC;">
                <p style="margin:0 0 12px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:11.5px;color:#8B8F9E;line-height:1.5;">
                  If you didn't apply for this role, you can safely ignore this email.
                </p>
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

const TEXT_TEMPLATE = `{{recruiter_first_name}} from the hiring team wants to chat.

Hi {{candidate_first_name}} — thanks for applying to {{job_title}}.

We've opened a private chat so you can ask questions, share your availability, and hear back from the team, all in one place.

{{recruiter_full_name}} ({{recruiter_title}}) says:
"{{recruiter_message}}"

Open the chat:
{{chat_url_text}}

Your private link is secure and valid for {{link_expiry}}.

If you didn't apply for this role, you can safely ignore this email.
Need help? {{support_email}}
`;

// ---------------------------------------------------------------------------
// Helpers for the send-site — keep initials/color deterministic so the same
// recruiter always gets the same avatar tint across emails.
// ---------------------------------------------------------------------------

const AVATAR_PALETTE = [
  "#6F3FF5", // purple
  "#12B886", // teal
  "#E8590C", // orange
  "#1C7ED6", // blue
  "#D6336C", // pink
  "#4C6EF5", // indigo
  "#F59F00", // amber
  "#0CA678", // green
];

export function initialsFor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}
