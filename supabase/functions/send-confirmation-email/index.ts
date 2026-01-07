import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from "npm:standardwebhooks@1.0.0";
import { Resend } from "npm:resend@2.0.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string;
const emailFrom = Deno.env.get("EMAIL_DEFAULT_FROM") || "GoGio <noreply@app.gogio.io>";
const corsHeaders = createSecureCorsHeaders();

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    const wh = new Webhook(hookSecret);
    
    const {
      user,
      email_data: { token_hash, redirect_to, email_action_type }
    } = wh.verify(payload, headers) as {
      user: {
        email: string
      }
      email_data: {
        token_hash: string
        redirect_to: string
        email_action_type: string
      }
    };

    console.log("Email action type:", email_action_type);
    console.log("Original redirect_to:", redirect_to);

    // Only handle signup confirmation emails
    if (email_action_type !== 'signup') {
      return new Response('Not a signup confirmation', { status: 400 });
    }

    // Force the redirect URL to our production app
    const finalRedirectUrl = 'https://app.gogio.io/';
    console.log("Using redirect URL:", finalRedirectUrl);

    const confirmUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(finalRedirectUrl)}`;
    console.log("Generated confirm URL:", confirmUrl);

    // Import email template
    const { createEmailTemplate, formatEmailList } = await import('../_shared/emailTemplate.ts');
    
    const emailContent = `
      <p>Thank you for signing up! We're excited to have you on board.</p>
      <p>To get started with GoGio, please verify your email address by clicking the button below.</p>
      <div class="divider"></div>
      <p><strong>What happens after verification?</strong></p>
      ${formatEmailList([
        'Set up your organization and team',
        'Create your first job posting',
        'Start managing candidates and interviews',
        'Collaborate with your hiring team'
      ])}
      <p style="margin-top: 24px;">This verification link will expire in <strong>24 hours</strong>.</p>
    `;

    const emailHtml = createEmailTemplate({
      recipientName: user.email.split('@')[0], // Use email prefix as fallback
      preheaderText: 'Verify your email to get started with GoGio',
      title: 'Welcome to GoGio!',
      content: emailContent,
      ctaText: 'Verify Email Address',
      ctaUrl: confirmUrl,
      footerNote: `If you didn't create a GoGio account, you can safely ignore this email.`
    });

    const emailResponse = await resend.emails.send({
      from: emailFrom,
      to: [user.email],
      subject: "Confirm your GoGio account",
      html: emailHtml,
    });

    console.log("Confirmation email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResponse.data?.id 
      }), 
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-confirmation-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
