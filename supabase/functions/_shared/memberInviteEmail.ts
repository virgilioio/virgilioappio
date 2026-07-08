// Gio-branded member/workspace invitation email template.
//
// Sibling of `chatInviteEmail.ts` — same 560px cream card shell, masthead,
// preview card, CTA, and footer — but the module badge is "Members", the
// headline is "Join {Organization} on gio.", and the preview card shows the
// inviter + assigned org role + a 3-step "what's next" list.

export interface MemberInviteMergeVars {
  recipient_name: string;            // e.g. "jane" (email prefix fallback)
  organization_name: string;
  inviter_name: string;              // falls back to "a team member"
  inviter_title?: string;            // optional job title / role blurb
  inviter_initials: string;          // e.g. "MR"
  inviter_color: string;             // hex avatar tint
  inviter_avatar?: string | null;    // optional photo URL
  role_label: string;                // "Admin" | "Member" | "Sales" (already humanised)
  invite_url: string;                // full https://app.gogio.io/accept-invite/{token}
  expiry_date: string;               // pre-formatted, e.g. "Monday, July 15, 2026"
  support_email?: string;            // defaults to support@gogio.com
}

export interface RenderedMemberInviteEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

const SUBJECT_TEMPLATE =
  "You've been invited to join {{organization_name}} on GoGio";
const PREHEADER_TEMPLATE = "Join {{organization_name}} on GoGio";

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

export function renderMemberInviteEmail(
  vars: MemberInviteMergeVars,
): RenderedMemberInviteEmail {
  const inviterName = vars.inviter_name?.trim() || "a team member";
  const hasNamedInviter = Boolean(vars.inviter_name?.trim());
  const inviterTitle = vars.inviter_title?.trim() || vars.organization_name;

  const safe: Record<string, string> = {
    recipient_name: escapeHtml(vars.recipient_name),
    organization_name: escapeHtml(vars.organization_name),
    inviter_name: escapeHtml(inviterName),
    inviter_name_bold: hasNamedInviter
      ? `<strong style="color:#1F2230;font-weight:600;">${escapeHtml(inviterName)}</strong>`
      : escapeHtml(inviterName),
    inviter_title: escapeHtml(inviterTitle),
    inviter_initials: escapeHtml(vars.inviter_initials),
    inviter_color: escapeHtml(vars.inviter_color),
    role_label: escapeHtml(vars.role_label),
    invite_url: encodeURI(vars.invite_url),
    invite_url_text: escapeHtml(vars.invite_url),
    expiry_date: escapeHtml(vars.expiry_date),
    support_email: escapeHtml(vars.support_email ?? "support@gogio.com"),
  };

  const avatarBlock = vars.inviter_avatar
    ? `<img src="${encodeURI(vars.inviter_avatar)}" width="40" height="40" alt="${safe.inviter_name}" style="display:block;border-radius:9999px;object-fit:cover;border:0;outline:none;text-decoration:none;" />`
    : `<div style="width:40px;height:40px;border-radius:9999px;background:${safe.inviter_color};color:#fffcf9;font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:14px;line-height:40px;text-align:center;letter-spacing:-0.01em;">${safe.inviter_initials}</div>`;

  const subject = merge(SUBJECT_TEMPLATE, safe);
  const preheader = merge(PREHEADER_TEMPLATE, safe);
  const html = merge(BODY_TEMPLATE, { ...safe, avatar_block: avatarBlock });
  const text = merge(TEXT_TEMPLATE, safe);

  return { subject, preheader, html, text };
}

// ---------------------------------------------------------------------------
// HTML template — mirrors chatInviteEmail.ts shell.
// ---------------------------------------------------------------------------

const BODY_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>You've been invited to join {{organization_name}} on gio</title>
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
    <div style="display:none;font-size:1px;color:#ECEAE2;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Join {{organization_name}} on GoGio</div>
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
                            <span style="display:inline-block;width:26px;height:26px;background:#EDE4FF;border-radius:8px;text-align:center;line-height:26px;font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:15px;color:#6F3FF5;vertical-align:middle;">+</span>
                          </td>
                          <td valign="middle">Members</td>
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
                <p style="margin:0 0 14px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-weight:600;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6F3FF5;">You've been invited</p>
                <h1 class="gio-headline" style="margin:0 0 16px;font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:30px;line-height:1.12;letter-spacing:-0.035em;color:#0d0d09;">
                  Join {{organization_name}} on gio<span style="color:#D7C5FB;">.</span>
                </h1>
                <p style="margin:0 0 26px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:14.5px;line-height:1.62;color:#5A6072;">
                  Hi <strong style="color:#1F2230;font-weight:600;">{{recipient_name}}</strong> — {{inviter_name_bold}} invited you to join <strong style="color:#1F2230;font-weight:600;">{{organization_name}}</strong> on gio, a modern recruiting platform for teams who want to hire better, faster. Manage candidates, schedule interviews, and collaborate with your team — all in one place.
                </p>

                <!-- PREVIEW CARD -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #E7E8EE;border-radius:16px;box-shadow:0 4px 14px -6px rgba(13,13,9,0.06);margin:0 0 28px;">
                  <tr>
                    <td style="padding:18px;">
                      <!-- Header row -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #F1F0EC;padding-bottom:15px;">
                        <tr>
                          <td width="52" valign="middle" style="width:52px;padding-bottom:15px;">{{avatar_block}}</td>
                          <td valign="middle" style="font-family:'Poppins','Helvetica Neue',Arial,sans-serif;padding-bottom:15px;">
                            <div style="font-weight:600;font-size:13.5px;color:#0d0d09;letter-spacing:-0.01em;line-height:1.2;">{{inviter_name}}</div>
                            <div style="font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-weight:400;font-size:11.5px;color:#8B8F9E;margin-top:2px;">{{inviter_title}} · {{organization_name}}</div>
                          </td>
                          <td align="right" valign="middle" style="white-space:nowrap;padding-bottom:15px;">
                            <span style="display:inline-block;background:#EDE4FF;color:#6F3FF5;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:10.5px;font-weight:600;padding:3px 9px;border-radius:9999px;line-height:1.4;">
                              Role · {{role_label}}
                            </span>
                          </td>
                        </tr>
                      </table>

                      <!-- What's next -->
                      <p style="margin:15px 0 12px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-weight:600;font-size:10.5px;letter-spacing:0.07em;text-transform:uppercase;color:#8B8F9E;">What's next</p>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="30" valign="top" style="width:30px;padding-bottom:10px;">
                            <div style="width:22px;height:22px;border-radius:9999px;background:#EDE4FF;color:#6F3FF5;font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:11.5px;line-height:22px;text-align:center;">1</div>
                          </td>
                          <td valign="middle" style="padding-bottom:10px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.5;color:#1F2230;">
                            Accept your invitation with the button below
                          </td>
                        </tr>
                        <tr>
                          <td width="30" valign="top" style="width:30px;padding-bottom:10px;">
                            <div style="width:22px;height:22px;border-radius:9999px;background:#EDE4FF;color:#6F3FF5;font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:11.5px;line-height:22px;text-align:center;">2</div>
                          </td>
                          <td valign="middle" style="padding-bottom:10px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.5;color:#1F2230;">
                            Set up your account and profile
                          </td>
                        </tr>
                        <tr>
                          <td width="30" valign="top" style="width:30px;">
                            <div style="width:22px;height:22px;border-radius:9999px;background:#EDE4FF;color:#6F3FF5;font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:11.5px;line-height:22px;text-align:center;">3</div>
                          </td>
                          <td valign="middle" style="font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.5;color:#1F2230;">
                            Start collaborating with your team
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- CTA -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 15px;">
                  <tr>
                    <td bgcolor="#0d0d09" style="border-radius:12px;box-shadow:0 6px 16px -6px rgba(13,13,9,0.35);">
                      <a href="{{invite_url}}" style="display:inline-block;padding:15px 26px;font-family:'Poppins','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:15px;color:#fffcf9;text-decoration:none;line-height:20px;letter-spacing:-0.005em;">
                        Accept invitation&nbsp;&nbsp;→
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 22px;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:12px;color:#8B8F9E;line-height:1.5;">
                  <span style="display:inline-block;vertical-align:middle;margin-right:6px;">🔒</span>Your invitation is secure and expires on <strong style="color:#5A6072;font-weight:600;">{{expiry_date}}</strong>.
                </p>

                <p style="margin:0;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:11.5px;color:#8B8F9E;line-height:1.5;">
                  If you weren't expecting this invitation, you can safely ignore this email — it expires automatically on {{expiry_date}}.
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

const TEXT_TEMPLATE = `You've been invited to join {{organization_name}} on gio.

Hi {{recipient_name}} — {{inviter_name}} invited you to join {{organization_name}} on gio, a modern recruiting platform for teams who want to hire better, faster.

Your role: {{role_label}}

What's next:
1. Accept your invitation with the link below
2. Set up your account and profile
3. Start collaborating with your team

Accept your invitation:
{{invite_url_text}}

Your invitation is secure and expires on {{expiry_date}}.

If you weren't expecting this invitation, you can safely ignore this email.
Need help? {{support_email}}
`;
