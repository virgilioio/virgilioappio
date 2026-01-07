import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const emailFrom = Deno.env.get("EMAIL_DEFAULT_FROM") || "GoGio <noreply@app.gogio.io>";
const corsHeaders = createSecureCorsHeaders();

interface SendInvitationRequest {
  memberId: string;
  email: string;
  inviterName?: string;
}

// Generate a secure random UUID token
function generateInviteToken(): string {
  return crypto.randomUUID();
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

    console.log('Processing invitation for member:', memberId, 'to email:', email);

    // First, check if member already has a valid token (P0 FIX: prevent double token generation)
    const { data: existingMember, error: fetchError } = await supabase
      .from('members')
      .select('invite_token, invite_expires_at, user_status, organization_id')
      .eq('id', memberId)
      .single();

    if (fetchError) {
      console.error('Error fetching member:', fetchError);
      throw new Error('Member not found');
    }

    let inviteToken = existingMember.invite_token;
    let expiresAt = existingMember.invite_expires_at;

    // Only generate new token if:
    // 1. No existing token, OR
    // 2. Token is expired, OR
    // 3. This is a resend for inactive member
    const isExpired = expiresAt && new Date(expiresAt) < new Date();
    const needsNewToken = !inviteToken || isExpired || existingMember.user_status === 'inactive';

    if (needsNewToken) {
      inviteToken = generateInviteToken();
      const newExpiryDate = new Date();
      newExpiryDate.setDate(newExpiryDate.getDate() + 7);
      expiresAt = newExpiryDate.toISOString();

      console.log('Generated new invite token (previous was missing/expired):', { needsNewToken, isExpired });

      // Update the member record with new token, expiry, email, and status
      const { error: updateError } = await supabase
        .from('members')
        .update({ 
          invited_email: email,
          invite_token: inviteToken,
          invite_expires_at: expiresAt,
          user_status: 'invited',
          invitation_email_status: 'pending',
          invitation_email_error: null
        })
        .eq('id', memberId);

      if (updateError) {
        console.error('Error updating member with new invitation details:', updateError);
        throw updateError;
      }
    } else {
      console.log('Using existing valid token (not expired, already present)');
      
      // Just update the email and reset email status
      const { error: updateError } = await supabase
        .from('members')
        .update({ 
          invited_email: email,
          invitation_email_status: 'pending',
          invitation_email_error: null
        })
        .eq('id', memberId);

      if (updateError) {
        console.error('Error updating member email:', updateError);
        throw updateError;
      }
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
      console.error('Error fetching member details:', memberError);
      throw new Error('Member not found');
    }

    const organizationName = member.organizations?.name || 'the organization';
    const inviteUrl = `https://app.gogio.io/accept-invite/${inviteToken}`;
    const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
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

    // P1: Send the invitation email with retry logic
    const maxRetries = 3;
    let emailSent = false;
    let lastError: Error | null = null;
    let emailResponse: { data?: { id?: string } } | null = null;

    for (let attempt = 1; attempt <= maxRetries && !emailSent; attempt++) {
      try {
        emailResponse = await resend.emails.send({
          from: emailFrom,
          to: [email],
          subject: `You've been invited to join ${organizationName} on GoGio`,
          html: emailHtml,
        });
        
        console.log(`Email sent successfully on attempt ${attempt}:`, emailResponse);
        emailSent = true;
      } catch (emailError: any) {
        console.error(`Email send attempt ${attempt} failed:`, emailError);
        lastError = emailError;
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff: 500ms, 1000ms, 2000ms)
          const waitTime = Math.pow(2, attempt - 1) * 500;
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // P1: Update email delivery status
    if (emailSent) {
      const { error: statusError } = await supabase
        .from('members')
        .update({ 
          invitation_email_sent_at: new Date().toISOString(),
          invitation_email_status: 'sent',
          invitation_email_error: null
        })
        .eq('id', memberId);

      if (statusError) {
        console.error('Failed to update email status:', statusError);
      }
    } else {
      const { error: statusError } = await supabase
        .from('members')
        .update({ 
          invitation_email_status: 'failed',
          invitation_email_error: lastError?.message || 'Unknown error after max retries'
        })
        .eq('id', memberId);

      if (statusError) {
        console.error('Failed to update email status:', statusError);
      }
      
      throw new Error(lastError?.message || 'Failed to send invitation email after multiple attempts');
    }

    // Log activity for member invitation
    const { error: activityError } = await supabase.rpc('log_activity', {
      p_user_id: (await supabase.auth.getUser()).data.user?.id || null,
      p_organization_id: member.organization_id,
      p_activity_type: 'member_invited',
      p_title: `Team member invited: ${email}`,
      p_description: needsNewToken ? 'New invitation sent to team member' : 'Invitation resent to team member',
      p_metadata: {
        invited_email: email,
        role: member.member_role,
        member_id: memberId,
        is_resend: !needsNewToken
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
        messageId: emailResponse?.data?.id,
        inviteUrl,
        expiresAt
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
