
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const emailFrom = Deno.env.get("EMAIL_DEFAULT_FROM") || "GoGio <noreply@app.gogio.io>";
const corsHeaders = createSecureCorsHeaders();

interface SendInvitationRequest {
  memberId: string;
  email: string;
  inviterName?: string;
}

// Generate a secure random token
function generateInviteToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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

    console.log('Sending/resending invitation for member:', memberId, 'to email:', email);

    // Generate new invite token and expiry date (7 days from now)
    const newInviteToken = generateInviteToken();
    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + 7);

    console.log('Generated new invite token and expiry:', newExpiryDate.toISOString());

    // Update the member record with new token, expiry, email, and reset status to 'invited'
    const { error: updateError } = await supabase
      .from('members')
      .update({ 
        invited_email: email,
        invite_token: newInviteToken,
        invite_expires_at: newExpiryDate.toISOString(),
        user_status: 'invited' // Reset status in case it was set to 'inactive' by cleanup
      })
      .eq('id', memberId);

    if (updateError) {
      console.error('Error updating member with new invitation details:', updateError);
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
      .single();

    if (memberError || !member) {
      console.error('Error fetching member:', memberError);
      throw new Error('Member not found');
    }

    const organizationName = member.organizations?.name || 'the organization';
    const inviteUrl = `https://app.gogio.io/accept-invite/${newInviteToken}`;
    const expiryDate = new Date(newExpiryDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Import email template
    const { createEmailTemplate, formatEmailList } = await import('../_shared/emailTemplate.ts');

    const emailContent = `
      <p>You've been invited by ${inviterName || 'a team member'} to join <strong>${organizationName}</strong> on GoGio.</p>
      <p>GoGio is a modern recruiting platform that helps teams hire better, faster. You'll have access to powerful tools for managing candidates, scheduling interviews, and collaborating with your team.</p>
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
      preheaderText: `Join ${organizationName} on GoGio`,
      title: `Welcome to ${organizationName}!`,
      content: emailContent,
      ctaText: 'Accept Invitation',
      ctaUrl: inviteUrl,
      footerNote: `If you weren't expecting this invitation, you can safely ignore this email. The invitation will expire automatically on ${expiryDate}.`
    });

    // Send the invitation email with GoGio branding
    const emailResponse = await resend.emails.send({
      from: emailFrom,
      to: [email],
      subject: `You've been invited to join ${organizationName} on GoGio`,
      html: emailHtml,
    });

    console.log("Invitation email sent successfully:", emailResponse);

    // Log activity for member invitation
    const { error: activityError } = await supabase.rpc('log_activity', {
      p_user_id: (await supabase.auth.getUser()).data.user?.id || null,
      p_organization_id: member.organization_id,
      p_activity_type: 'member_invited',
      p_title: `Team member invited: ${email}`,
      p_description: 'Invitation sent to new team member',
      p_metadata: {
        invited_email: email,
        role: member.member_role,
        member_id: memberId,
        is_resend: true // Mark that this could be a resend
      },
      p_entity_type: 'member',
      p_entity_id: memberId
    });

    if (activityError) {
      console.error('Failed to log activity:', activityError);
      // Don't fail the request if activity logging fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResponse.data?.id,
        inviteUrl,
        expiresAt: newExpiryDate.toISOString()
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
