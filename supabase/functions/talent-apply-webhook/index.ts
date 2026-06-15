import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const postingId = url.searchParams.get('posting_id')

    if (!postingId) {
      return new Response(JSON.stringify({ error: 'Missing posting_id parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify posting exists and get context
    const { data: posting, error: postingError } = await supabase
      .from('job_postings')
      .select('id, job_id, tenant_id')
      .eq('id', postingId)
      .single()

    if (postingError || !posting) {
      return new Response(JSON.stringify({ error: 'Invalid posting_id' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse application payload
    const payload = await req.json()
    const { applicant, customFields = [], id: talentApplicationId } = payload

    console.log('Received Talent.com application:', { talentApplicationId, postingId })

    // Split full name
    const nameParts = (applicant.fullName || '').trim().split(' ')
    const candidateName = applicant.fullName || 'Unknown Applicant'

    // Handle resume upload
    let resumeUrl = null
    if (applicant.resume) {
      try {
        // Decode base64 resume
        const resumeData = Uint8Array.from(atob(applicant.resume), c => c.charCodeAt(0))
        const resumeFileName = `talent-${talentApplicationId}-${Date.now()}.pdf`
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(`${posting.tenant_id}/${resumeFileName}`, resumeData, {
            contentType: 'application/pdf',
            upsert: false
          })

        if (uploadError) {
          console.error('Resume upload error:', uploadError)
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('resumes')
            .getPublicUrl(uploadData.path)
          resumeUrl = publicUrl
        }
      } catch (error) {
        console.error('Error processing resume:', error)
      }
    }

    // Check for existing candidate
    const { data: existingCandidate } = await supabase
      .from('candidates')
      .select('id')
      .eq('email', applicant.email)
      .eq('tenant_id', posting.tenant_id)
      .maybeSingle()

    let candidateId: string

    if (existingCandidate) {
      // Update existing candidate
      const updateData: any = {
        updated_at: new Date().toISOString()
      }
      if (resumeUrl) updateData.resume_url = resumeUrl
      if (applicant.phoneNumber) updateData.phone = applicant.phoneNumber

      const { data: updated } = await supabase
        .from('candidates')
        .update(updateData)
        .eq('id', existingCandidate.id)
        .select()
        .single()

      candidateId = updated.id
      console.log('Updated existing candidate:', candidateId)
    } else {
      // Create new candidate
      const { data: newCandidate } = await supabase
        .from('candidates')
        .insert({
          candidate_name: candidateName,
          email: applicant.email,
          phone: applicant.phoneNumber || null,
          resume_url: resumeUrl,
          source: 'talent.com',
          job_board_source: 'talent.com',
          external_application_id: talentApplicationId,
          tenant_id: posting.tenant_id,
          created_by: null
        })
        .select()
        .single()

      candidateId = newCandidate.id
      console.log('Created new candidate:', candidateId)

      // Fire-and-forget background AI enrichment (skills + profile summary)
      // Mirrors public-submit-application flow. parse-resume expects extracted
      // textContent (not a URL), so we delegate enrichment to enrich-candidate-profile,
      // which handles fetching/parsing the resume and writes back to the candidate.
      supabase.functions.invoke('enrich-candidate-profile', {
        body: {
          candidateId,
          resumeUrl,
          resumeText: '',
          candidateName,
        }
      }).catch(err => console.error('Background enrichment call failed:', err))
      console.log('🧠 Triggered background enrichment for candidate:', candidateId)

      // Fire-and-forget: pre-generate AI fit insights
      try {
        const fitUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-candidate-fit`
        fetch(fitUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ candidate_id: candidateId, job_id: posting.job_id }),
        }).catch(() => {})
        console.log('🔮 Triggered AI fit analysis for candidate:', candidateId)
      } catch {}
    }

    // Get first stage of job's hiring pipeline
    const { data: firstStage } = await supabase
      .from('job_hiring_stages')
      .select('id')
      .eq('job_id', posting.job_id)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle()

    // Create job-candidate association
    const { data: association } = await supabase
      .from('job_candidate_associations')
      .insert({
        job_id: posting.job_id,
        candidate_id: candidateId,
        current_stage_id: firstStage?.id || null,
        status: 'new',
        entered_stage_at: new Date().toISOString()
      })
      .select()
      .single()

    console.log('Created job association:', association.id)

    // Store screening question responses
    if (customFields.length > 0) {
      const responses = customFields.map((field: any) => ({
        candidate_id: candidateId,
        job_id: posting.job_id,
        posting_id: posting.id,
        field_name: field.id,
        field_label: field.question,
        field_value: field.answer,
        field_type: 'textarea',
        created_at: new Date().toISOString()
      }))

      await supabase
        .from('candidate_application_responses')
        .insert(responses)

      console.log(`Stored ${responses.length} screening question responses`)
    }

    // Create activity log
    await supabase
      .from('activities')
      .insert({
        tenant_id: posting.tenant_id,
        user_id: null,
        activity_type: 'candidate_applied',
        title: 'New Application from Talent.com',
        description: `${candidateName} applied via Talent.com`,
        entity_type: 'candidate',
        entity_id: candidateId,
        metadata: {
          candidate_id: candidateId,
          job_id: posting.job_id,
          source: 'talent.com',
          application_id: talentApplicationId
        }
      })

    return new Response(JSON.stringify({
      success: true,
      candidate_id: candidateId,
      association_id: association.id,
      message: 'Application received and processed'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Talent webhook error:', error)

    // Log failed application
    try {
      const url = new URL(req.url)
      const postingId = url.searchParams.get('posting_id')
      const payload = await req.text()

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      await supabase
        .from('failed_job_board_applications')
        .insert({
          board_name: 'talent.com',
          posting_id: postingId,
          payload: JSON.parse(payload),
          error_message: error.message,
          created_at: new Date().toISOString()
        })
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    return new Response(JSON.stringify({
      error: 'Failed to process application',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
