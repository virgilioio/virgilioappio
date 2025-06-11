
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendInvitationRequest {
  memberId: string;
  email: string;
  inviterName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Send the invitation email using Resend's default domain
    const emailResponse = await resend.emails.send({
      from: "Virgilio <onboarding@resend.dev>",
      to: [email],
      subject: `You've been invited to join ${organizationName} on Virgilio`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitation to Virgilio</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <div style="text-align: center; margin-bottom: 40px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 30px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Virgilio</h1>
            </div>
          </div>

          <div style="background: #f8fafc; padding: 30px; border-radius: 12px; border-left: 4px solid #667eea;">
            <h2 style="color: #1a202c; margin-top: 0; font-size: 24px;">You're Invited!</h2>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              ${inviterName ? `<strong>${inviterName}</strong> has` : 'You have been'} invited you to join <strong>${organizationName}</strong> on Virgilio, the recruitment platform that connects talent with opportunity.
            </p>

            <p style="font-size: 16px; margin-bottom: 25px;">
              As a member of <strong>${organizationName}</strong>, you'll have access to:
            </p>

            <ul style="font-size: 16px; margin-bottom: 30px; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Collaborative recruitment tools</li>
              <li style="margin-bottom: 8px;">Candidate management system</li>
              <li style="margin-bottom: 8px;">Team collaboration features</li>
              <li style="margin-bottom: 8px;">Real-time notifications and updates</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        text-decoration: none; 
                        padding: 15px 30px; 
                        border-radius: 8px; 
                        font-weight: 600; 
                        font-size: 16px; 
                        display: inline-block; 
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                Accept Invitation
              </a>
            </div>

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 25px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>⏰ Important:</strong> This invitation will expire on <strong>${expiryDate}</strong>. 
                Please accept it before then to join your team.
              </p>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">
              Can't click the button? Copy and paste this link into your browser:
            </p>
            <p style="font-size: 12px; color: #6b7280; word-break: break-all; background: #f1f5f9; padding: 10px; border-radius: 4px;">
              ${inviteUrl}
            </p>
          </div>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 14px; color: #6b7280; margin: 0;">
              This invitation was sent by Virgilio. If you didn't expect this invitation, you can safely ignore this email.
            </p>
            <p style="font-size: 12px; color: #9ca3af; margin: 10px 0 0 0;">
              © 2024 Virgilio. All rights reserved.
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
