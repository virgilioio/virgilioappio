// Scheduled function (hourly via pg_cron).
// Expires temporary access grants whose ends_at has passed and re-locks the tenant.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const now = new Date().toISOString()

    const { data: dueGrants, error: fetchErr } = await supabase
      .from('tenant_access_grants')
      .select('id, tenant_id, ends_at')
      .is('revoked_at', null)
      .is('expired_at', null)
      .lte('ends_at', now)

    if (fetchErr) {
      console.error('Failed to fetch due grants:', fetchErr)
      return new Response(
        JSON.stringify({ error: fetchErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: Array<{ tenant_id: string; status: 'expired' | 'error'; error?: string }> = []

    for (const grant of dueGrants ?? []) {
      const { error: expErr } = await supabase
        .from('tenant_access_grants')
        .update({ expired_at: now })
        .eq('id', grant.id)
      if (expErr) {
        console.error('Mark expired failed', grant.id, expErr)
        results.push({ tenant_id: grant.tenant_id, status: 'error', error: expErr.message })
        continue
      }

      const { error: subErr } = await supabase
        .from('tenant_subscriptions')
        .update({ billing_status: 'locked', updated_at: now })
        .eq('tenant_id', grant.tenant_id)
      if (subErr) {
        console.error('Re-lock tenant failed', grant.tenant_id, subErr)
        results.push({ tenant_id: grant.tenant_id, status: 'error', error: subErr.message })
        continue
      }

      try {
        await supabase.rpc('log_audit_event', {
          p_action: 'tenant_access_grant_expired',
          p_table_name: 'tenant_access_grants',
          p_record_id: grant.tenant_id,
          p_user_id: null,
          p_old_values: null,
          p_new_values: { grant_id: grant.id, ends_at: grant.ends_at },
        })
      } catch (auditErr) {
        console.error('Audit log failed', auditErr)
      }

      results.push({ tenant_id: grant.tenant_id, status: 'expired' })
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('expire-access-grants error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
