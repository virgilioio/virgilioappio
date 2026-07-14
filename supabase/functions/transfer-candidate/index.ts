import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TransferRequest {
  candidateId: string
  sourceJobId: string
  targetJobId: string
  targetStageId?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const { candidateId, sourceJobId, targetJobId, targetStageId }: TransferRequest = await req.json()

    console.log('[Transfer] Starting transfer:', { candidateId, sourceJobId, targetJobId, targetStageId })

    // 1. Validate source association exists
    const { data: sourceAssociation, error: sourceError } = await supabaseClient
      .from('job_candidate_associations')
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('job_id', sourceJobId)
      .single()

    if (sourceError || !sourceAssociation) {
      throw new Error('Source association not found')
    }

    console.log('[Transfer] Source association found:', sourceAssociation.id)

    // 2. Build stage mapping between source and target jobs
    const { data: sourceStages } = await supabaseClient
      .from('job_hiring_stages')
      .select('id, stage_id, position')
      .eq('job_id', sourceJobId)

    const { data: targetStages } = await supabaseClient
      .from('job_hiring_stages')
      .select('id, stage_id, position')
      .eq('job_id', targetJobId)

    // Map source stage IDs to target stage IDs (matching by stage_id)
    const stageMapping = new Map<string, string>()
    for (const source of sourceStages || []) {
      const target = targetStages?.find(t => t.stage_id === source.stage_id)
      if (target) {
        stageMapping.set(source.id, target.id)
      }
    }
    console.log('[Transfer] Stage mapping built:', stageMapping.size, 'mappings')

    // 3. Check if candidate already exists in target job — if so, merge into it
    const { data: existingAssociation } = await supabaseClient
      .from('job_candidate_associations')
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('job_id', targetJobId)
      .maybeSingle()

    let newAssociation: { id: string } & Record<string, unknown>

    if (existingAssociation) {
      // Merge path: reuse the existing target association. Optionally update
      // its current_stage_id to the stage the user picked in the dialog.
      if (targetStageId) {
        const { data: updated, error: updateStageError } = await supabaseClient
          .from('job_candidate_associations')
          .update({ current_stage_id: targetStageId })
          .eq('id', existingAssociation.id)
          .select()
          .single()
        if (updateStageError || !updated) {
          console.error('[Transfer] Failed to update existing association stage:', updateStageError)
          throw new Error('Failed to update stage on existing target association')
        }
        newAssociation = updated
      } else {
        newAssociation = existingAssociation as typeof newAssociation
      }
      console.log('[Transfer] Merged into existing target association:', newAssociation.id)
    } else {
      // Create new association in target job
      const { data: created, error: newAssocError } = await supabaseClient
        .from('job_candidate_associations')
        .insert({
          candidate_id: candidateId,
          job_id: targetJobId,
          current_stage_id: targetStageId || null,
          added_by: user.id,
          notes: sourceAssociation.notes,
          status: sourceAssociation.status
        })
        .select()
        .single()

      if (newAssocError || !created) {
        console.error('[Transfer] Failed to create new association:', newAssocError)
        throw new Error('Failed to create association in target job')
      }
      newAssociation = created
      console.log('[Transfer] New association created:', newAssociation.id)
    }

    // 4. Transfer comments
    const { error: commentsError } = await supabaseClient
      .from('candidate_comments')
      .update({ job_id: targetJobId })
      .eq('candidate_id', candidateId)
      .eq('job_id', sourceJobId)

    if (commentsError) {
      console.error('[Transfer] Failed to transfer comments:', commentsError)
    } else {
      console.log('[Transfer] Comments transferred')
    }

    // 5. Transfer email logs
    const { error: emailsError } = await supabaseClient
      .from('email_logs')
      .update({ job_id: targetJobId })
      .eq('candidate_id', candidateId)
      .eq('job_id', sourceJobId)

    if (emailsError) {
      console.error('[Transfer] Failed to transfer emails:', emailsError)
    } else {
      console.log('[Transfer] Email logs transferred')
    }

    // 6. Transfer scorecards (update job_id, association_id, and stage_instance_id)
    const { data: scorecards } = await supabaseClient
      .from('job_stage_scorecards')
      .select('id, stage_instance_id')
      .eq('candidate_id', candidateId)
      .eq('job_id', sourceJobId)

    if (scorecards && scorecards.length > 0) {
      for (const scorecard of scorecards) {
        const newStageId = stageMapping.get(scorecard.stage_instance_id)
        await supabaseClient
          .from('job_stage_scorecards')
          .update({ 
            job_id: targetJobId,
            association_id: newAssociation.id,
            stage_instance_id: newStageId || scorecard.stage_instance_id
          })
          .eq('id', scorecard.id)
      }
      console.log('[Transfer] Scorecards transferred:', scorecards.length)
    } else {
      console.log('[Transfer] No scorecards to transfer')
    }

    // 7. Transfer activities
    const { data: activities, error: activitiesError } = await supabaseClient
      .from('activities')
      .select('*')
      .eq('entity_type', 'job_candidate_association')
      .eq('entity_id', sourceAssociation.id)

    if (activities && activities.length > 0) {
      for (const activity of activities) {
        await supabaseClient
          .from('activities')
          .update({ 
            entity_id: newAssociation.id,
            metadata: { 
              ...activity.metadata,
              job_id: targetJobId,
              transferred_from_job_id: sourceJobId,
              transferred_at: new Date().toISOString()
            }
          })
          .eq('id', activity.id)
      }
      console.log('[Transfer] Activities transferred:', activities.length)
    }

    // 8. Transfer scheduled bookings (update job_id, association_id, and job_hiring_stage_id)
    const { data: bookings } = await supabaseClient
      .from('scheduled_bookings')
      .select('id, job_hiring_stage_id')
      .eq('job_candidate_association_id', sourceAssociation.id)

    if (bookings && bookings.length > 0) {
      for (const booking of bookings) {
        const newStageId = stageMapping.get(booking.job_hiring_stage_id)
        await supabaseClient
          .from('scheduled_bookings')
          .update({ 
            job_id: targetJobId,
            job_candidate_association_id: newAssociation.id,
            job_hiring_stage_id: newStageId || booking.job_hiring_stage_id
          })
          .eq('id', booking.id)
      }
      console.log('[Transfer] Scheduled bookings transferred:', bookings.length)
    } else {
      console.log('[Transfer] No scheduled bookings to transfer')
    }

    // 9. Delete source association
    const { error: deleteError } = await supabaseClient
      .from('job_candidate_associations')
      .delete()
      .eq('id', sourceAssociation.id)

    if (deleteError) {
      console.error('[Transfer] Failed to delete source association:', deleteError)
      throw new Error('Failed to remove candidate from source job')
    }

    console.log('[Transfer] Source association deleted')
    console.log('[Transfer] Transfer completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        newAssociationId: newAssociation.id,
        message: 'Candidate transferred successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('[Transfer] Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
