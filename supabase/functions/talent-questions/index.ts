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

    // Fetch posting
    const { data: posting, error: postingError } = await supabase
      .from('job_postings')
      .select('id, job_id')
      .eq('id', postingId)
      .single()

    if (postingError || !posting) {
      return new Response(JSON.stringify({ error: 'Invalid posting_id' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch custom application fields for this posting
    const { data: fields, error: fieldsError } = await supabase
      .from('job_posting_application_fields')
      .select(`
        id,
        field_name,
        field_label,
        field_type,
        is_required,
        display_order,
        application_fields!inner (
          id,
          field_name,
          field_label,
          field_type,
          is_required
        )
      `)
      .eq('posting_id', postingId)
      .eq('source', 'library')
      .order('display_order', { ascending: true })

    if (fieldsError) {
      console.error('Error fetching fields:', fieldsError)
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Map to Talent.com question format
    const questions = (fields || []).map((field: any) => {
      const af = field.application_fields || {}
      const fieldType = field.field_type || af.field_type

      return {
        id: field.id,
        type: mapFieldTypeToTalentType(fieldType),
        question: field.field_label || af.field_label,
        required: field.is_required ?? false,
        ...(fieldType === 'textarea' && { limit: 500 })
      }
    })

    return new Response(JSON.stringify(questions), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error generating questions:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function mapFieldTypeToTalentType(virgilioType: string): string {
  const typeMap: Record<string, string> = {
    'text': 'text',
    'textarea': 'textarea',
    'email': 'email',
    'phone': 'phone',
    'url': 'url',
    'date': 'date',
    'number': 'number',
    'select': 'select',
    'multi_select': 'multiselect',
    'yes_no': 'select',
    'checkbox': 'checkbox',
    'radio': 'radio'
  }
  return typeMap[virgilioType] || 'text'
}
