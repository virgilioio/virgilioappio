import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const emailFrom = Deno.env.get("EMAIL_DEFAULT_FROM") || "GoGio <noreply@app.gogio.io>";
const corsHeaders = createSecureCorsHeaders();

interface RequestNewInvitationPayload {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  try {
    const { email }: RequestNewInvitationPayload = await req.json();
    
    if (!email) {
      throw new Error('Email is required');
    }

    console.log('Processing new invitation request for email:', email);

    // Use service role for admin queries
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find the member record with this email that has an expired or pending invitation
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select(`
        id,
        invited_email,
        user_status,
        invite_expires_at,
        organization_id,
        organizations!inner (
          name,
          owner_id
        )
      `)
      .eq('invited_email', email)
      .in('user_status', ['invited', 'inactive'])
      .maybeSingle();

    if (memberError) {
      console.error('Error finding member:', memberError);
    }

    // Always return success to prevent email enumeration attacks
    if (!member) {
      console.log('No matching member found for email:', email);
      return new Response(
        JSON.stringify({ success: true }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Found member with expired/pending invitation:', member.id);

    // Get the organization owner's email to notify them
    const { data: ownerMember, error: ownerError } = await supabase
      .from('members')
      .select(`
        user_id,
        profiles!inner (
          email,
          first_name
        )
      `)
      .eq('organization_id', member.organization_id)
      .eq('member_role', 'admin')
      .limit(1)
      .maybeSingle();

    if (ownerError) {
      console.error('Error finding owner:', ownerError);
    }

    const ownerEmail = ownerMember?.profiles?.email;
    const ownerName = ownerMember?.profiles?.first_name || 'Admin';
    const organizationName = member.organizations?.name || 'your organization';

    if (ownerEmail) {
      console.log('Sending notification to admin:', ownerEmail);
      
      try {
        // Import email template
        const { createEmailTemplate, formatEmailList } = await import('../_shared/emailTemplate.ts');

        const emailContent = `
          <p>A user with email <strong>${email}</strong> has requested a new invitation to join <strong>${organizationName}</strong>.</p>
          <p>Their previous invitation has expired or is no longer valid.</p>
          <div class="divider"></div>
          <p><strong>What to do:</strong></p>
          ${formatEmailList([
            'Log in to GoGio',
            'Go to Settings → Members',
            'Find the member and click "Resend Invitation"'
          ])}
        `;

        const emailHtml = createEmailTemplate({
          recipientName: ownerName,
          preheaderText: `${email} needs a new invitation`,
          title: 'Invitation Request',
          content: emailContent,
          ctaText: 'Go to Members',
          ctaUrl: 'https://app.gogio.io/settings?tab=members',
          footerNote: 'You received this email because someone requested a new invitation to your organization.'
        });

        await resend.emails.send({
          from: emailFrom,
          to: [ownerEmail],
          subject: `Invitation Request: ${email} needs a new invitation`,
          html: emailHtml,
        });
        
        console.log('Admin notification sent successfully');
      } catch (emailError) {
        console.error('Failed to send admin notification:', emailError);
        // Don't fail the request even if notification fails
      }
    } else {
      console.log('No admin email found to notify');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: any) {
    console.error('Error in request-new-invitation:', error);
    
    // Always return success to prevent email enumeration
    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);
