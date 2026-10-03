import { admin, json, linkCors, tenantId, verify } from '../_shared/gioLink.ts'

// Preview only — nothing is reserved; real IDs are assigned on deal-won.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: linkCors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const raw = await req.text()
  if (!(await verify(req, raw))) return json({ error: 'Invalid signature' }, 401)
  let count = 0
  try { count = Number(JSON.parse(raw).count) } catch { return json({ error: 'Invalid JSON' }, 400) }
  if (!Number.isInteger(count) || count < 1 || count > 200) return json({ error: 'count must be 1–200' }, 400)
  const { data, error } = await admin().rpc('next_req_ids', { _tenant_id: tenantId(), _count: count })
  if (error) return json({ error: error.message }, 500)
  return json({ req_ids: data || [] })
})
