import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    for (const email of emails) {
      try {
        console.log(`[send-scheduled-emails] Processing email ${email.id} to ${email.to_emails.join(', ')}`);

        // Call the send-user-email function with contextual booking link data
        const { error: sendError } = await supabase.functions.invoke('send-user-email', {
          body: {
            from_email: email.from_email,
            to: email.to_emails,
            subject: email.subject,
            body_html: email.body_html,
            body_text: email.body_html.replace(/<[^>]*>/g, ''),
            candidate_id: email.candidate_id,
            job_id: email.job_id,
            jhs_id: email.jhs_id,
            association_id: email.association_id,
          },
        });

        if (sendError) {
          throw sendError;
        }

        // Mark as sent
        await supabase
          .from('scheduled_emails')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', email.id);

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
            error_message: error instanceof Error ? error.message : 'Unknown error',
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
