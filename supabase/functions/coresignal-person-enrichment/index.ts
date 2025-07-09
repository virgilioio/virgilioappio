import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EnrichmentRequest {
  candidateId: string
  searchQuery?: {
    email?: string
    linkedin_url?: string
    full_name?: string
    company?: string
  }
}

serve(async (req) => {
  console.log('Function invoked with method:', req.method)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { candidateId, searchQuery }: EnrichmentRequest = await req.json()

    if (!candidateId) {
      throw new Error('Candidate ID is required')
    }

    // Get candidate data
    const { data: candidate, error: candidateError } = await supabaseClient
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single()

    if (candidateError || !candidate) {
      throw new Error('Candidate not found')
    }

    // Check if already enriched recently (within 30 days)
    if (candidate.enriched_at) {
      const enrichedDate = new Date(candidate.enriched_at)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      if (enrichedDate > thirtyDaysAgo) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Candidate already enriched recently',
            enriched_at: candidate.enriched_at 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const coresignalApiKey = Deno.env.get('CORESIGNAL_API_KEY')
    if (!coresignalApiKey) {
      throw new Error('CoreSignal API key not configured')
    }

    // Build search parameters
    const searchParams = new URLSearchParams()
    
    if (searchQuery?.email || candidate.email) {
      searchParams.append('email', searchQuery?.email || candidate.email)
    }
    
    if (searchQuery?.linkedin_url || candidate.linkedin_url) {
      searchParams.append('linkedin_url', searchQuery?.linkedin_url || candidate.linkedin_url)
    }
    
    if (searchQuery?.full_name || candidate.candidate_name) {
      searchParams.append('name', searchQuery?.full_name || candidate.candidate_name)
    }

    if (searchQuery?.company || candidate.company_current) {
      searchParams.append('company', searchQuery?.company || candidate.company_current)
    }

    console.log('Searching CoreSignal with params:', searchParams.toString())

    // Search CoreSignal Person API
    const searchResponse = await fetch(
      `https://api.coresignal.com/cdapi/v1/linkedin/person/search/filter?${searchParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${coresignalApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text()
      console.error('CoreSignal search error:', errorText)
      throw new Error(`CoreSignal API error: ${searchResponse.status}`)
    }

    const searchResults = await searchResponse.json()
    console.log('CoreSignal search results:', searchResults)

    if (!searchResults || searchResults.length === 0) {
      // Log failed enrichment
      await supabaseClient
        .from('candidate_enrichment_logs')
        .insert({
          candidate_id: candidateId,
          enrichment_type: 'coresignal',
          status: 'failed',
          credits_used: 1,
          error_message: 'No matching profiles found',
          processed_by: user.id
        })

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No matching profiles found in CoreSignal' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Take the first (best) match
    const personId = searchResults[0].id
    
    // Get detailed person data
    const collectResponse = await fetch(
      `https://api.coresignal.com/cdapi/v1/linkedin/person/collect/${personId}`,
      {
        headers: {
          'Authorization': `Bearer ${coresignalApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!collectResponse.ok) {
      throw new Error(`CoreSignal collect API error: ${collectResponse.status}`)
    }

    const personData: CoreSignalPerson = await collectResponse.json()
    console.log('CoreSignal person data:', personData)

    // Update candidate with enriched data
    const updateData: any = {
      enrichment_status: 'enriched',
      enriched_at: new Date().toISOString(),
      coresignal_profile_id: personData.id,
      contact_emails: personData.emails || [],
      contact_phones: personData.phones || [],
      bio: personData.bio,
      company_current: personData.company,
      role_current: personData.title,
      years_experience: personData.experience?.length || null,
      social_profiles: {
        linkedin: personData.linkedin_url
      }
    }

    // Update main candidate record
    const { error: updateError } = await supabaseClient
      .from('candidates')
      .update(updateData)
      .eq('id', candidateId)

    if (updateError) {
      console.error('Error updating candidate:', updateError)
      throw new Error('Failed to update candidate data')
    }

    // Insert work experience
    if (personData.experience && personData.experience.length > 0) {
      const workExperience = personData.experience.map((exp, index) => ({
        candidate_id: candidateId,
        company_name: exp.company,
        job_title: exp.title,
        start_date: exp.start_date ? new Date(exp.start_date).toISOString().split('T')[0] : null,
        end_date: exp.end_date ? new Date(exp.end_date).toISOString().split('T')[0] : null,
        is_current: index === 0, // Assume first entry is current
        description: exp.description,
        location: exp.location,
      }))

      const { error: expError } = await supabaseClient
        .from('candidate_work_experience')
        .insert(workExperience)

      if (expError) {
        console.error('Error inserting work experience:', expError)
      }
    }

    // Insert education
    if (personData.education && personData.education.length > 0) {
      const education = personData.education.map(edu => ({
        candidate_id: candidateId,
        institution_name: edu.school,
        degree_type: edu.degree,
        field_of_study: edu.field,
        start_date: edu.start_date ? new Date(edu.start_date).toISOString().split('T')[0] : null,
        end_date: edu.end_date ? new Date(edu.end_date).toISOString().split('T')[0] : null,
      }))

      const { error: eduError } = await supabaseClient
        .from('candidate_education')
        .insert(education)

      if (eduError) {
        console.error('Error inserting education:', eduError)
      }
    }

    // Log successful enrichment
    await supabaseClient
      .from('candidate_enrichment_logs')
      .insert({
        candidate_id: candidateId,
        enrichment_type: 'coresignal',
        status: 'success',
        credits_used: 2, // 1 for search + 1 for collect
        data_found: {
          experience_count: personData.experience?.length || 0,
          education_count: personData.education?.length || 0,
          emails_found: personData.emails?.length || 0,
          phones_found: personData.phones?.length || 0
        },
        processed_by: user.id
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Candidate enriched successfully',
        data: {
          profile_id: personData.id,
          experience_count: personData.experience?.length || 0,
          education_count: personData.education?.length || 0,
          contacts_found: (personData.emails?.length || 0) + (personData.phones?.length || 0)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Enrichment error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})