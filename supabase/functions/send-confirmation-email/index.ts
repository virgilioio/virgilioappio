
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

    // Only handle signup confirmation emails
    if (email_action_type !== 'signup') {
      return new Response('Not a signup confirmation', { status: 400 });
    }

    const confirmUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=https://app.virgilio.io/`;

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
        </head>
        <body style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; line-height: 1.6; color: hsl(222.2 84% 4.9%); max-width: 600px; margin: 0 auto; padding: 20px; background-color: hsl(210 40% 98%);">
          
          <div style="text-align: center; margin-bottom: 40px;">
            <div style="background: hsl(221.2 83.2% 53.3%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: white; border-radius: 8px; margin-bottom: 16px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="hsl(221.2 83.2% 53.3%)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="m2 17 10 5 10-5"/>
                  <path d="m2 12 10 5 10-5"/>
                </svg>
              </div>
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.025em;">Virgilio</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Connecting talent with opportunity</p>
            </div>
          </div>

          <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); border: 1px solid hsl(214.3 31.8% 91.4%);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: hsl(221.2 83.2% 53.3%); border-radius: 50%; margin-bottom: 20px;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6 9 17l-5-5"></path>
                </svg>
              </div>
              <h2 style="color: hsl(222.2 84% 4.9%); margin: 0; font-size: 28px; font-weight: 700;">Confirm Your Account</h2>
              <p style="color: hsl(215.4 16.3% 46.9%); font-size: 16px; margin: 10px 0 0 0;">Welcome to Virgilio! Let's verify your email address.</p>
            </div>
            
            <div style="background: hsl(210 40% 98%); padding: 24px; border-radius: 8px; border-left: 4px solid hsl(221.2 83.2% 53.3%); margin-bottom: 30px;">
              <p style="font-size: 16px; margin: 0 0 15px 0; color: hsl(222.2 84% 4.9%);">
                <strong style="color: hsl(221.2 83.2% 53.3%);">Almost there!</strong> Please confirm your email address to complete your account setup and start using Virgilio.
              </p>
              <p style="font-size: 15px; margin: 0; color: hsl(215.4 16.3% 46.9%);">
                Click the button below to verify your email: <strong>${user.email}</strong>
              </p>
            </div>

            <div style="margin-bottom: 30px;">
              <h3 style="color: hsl(222.2 84% 4.9%); margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">What's waiting for you:</h3>
              <div style="space-y: 12px;">
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <div style="width: 20px; height: 20px; background: hsl(221.2 83.2% 53.3%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  </div>
                  <span style="color: hsl(222.2 84% 4.9%); font-size: 15px;">Advanced recruitment tools and candidate management</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <div style="width: 20px; height: 20px; background: hsl(221.2 83.2% 53.3%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  </div>
                  <span style="color: hsl(222.2 84% 4.9%); font-size: 15px;">Team collaboration and communication features</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <div style="width: 20px; height: 20px; background: hsl(221.2 83.2% 53.3%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  </div>
                  <span style="color: hsl(222.2 84% 4.9%); font-size: 15px;">Real-time notifications and progress tracking</span>
                </div>
                <div style="display: flex; align-items: center;">
                  <div style="width: 20px; height: 20px; background: hsl(221.2 83.2% 53.3%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  </div>
                  <span style="color: hsl(222.2 84% 4.9%); font-size: 15px;">Comprehensive analytics and reporting dashboard</span>
                </div>
              </div>
            </div>

            <div style="text-align: center; margin: 35px 0;">
              <a href="${confirmUrl}" 
                 style="background: hsl(221.2 83.2% 53.3%); 
                        color: white; 
                        text-decoration: none; 
                        padding: 16px 32px; 
                        border-radius: 8px; 
                        font-weight: 600; 
                        font-size: 16px; 
                        display: inline-block; 
                        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                        transition: all 0.2s ease;">
                Confirm Email & Start Using Virgilio
              </a>
            </div>

            <div style="background: hsl(48 96% 89%); border: 1px solid hsl(48 96% 76%); border-radius: 8px; padding: 16px; margin: 25px 0;">
              <div style="display: flex; align-items: center;">
                <div style="margin-right: 12px;">🔒</div>
                <div>
                  <p style="margin: 0; font-size: 14px; color: hsl(31 92% 29%);">
                    <strong>Security notice:</strong> This confirmation link will expire in 24 hours for your security. 
                    If you didn't create an account, you can safely ignore this email.
                  </p>
                </div>
              </div>
            </div>

            <div style="border-top: 1px solid hsl(214.3 31.8% 91.4%); padding-top: 20px; margin-top: 30px;">
              <p style="font-size: 13px; color: hsl(215.4 16.3% 46.9%); margin: 0 0 8px 0;">
                Having trouble with the button? Copy and paste this link:
              </p>
              <p style="font-size: 12px; color: hsl(221.2 83.2% 53.3%); word-break: break-all; background: hsl(210 40% 98%); padding: 12px; border-radius: 6px; margin: 0; font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;">
                ${confirmUrl}
              </p>
            </div>
          </div>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid hsl(214.3 31.8% 91.4%);">
            <p style="font-size: 14px; color: hsl(215.4 16.3% 46.9%); margin: 0 0 8px 0;">
              This email was sent by Virgilio to verify your account.
            </p>
            <p style="font-size: 12px; color: hsl(215.4 16.3% 46.9%); margin: 0;">
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
