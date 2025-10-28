
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const emailFrom = Deno.env.get("EMAIL_DEFAULT_FROM") || "Virgilio <noreply@app.virgilio.io>";

interface RequestPasswordResetRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  try {
    const { email }: RequestPasswordResetRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if user exists
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    const userData = users?.users?.find(u => u.email === email);
    
    if (userError || !userData) {
      // Don't reveal if user exists for security
      console.log(`Password reset requested for non-existent email: ${email}`);
      return new Response(
        JSON.stringify({ message: "Password reset email sent if account exists" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate secure token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store token in database
    const { error: tokenError } = await supabase
      .from("password_reset_tokens")
      .insert({
        user_id: userData.id,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error("Error storing reset token:", tokenError);
      throw new Error("Failed to create reset token");
    }

    // Build the reset URL pointing to the app domain
    const resetUrl = `https://app.virgilio.io/reset-password?token=${token}`;
    
    // Validate URL construction
    if (!resetUrl.includes(token) || !resetUrl.startsWith('https://app.virgilio.io')) {
      throw new Error('Invalid reset URL construction');
    }

    // Import email template
    const { createEmailTemplate } = await import('../_shared/emailTemplate.ts');
    
    const emailContent = `
      <p>We received a request to reset the password for your Virgilio account.</p>
      <p>Click the button below to create a new password. This link will expire in <strong>30 minutes</strong> for security reasons.</p>
      <div class="divider"></div>
      <p style="font-size: 14px; color: #6b7280; margin-top: 32px;">
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
    `;

    const emailHtml = createEmailTemplate({
      recipientName: email.split('@')[0], // Use email prefix as fallback
      preheaderText: 'Reset your Virgilio password',
      title: 'Reset Your Password',
      content: emailContent,
      ctaText: 'Reset Password',
      ctaUrl: resetUrl,
      footerNote: '🔒 This is a secure password reset link. For your security, this link will expire in 30 minutes and can only be used once.'
    });
    
    // Send email with Resend
    const emailResponse = await resend.emails.send({
      from: emailFrom,
      to: [email],
      subject: "Reset your password",
      html: emailHtml,
    });

    if (emailResponse.error) {
      console.error("Error sending email:", emailResponse.error);
      throw new Error("Failed to send reset email");
    }

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ message: "Password reset email sent if account exists" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in request-password-reset function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
