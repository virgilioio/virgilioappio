// Refresh foreign-exchange rates from Frankfurter (ECB-backed, free, no key).
// For every tenant, fetches today's rate of every currency that has been used
// (in deals or deal_payments) against that tenant's base currency, and inserts
// a row into public.currency_rates with source='auto'.
// Idempotent thanks to the unique index (tenant, base, quote, date, source).
// After upserting rates, calls public.recompute_open_deals_base() per tenant
// so kanban totals reflect today's rate immediately.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FrankfurterResponse {
  amount: number
  base: string
  date: string
  rates: Record<string, number>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  try {
    // 1. Find all distinct tenants and the currencies they actually use.
    const { data: tenants, error: tErr } = await supabase
      .from('tenants')
      .select('id, settings')
    if (tErr) throw tErr

    const today = new Date().toISOString().slice(0, 10)
    let totalInserts = 0
    const tenantSummaries: Array<{ tenant_id: string; base: string; quotes: string[]; inserted: number }> = []

    for (const t of tenants ?? []) {
      const base: string = (t.settings as any)?.base_currency || 'USD'

      // Collect distinct currencies used by this tenant
      const [{ data: dealRows }, { data: payRows }] = await Promise.all([
        supabase.from('deals').select('currency').eq('tenant_id', t.id),
        supabase.from('deal_payments').select('currency').eq('tenant_id', t.id),
      ])
      const used = new Set<string>()
      ;(dealRows ?? []).forEach((r: any) => r.currency && used.add(String(r.currency).toUpperCase()))
      ;(payRows ?? []).forEach((r: any) => r.currency && used.add(String(r.currency).toUpperCase()))
      // Always include common ones so the Settings UI has something to show
      ;['USD', 'EUR', 'MXN', 'GBP'].forEach((c) => used.add(c))
      used.delete(base.toUpperCase())

      if (used.size === 0) {
        tenantSummaries.push({ tenant_id: t.id, base, quotes: [], inserted: 0 })
        continue
      }

      // Fetch from Frankfurter: base = tenant base, symbols = used currencies
      const symbols = Array.from(used).join(',')
      const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbols)}`
      const fxRes = await fetch(url)
      if (!fxRes.ok) {
        console.error(`Frankfurter ${fxRes.status} for tenant ${t.id} base=${base}`)
        continue
      }
      const fx = (await fxRes.json()) as FrankfurterResponse

      const rows = Object.entries(fx.rates).map(([quote, rate]) => ({
        tenant_id: t.id,
        base_currency: base,
        quote_currency: quote,
        rate,
        rate_date: fx.date ?? today,
        source: 'auto' as const,
      }))

      if (rows.length === 0) continue

      const { error: upErr } = await supabase
        .from('currency_rates')
        .upsert(rows, { onConflict: 'tenant_id,base_currency,quote_currency,rate_date,source' })
      if (upErr) {
        console.error('Upsert failed for tenant', t.id, upErr)
        continue
      }
      totalInserts += rows.length
      tenantSummaries.push({ tenant_id: t.id, base, quotes: Object.keys(fx.rates), inserted: rows.length })

      // Refresh open-deal totals so the kanban reflects new rate immediately
      await supabase.rpc('recompute_open_deals_base', { p_tenant_id: t.id })
    }

    return new Response(
      JSON.stringify({
        ok: true,
        date: today,
        tenants_processed: tenantSummaries.length,
        rows_upserted: totalInserts,
        details: tenantSummaries,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('refresh-fx-rates fatal', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
