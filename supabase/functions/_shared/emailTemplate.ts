/**
 * Virgilio Email Template System
 * Unified branding for all system emails
 */

export interface EmailTemplateOptions {
  recipientName: string;
  preheaderText?: string;
  title: string;
  content: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
}

const VIRGILIO_COLORS = {
  primary: '#6366f1', // Indigo
  primaryDark: '#4f46e5',
  text: '#1f2937',
  textLight: '#6b7280',
  background: '#f9fafb',
  white: '#ffffff',
  border: '#e5e7eb',
};

export function createEmailTemplate(options: EmailTemplateOptions): string {
  const {
    recipientName,
    preheaderText = 'Important notification from Virgilio',
    title,
    content,
    ctaText,
    ctaUrl,
    footerNote,
  } = options;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: ${VIRGILIO_COLORS.text};
      background-color: ${VIRGILIO_COLORS.background};
    }
    .email-wrapper {
      width: 100%;
      background-color: ${VIRGILIO_COLORS.background};
      padding: 40px 20px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: ${VIRGILIO_COLORS.white};
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }
    .email-header {
      background: linear-gradient(135deg, ${VIRGILIO_COLORS.primary} 0%, ${VIRGILIO_COLORS.primaryDark} 100%);
      padding: 32px 40px;
      text-align: center;
    }
    .logo {
      font-size: 28px;
      font-weight: 700;
      color: ${VIRGILIO_COLORS.white};
      text-decoration: none;
      letter-spacing: -0.5px;
    }
    .email-body {
      padding: 40px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: ${VIRGILIO_COLORS.text};
      margin: 0 0 24px 0;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      color: ${VIRGILIO_COLORS.text};
      margin: 0 0 24px 0;
      line-height: 1.3;
    }
    .content {
      font-size: 15px;
      color: ${VIRGILIO_COLORS.text};
      margin: 0 0 24px 0;
      line-height: 1.7;
    }
    .content p {
      margin: 0 0 16px 0;
    }
    .content ul {
      margin: 0 0 16px 0;
      padding-left: 24px;
    }
    .content li {
      margin-bottom: 8px;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0;
    }
    .cta-button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, ${VIRGILIO_COLORS.primary} 0%, ${VIRGILIO_COLORS.primaryDark} 100%);
      color: ${VIRGILIO_COLORS.white} !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 15px;
      transition: transform 0.2s;
    }
    .cta-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }
    .footer-note {
      font-size: 13px;
      color: ${VIRGILIO_COLORS.textLight};
      padding: 20px 40px;
      background-color: ${VIRGILIO_COLORS.background};
      border-top: 1px solid ${VIRGILIO_COLORS.border};
    }
    .email-footer {
      padding: 32px 40px;
      text-align: center;
      font-size: 13px;
      color: ${VIRGILIO_COLORS.textLight};
      border-top: 1px solid ${VIRGILIO_COLORS.border};
    }
    .email-footer a {
      color: ${VIRGILIO_COLORS.primary};
      text-decoration: none;
    }
    .divider {
      height: 1px;
      background-color: ${VIRGILIO_COLORS.border};
      margin: 24px 0;
    }
    @media only screen and (max-width: 600px) {
      .email-header {
        padding: 24px 20px;
      }
      .email-body {
        padding: 24px 20px;
      }
      .title {
        font-size: 20px;
      }
      .footer-note {
        padding: 16px 20px;
      }
      .email-footer {
        padding: 24px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div style="display: none; max-height: 0; overflow: hidden;">
      ${preheaderText}
    </div>
    <div class="email-container">
      <div class="email-header">
        <div class="logo">Virgilio</div>
      </div>
      <div class="email-body">
        <p class="greeting">Hi ${recipientName},</p>
        <h1 class="title">${title}</h1>
        <div class="content">
          ${content}
        </div>
        ${ctaText && ctaUrl ? `
        <div class="cta-container">
          <a href="${ctaUrl}" class="cta-button">${ctaText}</a>
        </div>
        ` : ''}
      </div>
      ${footerNote ? `
      <div class="footer-note">
        ${footerNote}
      </div>
      ` : ''}
      <div class="email-footer">
        <p style="margin: 0 0 8px 0;">
          <strong>Virgilio</strong> - Modern Recruiting Platform
        </p>
        <p style="margin: 0 0 16px 0;">
          Need help? Contact us at <a href="mailto:support@virgilio.tech">support@virgilio.tech</a>
        </p>
        <p style="margin: 0; font-size: 12px;">
          © ${new Date().getFullYear()} Virgilio. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Helper function for simple text content
export function formatEmailContent(paragraphs: string[]): string {
  return paragraphs.map(p => `<p>${p}</p>`).join('\n');
}

// Helper function for lists
export function formatEmailList(items: string[]): string {
  return `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
}
