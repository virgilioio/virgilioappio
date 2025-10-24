
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    
    // Send email with Resend
    const emailResponse = await resend.emails.send({
      from: "Virgilio <noreply@app.virgilio.io>",
      to: [email],
      subject: "Reset your password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; font-size: 24px; margin: 0;">Reset Your Password</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin: 0;">
              We received a request to reset your password. Click the button below to create a new password:
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: rgb(31, 116, 179); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            <p style="color: #888; font-size: 14px; line-height: 1.5;">
              If you didn't request this password reset, please ignore this email. This link will expire in 30 minutes.
            </p>
            <p style="color: #888; font-size: 14px; line-height: 1.5;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: rgb(31, 116, 179); word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
        </div>
      `,
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
