import { admin, json, linkCors, tenantId, verify } from '../_shared/gioLink.ts'

// GET ?company_id=… — signature is computed over the raw query string (e.g. "company_id=<uuid>").
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: linkCors })
  const url = new URL(req.url)
  const raw = req.method === 'GET' ? url.search.replace(/^\?/, '') : await req.text()
  if (!(await verify(req, raw))) return json({ error: 'Invalid signature' }, 401)
  let companyId = url.searchParams.get('company_id')
  if (!companyId && req.method === 'POST') { try { companyId = JSON.parse(raw).company_id } catch { /* */ } }
  if (!companyId || !/^[0-9a-f-]{36}$/i.test(companyId)) return json({ error: 'company_id required' }, 400)

  const db = admin()
  const { data: orgs } = await db.from('organizations').select('id').eq('tenant_id', tenantId()).eq('sales_company_id', companyId)
  const orgIds = (orgs || []).map((o) => o.id)
  if (!orgIds.length) return json([])
  const { data: jobs, error } = await db.from('jobs').select('id, title, status')
    .in('organization_id', orgIds).neq('status', 'archived').is('deleted_at', null).order('created_at', { ascending: false })
  if (error) return json({ error: error.message }, 500)
  const ids = (jobs || []).map((j) => j.id)
  const counts: Record<string, number> = {}
  if (ids.length) {
    const { data: ops } = await db.from('job_openings').select('job_id').in('job_id', ids).is('cancelled_at', null)
    for (const o of ops || []) counts[o.job_id] = (counts[o.job_id] || 0) + 1
  }
  return json((jobs || []).map((j) => ({ ...j, openings_count: counts[j.id] || 0 })))
})
