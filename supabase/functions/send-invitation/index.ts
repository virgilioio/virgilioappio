
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const emailFrom = Deno.env.get("EMAIL_DEFAULT_FROM") || "Virgilio <noreply@app.virgilio.io>";
const corsHeaders = createSecureCorsHeaders();

interface SendInvitationRequest {
  memberId: string;
  email: string;
  inviterName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { memberId, email, inviterName }: SendInvitationRequest = await req.json();

    console.log('Sending invitation for member:', memberId, 'to email:', email);

    // Update the member record with the invited email
    const { error: updateError } = await supabase
      .from('members')
      .update({ invited_email: email })
      .eq('id', memberId)
      .eq('user_status', 'invited');

    if (updateError) {
      console.error('Error updating member with email:', updateError);
      throw updateError;
    }

    // Get member details with organization info
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select(`
        *,
        organizations!inner (
          name
        )
      `)
      .eq('id', memberId)
      .eq('user_status', 'invited')
      .single();

    if (memberError || !member) {
      console.error('Error fetching member:', memberError);
      throw new Error('Member not found or not in invited status');
    }

    if (!member.invite_token) {
      throw new Error('No invitation token found for member');
    }

    const organizationName = member.organizations?.name || 'the organization';
    const inviteUrl = `https://app.virgilio.io/accept-invite/${member.invite_token}`;
    const expiryDate = new Date(member.invite_expires_at).toLocaleDateString();

    // Send the invitation email with Virgilio branding
    const emailResponse = await resend.emails.send({
      from: emailFrom,
      to: [email],
      subject: `You've been invited to join ${organizationName} on Virgilio`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitation to Virgilio</title>
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
                  <circle cx="100" cy="100" r="90" fill="#22c55e" stroke="#ffffff" stroke-width="4"/>
                  <circle cx="70" cy="70" r="15" fill="#ef4444"/>
                  <circle cx="130" cy="70" r="15" fill="#3b82f6"/>
                  <circle cx="70" cy="130" r="15" fill="#fffead"/>
                  <circle cx="130" cy="130" r="15" fill="#f97316"/>
                  <polygon points="100,60 120,100 100,140 80,100" fill="#ffffff"/>
                </svg>
                <div>
                  <h1 style="margin: 0; font-family: 'Poppins', sans-serif; font-size: 32px; font-weight: 700; color: #0d0d09; letter-spacing: -0.025em;">virgilio</h1>
                  <p style="margin: 8px 0 0 0; font-size: 14px; color: #64748b; font-weight: 500;">Connecting talent with opportunity</p>
                </div>
              </div>
            </div>
          </div>

          <div style="background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); border: 1px solid #e9ecef;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: #fffead; border-radius: 50%; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0d0d09" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="m22 2-5 10-3-3-10 5 18-12z"></path>
                </svg>
              </div>
              <h2 style="color: #0d0d09; margin: 0; font-size: 28px; font-weight: 700; font-family: 'Poppins', sans-serif;">You're Invited!</h2>
              <p style="color: #64748b; font-size: 16px; margin: 10px 0 0 0;">Join your team on Virgilio</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 24px; border-radius: 8px; border-left: 4px solid #fffead; margin-bottom: 30px;">
              <p style="font-size: 16px; margin: 0 0 15px 0; color: #0d0d09;">
                ${inviterName ? `<strong style="color: #0d0d09;">${inviterName}</strong> has invited you to join` : 'You have been invited to join'} <strong style="color: #0d0d09;">${organizationName}</strong> on Virgilio.
              </p>
              <p style="font-size: 15px; margin: 0; color: #64748b;">
                Complete your account setup to start collaborating with your team.
              </p>
            </div>

            <div style="margin-bottom: 30px;">
              <h3 style="color: #0d0d09; margin: 0 0 16px 0; font-size: 18px; font-weight: 600; font-family: 'Poppins', sans-serif;">What you'll get access to:</h3>
              <div style="space-y: 12px;">
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <div style="width: 20px; height: 20px; background: #fffead; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d0d09" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  </div>
                  <span style="color: #0d0d09; font-size: 15px;">Advanced recruitment tools and candidate management</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <div style="width: 20px; height: 20px; background: #fffead; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d0d09" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  </div>
                  <span style="color: #0d0d09; font-size: 15px;">Team collaboration and communication features</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <div style="width: 20px; height: 20px; background: #fffead; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d0d09" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  </div>
                  <span style="color: #0d0d09; font-size: 15px;">Real-time notifications and progress tracking</span>
                </div>
                <div style="display: flex; align-items: center;">
                  <div style="width: 20px; height: 20px; background: #fffead; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d0d09" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  </div>
                  <span style="color: #0d0d09; font-size: 15px;">Comprehensive analytics and reporting dashboard</span>
                </div>
              </div>
            </div>

            <div style="text-align: center; margin: 35px 0;">
              <a href="${inviteUrl}" 
                 style="background: #fffead; 
                        color: #0d0d09; 
                        text-decoration: none; 
                        padding: 16px 32px; 
                        border-radius: 8px; 
                        font-weight: 600; 
                        font-size: 16px; 
                        display: inline-block; 
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), inset 0 2px 4px rgba(255, 255, 255, 0.6);
                        border: 1px solid #e9ecef;
                        transition: all 0.2s ease;
                        font-family: 'Poppins', sans-serif;">
                Accept Invitation & Join Team
              </a>
            </div>

            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 25px 0;">
              <div style="display: flex; align-items: center;">
                <div style="margin-right: 12px;">⏰</div>
                <div>
                  <p style="margin: 0; font-size: 14px; color: #92400e;">
                    <strong>Time-sensitive invitation:</strong> This invitation expires on <strong>${expiryDate}</strong>. 
                    Please accept it before then to join your team.
                  </p>
                </div>
              </div>
            </div>

            <div style="border-top: 1px solid #e9ecef; padding-top: 20px; margin-top: 30px;">
              <p style="font-size: 13px; color: #64748b; margin: 0 0 8px 0;">
                Having trouble with the button? Copy and paste this link:
              </p>
              <p style="font-size: 12px; color: #0d0d09; word-break: break-all; background: #f8f9fa; padding: 12px; border-radius: 6px; margin: 0; font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;">
                ${inviteUrl}
              </p>
            </div>
          </div>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e9ecef;">
            <p style="font-size: 14px; color: #64748b; margin: 0 0 8px 0;">
              This invitation was sent by Virgilio on behalf of ${organizationName}.
            </p>
            <p style="font-size: 12px; color: #64748b; margin: 0;">
              © 2024 Virgilio. All rights reserved. | Connecting talent with opportunity.
            </p>
          </div>

        </body>
        </html>
      `,
    });

    console.log("Invitation email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResponse.data?.id,
        inviteUrl 
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
    console.error("Error in send-invitation function:", error);
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
