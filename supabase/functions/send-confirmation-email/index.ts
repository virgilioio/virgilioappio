
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    const finalRedirectUrl = 'https://app.virgilio.io/';
    console.log("Using redirect URL:", finalRedirectUrl);

    const confirmUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(finalRedirectUrl)}`;
    console.log("Generated confirm URL:", confirmUrl);

    const emailResponse = await resend.emails.send({
      from: "Virgilio <noreply@app.virgilio.io>",
      to: [user.email],
      subject: "Confirm your Virgilio account",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Confirm your Virgilio account</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
          </style>
        </head>
        <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0d0d09; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
          
          <div style="text-align: center; margin-bottom: 40px;">
            <div style="background: #ffffff; border: 1px solid #e9ecef; border-radius: 12px; padding: 40px; margin-bottom: 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <!-- Virgilio Logo -->
              <div style="display: inline-flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                <svg width="48" height="48" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="margin-right: 16px;">
                  <polygon points="60,50 100,130 140,50 160,50 110,160 90,160 40,50" fill="#22c55e"/>
                  <circle cx="170" cy="90" r="12" fill="#ef4444"/>
                </svg>
                <div>
                  <h1 style="margin: 0; font-family: 'Poppins', sans-serif; font-size: 32px; font-weight: 700; color: #0d0d09; letter-spacing: -0.025em;">Virgilio</h1>
                  <p style="margin: 8px 0 0 0; font-size: 14px; color: #64748b; font-weight: 500;">Connecting talent with opportunity</p>
                </div>
              </div>
            </div>
          </div>

          <div style="background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); border: 1px solid #e9ecef;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: #22c55e; border-radius: 50%; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6 9 17l-5-5"></path>
                </svg>
              </div>
              <h2 style="color: #0d0d09; margin: 0; font-size: 28px; font-weight: 700; font-family: 'Poppins', sans-serif;">Confirm Your Account</h2>
              <p style="color: #64748b; font-size: 16px; margin: 10px 0 0 0;">Welcome to Virgilio! Let's verify your email address.</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 24px; border-radius: 8px; border-left: 4px solid #22c55e; margin-bottom: 30px;">
              <p style="font-size: 16px; margin: 0 0 15px 0; color: #0d0d09;">
                <strong style="color: #0d0d09;">Almost there!</strong> Please confirm your email address to complete your account setup and start using Virgilio.
              </p>
              <p style="font-size: 15px; margin: 0; color: #64748b;">
                Click the button below to verify your email: <strong>${user.email}</strong>
              </p>
            </div>

            <div style="margin-bottom: 30px;">
              <h3 style="color: #0d0d09; margin: 0 0 16px 0; font-size: 18px; font-weight: 600; font-family: 'Poppins', sans-serif;">What's waiting for you:</h3>
              <div style="space-y: 12px;">
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <div style="width: 20px; height: 20px; background: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  </div>
                  <span style="color: #0d0d09; font-size: 15px;">Advanced recruitment tools and candidate management</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <div style="width: 20px; height: 20px; background: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  </div>
                  <span style="color: #0d0d09; font-size: 15px;">Team collaboration and communication features</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <div style="width: 20px; height: 20px; background: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  </div>
                  <span style="color: #0d0d09; font-size: 15px;">Real-time notifications and progress tracking</span>
                </div>
                <div style="display: flex; align-items: center;">
                  <div style="width: 20px; height: 20px; background: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  </div>
                  <span style="color: #0d0d09; font-size: 15px;">Comprehensive analytics and reporting dashboard</span>
                </div>
              </div>
            </div>

            <div style="text-align: center; margin: 35px 0;">
              <a href="${confirmUrl}" 
                 style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); 
                        color: #ffffff; 
                        text-decoration: none; 
                        padding: 16px 32px; 
                        border-radius: 12px; 
                        font-weight: 600; 
                        font-size: 16px; 
                        display: inline-block; 
                        box-shadow: 0 8px 16px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        transition: all 0.2s ease;
                        font-family: 'Poppins', sans-serif;
                        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">
                Confirm Email & Start Using Virgilio
              </a>
            </div>

            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 25px 0;">
              <div style="display: flex; align-items: center;">
                <div style="margin-right: 12px;">🔒</div>
                <div>
                  <p style="margin: 0; font-size: 14px; color: #92400e;">
                    <strong>Security notice:</strong> This confirmation link will expire in 24 hours for your security. 
                    If you didn't create an account, you can safely ignore this email.
                  </p>
                </div>
              </div>
            </div>

            <div style="border-top: 1px solid #e9ecef; padding-top: 20px; margin-top: 30px;">
              <p style="font-size: 13px; color: #64748b; margin: 0 0 8px 0;">
                Having trouble with the button? Copy and paste this link:
              </p>
              <p style="font-size: 12px; color: #0d0d09; word-break: break-all; background: #f8f9fa; padding: 12px; border-radius: 6px; margin: 0; font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;">
                ${confirmUrl}
              </p>
            </div>
          </div>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e9ecef;">
            <p style="font-size: 14px; color: #64748b; margin: 0 0 8px 0;">
              This email was sent by Virgilio to verify your account.
            </p>
            <p style="font-size: 12px; color: #64748b; margin: 0;">
              © 2024 Virgilio. All rights reserved. | Connecting talent with opportunity.
            </p>
          </div>

        </body>
        </html>
      `,
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
