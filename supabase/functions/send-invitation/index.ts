
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
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
    const expiryDate = new Date(member.invite_expires_at).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Import email template
    const { createEmailTemplate, formatEmailList } = await import('../_shared/emailTemplate.ts');

    const emailContent = `
      <p>You've been invited by ${inviterName || 'a team member'} to join <strong>${organizationName}</strong> on Virgilio.</p>
      <p>Virgilio is a modern recruiting platform that helps teams hire better, faster. You'll have access to powerful tools for managing candidates, scheduling interviews, and collaborating with your team.</p>
      <div class="divider"></div>
      <p><strong>What's next?</strong></p>
      ${formatEmailList([
        'Click the button below to accept your invitation',
        'Set up your account and profile',
        'Start collaborating with your team'
      ])}
      <p style="margin-top: 24px;"><strong>Important:</strong> This invitation will expire on <strong>${expiryDate}</strong>.</p>
    `;

    const emailHtml = createEmailTemplate({
      recipientName: email.split('@')[0], // Use email prefix as fallback name
      preheaderText: `Join ${organizationName} on Virgilio`,
      title: `Welcome to ${organizationName}!`,
      content: emailContent,
      ctaText: 'Accept Invitation',
      ctaUrl: inviteUrl,
      footerNote: `If you weren't expecting this invitation, you can safely ignore this email. The invitation will expire automatically on ${expiryDate}.`
    });

    // Send the invitation email with Virgilio branding
    const emailResponse = await resend.emails.send({
      from: emailFrom,
      to: [email],
      subject: `You've been invited to join ${organizationName} on Virgilio`,
      html: emailHtml,
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
