// Phase 5.1 — Email channel render helpers for Chat.
// Wraps plain recruiter text into a minimal branded HTML email with a 1x1
// open-tracking pixel pointing at the chat-email-pixel edge function.

export interface RenderChatEmailArgs {
  recipientFirstName?: string | null
  companyName?: string | null
  jobTitle?: string | null
  bodyText: string
  pixelUrl: string
  threadUrl?: string | null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function paragraphs(bodyText: string): string {
  return bodyText
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0;line-height:1.55;color:#0d0d09;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

export function renderChatEmailHtml(args: RenderChatEmailArgs): string {
  const greeting = args.recipientFirstName ? `Hi ${escapeHtml(args.recipientFirstName)},` : 'Hi,'
  const sigCompany = args.companyName ? escapeHtml(args.companyName) : 'the hiring team'
  const sigJob = args.jobTitle ? ` · ${escapeHtml(args.jobTitle)}` : ''
  const threadLine = args.threadUrl
    ? `<p style="margin:18px 0 0 0;font-size:12px;color:#5A6072;">You can also reply directly to this email.</p>`
    : ''

  return `<!doctype html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Inter,Arial,sans-serif;color:#0d0d09;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <p style="margin:0 0 14px 0;line-height:1.55;">${greeting}</p>
    ${paragraphs(args.bodyText)}
    <p style="margin:24px 0 0 0;font-size:13px;color:#5A6072;">— ${sigCompany}${sigJob}</p>
    ${threadLine}
  </div>
  <img src="${args.pixelUrl}" width="1" height="1" alt="" style="display:block;border:0;outline:none;text-decoration:none;width:1px;height:1px;" />
</body></html>`
}
