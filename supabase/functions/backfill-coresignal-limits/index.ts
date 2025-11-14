import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handlePreflight, corsHeadersFor } from '../_shared/mod.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(req)
  if (preflightResponse) return preflightResponse

  const origin = req.headers.get('Origin') ?? undefined
  const corsHeaders = corsHeadersFor(origin)

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the request is from an authenticated platform admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Check if user is platform admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.user_type !== 'platform_admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Only platform admins can run this backfill.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Starting coresignal_usage credit limits backfill...')

    // Get all coresignal_usage records that need updating
    const { data: usageRecords, error: fetchError } = await supabaseAdmin
      .from('coresignal_usage')
      .select('id, tenant_id, search_credits_limit, collect_credits_limit')

    if (fetchError) {
      console.error('Error fetching usage records:', fetchError)
      throw fetchError
    }

    console.log(`Found ${usageRecords?.length || 0} total usage records`)

    let updatedCount = 0
    const errors: any[] = []

    // Process each record
    for (const record of usageRecords || []) {
      try {
        // Get correct limits for this tenant
        const { data: limitsData, error: limitsError } = await supabaseAdmin
          .rpc('get_tenant_credit_limits', { p_tenant_id: record.tenant_id })
          .single()

        if (limitsError) {
          console.error(`Error getting limits for tenant ${record.tenant_id}:`, limitsError)
          errors.push({ tenant_id: record.tenant_id, error: limitsError.message })
          continue
        }

        const correctLimits = limitsData as { search_limit: number; collect_limit: number }

        // Only update if limits are different
        if (
          record.search_credits_limit !== correctLimits.search_limit ||
          record.collect_credits_limit !== correctLimits.collect_limit
        ) {
          const { error: updateError } = await supabaseAdmin
            .from('coresignal_usage')
            .update({
              search_credits_limit: correctLimits.search_limit,
              collect_credits_limit: correctLimits.collect_limit,
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id)

          if (updateError) {
            console.error(`Error updating record ${record.id}:`, updateError)
            errors.push({ record_id: record.id, error: updateError.message })
          } else {
            updatedCount++
            console.log(
              `Updated record ${record.id}: ${record.search_credits_limit}/${record.collect_credits_limit} → ${correctLimits.search_limit}/${correctLimits.collect_limit}`
            )
          }
        }
      } catch (err) {
        console.error(`Error processing record ${record.id}:`, err)
        errors.push({ record_id: record.id, error: String(err) })
      }
    }

    console.log(`Backfill complete. Updated ${updatedCount} records.`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Coresignal credit limits backfill completed',
        updated_count: updatedCount,
        total_records: usageRecords?.length || 0,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Backfill error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
