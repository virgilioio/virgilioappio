import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeadersFor, handlePreflight } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const preflightResponse = handlePreflight(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get('Origin') ?? undefined;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('[Automation Processor] Starting email queue processing...');
    
    // Fetch pending emails that are due
    const { data: queuedEmails, error: fetchError } = await supabase
      .from('automation_email_queue')
      .select(`
        *,
        stage_automation_emails!inner(*),
        job_candidate_associations!inner(
          id,
          job_id,
          candidate_id,
          current_stage_id,
          candidates!inner(*)
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50);
    
    if (fetchError) {
      console.error('[Automation Processor] Error fetching queue:', fetchError);
      throw fetchError;
    }
    
    console.log(`[Automation Processor] Processing ${queuedEmails?.length || 0} queued emails`);
    
    for (const queueItem of queuedEmails || []) {
      try {
        const emailConfig = queueItem.stage_automation_emails;
        const association = queueItem.job_candidate_associations;
        const candidate = association.candidates;
        
        console.log(`[Automation Processor] Processing email ${queueItem.id} for candidate ${candidate.id}`);
        
        // Check stop conditions
        const { data: shouldStop } = await supabase.rpc('should_stop_automation', {
          p_jca_id: association.id,
          p_job_id: association.job_id
        });
        
        if (shouldStop) {
          await supabase
            .from('automation_email_queue')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', queueItem.id);
          console.log(`[Automation Processor] Cancelled email ${queueItem.id} - stop condition met`);
          continue;
        }
        
        // Check if candidate has moved stages
        const { data: currentAssociation } = await supabase
          .from('job_candidate_associations')
          .select('current_stage_id')
          .eq('id', association.id)
          .single();
        
        if (currentAssociation?.current_stage_id !== association.current_stage_id) {
          await supabase
            .from('automation_email_queue')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', queueItem.id);
          console.log(`[Automation Processor] Cancelled email ${queueItem.id} - candidate moved stages`);
          continue;
        }
        
        // Prepare email data based on send_to
        let toAddresses: string[] = [];
        
        if (emailConfig.send_to === 'candidate') {
          if (!candidate.email) {
            throw new Error('Candidate has no email address');
          }
          toAddresses = [candidate.email];
        } else if (emailConfig.send_to === 'custom' && emailConfig.custom_recipients) {
          toAddresses = emailConfig.custom_recipients;
        }
        // TODO: Add logic for 'hiring_team' and 'interviewers' when those are implemented
        
        const emailRequest = {
          from_email: emailConfig.from_email,
          to: toAddresses,
          subject: emailConfig.subject,
          body_html: emailConfig.body,
          candidate_id: candidate.id,
          job_id: association.job_id
        };
        
        // Send email via send-user-email function
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-user-email', {
          body: emailRequest
        });
        
        if (sendError) {
          console.error(`[Automation Processor] Error sending email ${queueItem.id}:`, sendError);
          throw sendError;
        }
        
        // Mark as sent
        await supabase
          .from('automation_email_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', queueItem.id);
        
        console.log(`[Automation Processor] Sent email ${queueItem.id}`);
        
        // If recurring, schedule next occurrence
        if (emailConfig.is_recurring) {
          const currentOccurrence = queueItem.occurrence_number;
          const maxOccurrences = emailConfig.max_occurrences;
          
          // Check if we should schedule another
          if (!maxOccurrences || currentOccurrence < maxOccurrences) {
            const nextScheduledTime = new Date();
            if (emailConfig.recurrence_interval_unit === 'days') {
              nextScheduledTime.setDate(nextScheduledTime.getDate() + emailConfig.recurrence_interval_value);
            } else if (emailConfig.recurrence_interval_unit === 'weeks') {
              nextScheduledTime.setDate(nextScheduledTime.getDate() + (emailConfig.recurrence_interval_value * 7));
            }
            
            await supabase
              .from('automation_email_queue')
              .insert({
                stage_automation_email_id: emailConfig.id,
                job_candidate_association_id: association.id,
                scheduled_for: nextScheduledTime.toISOString(),
                occurrence_number: currentOccurrence + 1,
                parent_queue_id: queueItem.id,
                status: 'pending'
              });
            
            console.log(`[Automation Processor] Scheduled recurrence ${currentOccurrence + 1} for email ${queueItem.id} at ${nextScheduledTime.toISOString()}`);
          } else {
            console.log(`[Automation Processor] Max occurrences (${maxOccurrences}) reached for email ${queueItem.id}`);
          }
        }
        
      } catch (emailError) {
        console.error(`[Automation Processor] Failed to process email ${queueItem.id}:`, emailError);
        
        // Mark as failed
        await supabase
          .from('automation_email_queue')
          .update({
            status: 'failed',
            error_message: emailError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', queueItem.id);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true,
        processed: queuedEmails?.length || 0 
      }),
      { headers: { ...corsHeadersFor(origin), 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[Automation Processor] Error processing automation emails:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeadersFor(origin), 'Content-Type': 'application/json' } }
    );
  }
});
