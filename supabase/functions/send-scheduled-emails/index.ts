import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { scheduledSendBody, sendFailureReason } from "../_shared/scheduledSend.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // --- internal auth gate (log-only mode; enforcement flipped later) ---

  const expectedSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");

  const gotSecret = req.headers.get("x-internal-secret");

  const isAuthorized = !!expectedSecret && gotSecret === expectedSecret;

  const ENFORCE_INTERNAL_AUTH = true;

  if (!isAuthorized) {
    console.warn(`[auth-gate] Unauthorized call. enforce=${ENFORCE_INTERNAL_AUTH}`);

    if (ENFORCE_INTERNAL_AUTH) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    console.log("[auth-gate] Authorized internal call.");
  }

  // --- end internal auth gate ---

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[send-scheduled-emails] Starting scheduled email processing...');

  try {
    // Get all pending scheduled emails that are due
    const { data: emails, error: fetchError } = await supabase
      .from('scheduled_emails')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50); // Process in batches

    if (fetchError) {
      console.error('[send-scheduled-emails] Error fetching emails:', fetchError);
      throw fetchError;
    }

    if (!emails || emails.length === 0) {
      console.log('[send-scheduled-emails] No scheduled emails to process');
      return new Response(JSON.stringify({ message: 'No scheduled emails to process', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-scheduled-emails] Found ${emails.length} emails to process`);

    let successCount = 0;
    let failCount = 0;

    // A sender works while their mailbox is connected and they're an active member.
    const senderWorks = async (address: string): Promise<boolean> => {
      const { data: ids } = await supabase
        .from('user_mail_identities')
        .select('user_id')
        .eq('email_address', address)
        .eq('is_active', true)
        .limit(1);
      const userId = ids?.[0]?.user_id;
      if (!userId) return false;
      const { data: m } = await supabase
        .from('members')
        .select('user_id')
        .eq('user_id', userId)
        .eq('user_status', 'active')
        .limit(1);
      return !!m?.length;
    };
    const senderFor = async (email: { from_email: string; job_id?: string | null }): Promise<string> => {
      if (await senderWorks(email.from_email)) return email.from_email;
      if (!email.job_id) return email.from_email;
      const { data: other } = await supabase.rpc('job_rejection_sender', { _job_id: email.job_id });
      if (typeof other === 'string' && other) {
        console.log(`[send-scheduled-emails] Scheduled sender can't send any more; using the job's sender`);
        return other;
      }
      return email.from_email;
    };

    for (const email of emails) {
      try {
        // A rejection email whose candidate is back in consideration never goes out
        // (restoring cancels it in the database; this catches anything in between).
        if (email.email_type === 'rejection' && email.association_id) {
          const { data: assoc } = await supabase
            .from('job_candidate_associations')
            .select('status')
            .eq('id', email.association_id)
            .maybeSingle();
          if (assoc && String(assoc.status ?? '').toLowerCase() !== 'rejected') {
            await supabase
              .from('scheduled_emails')
              .update({ status: 'cancelled', cancel_reason: 'restored', cancelled_at: new Date().toISOString() })
              .eq('id', email.id)
              .eq('status', 'pending');
            console.log(`[send-scheduled-emails] Skipped ${email.id}: the candidate isn't rejected any more`);
            continue;
          }
        }

        // Who it goes out from: the person it was scheduled from while their Gmail
        // is connected and they're still active; else the job's sender now (its
        // Recruiter, the job's creator, a hiring manager: job_rejection_sender).
        const fromEmail = await senderFor(email);

        // Claim it before sending: an email cancelled a moment ago is no longer pending
        // and is skipped, and two runs never send the same one.
        const { data: claimed, error: claimError } = await supabase
          .from('scheduled_emails')
          .update({ status: 'sent', sent_at: new Date().toISOString(), from_email: fromEmail })
          .eq('id', email.id)
          .eq('status', 'pending')
          .select('id');
        if (claimError) throw claimError;
        if (!claimed?.length) {
          console.log(`[send-scheduled-emails] Skipped ${email.id}: no longer waiting`);
          continue;
        }

        console.log(`[send-scheduled-emails] Processing email ${email.id} to ${email.to_emails.join(', ')}`);

        // Only fields with a value: send-user-email refuses an empty one (a null
        // jhs_id refused every scheduled rejection until 2026-11-23).
        const { error: sendError } = await supabase.functions.invoke('send-user-email', {
          body: scheduledSendBody(email, fromEmail),
        });

        if (sendError) {
          throw sendError;
        }

        // Already marked sent when it was claimed.

        // Update the association if this is a rejection email
        if (email.email_type === 'rejection' && email.association_id) {
          await supabase
            .from('job_candidate_associations')
            .update({
              rejection_email_sent_at: new Date().toISOString(),
              rejection_email_scheduled_for: null, // Clear scheduled time since it's now sent
            })
            .eq('id', email.association_id);
        }

        successCount++;
        console.log(`[send-scheduled-emails] Successfully sent email ${email.id}`);
      } catch (error) {
        console.error(`[send-scheduled-emails] Failed to send email ${email.id}:`, error);
        
        // Mark as failed
        await supabase
          .from('scheduled_emails')
          .update({
            status: 'failed',
            sent_at: null,
            error_message: await sendFailureReason(error),
          })
          .eq('id', email.id);

        failCount++;
      }
    }

    console.log(`[send-scheduled-emails] Processing complete. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        message: 'Scheduled emails processed',
        processed: emails.length,
        success: successCount,
        failed: failCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[send-scheduled-emails] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
