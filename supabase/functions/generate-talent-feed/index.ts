import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { FEED_BOARDS, feedEntries, renderFeed, type FeedBoard, type FeedEntry, type FeedPosting } from '../_shared/jobFeed.ts'
import { FEED_BUCKET, FEED_CONTENT_TYPE, feedFilePath, feedFileUrl } from '../_shared/jobFeedFile.ts'

// A workspace's job-board feed (Talent.com and the boards in FEED_BOARDS).
//
// Supabase serves this function's responses as text/plain on *.supabase.co,
// whatever Content-Type it sets, and boards want application/xml (2026-11-27).
// So the feed is also kept as a file in the public bucket `job-feeds`, which
// Storage serves as application/xml (see _shared/jobFeedFile.ts):
//   GET  ?tenant_id=… [&board=…]  builds the feed (or reuses a file written in
//        the last 15 minutes), writes the file and redirects to it; if the file
//        can't be written the XML is answered here as before.
//   POST with x-internal-secret     rewrites every enabled board's file
//        (pg_cron 'job-feeds-refresh', hourly).

const VIRGILIO_INTERNAL_ORG_ID = '4b8e739f-2b15-487e-8d31-0a2ce765a8ef'
const REUSE_MS = 15 * 60 * 1000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

type Tenant = { id: string; name: string }

async function findTenant(supabase: SupabaseClient, tenantId: string | null, companySlug: string | null): Promise<Tenant | null> {
  if (tenantId) {
    const { data } = await supabase.from('tenants').select('id, name').eq('id', tenantId).maybeSingle()
    return (data as Tenant | null) ?? null
  }
  if (companySlug) {
    const { data } = await supabase
      .from('careers_page_settings')
      .select('tenant_id, tenants!inner(id, name)')
      .eq('company_slug', companySlug)
      .maybeSingle()
    return ((data as { tenants?: Tenant } | null)?.tenants) ?? null
  }
  return null
}

async function boardEnabled(supabase: SupabaseClient, tenantId: string, board: FeedBoard) {
  const { data } = await supabase
    .from('job_board_integrations')
    .select('is_enabled')
    .eq('tenant_id', tenantId)
    .eq('board_name', board)
    .maybeSingle()
  return !!(data as { is_enabled?: boolean } | null)?.is_enabled
}

async function buildFeed(supabase: SupabaseClient, tenant: Tenant, board: FeedBoard, companySlug: string | null): Promise<string> {
  // Resolve company_slug for direct careers-page URLs (fallback to /p/ if none)
  let resolvedCompanySlug: string | null = companySlug
  if (!resolvedCompanySlug) {
    const { data: careersRow } = await supabase
      .from('careers_page_settings')
      .select('company_slug')
      .eq('tenant_id', tenant.id)
      .maybeSingle()
    resolvedCompanySlug = (careersRow as { company_slug?: string } | null)?.company_slug ?? null
  }

  const { data: postings, error } = await supabase
    .from('job_postings')
    .select(`
      id,
      title,
      slug,
      description,
      details,
      created_at,
      location,
      jobs!inner (id, status, organization_id)
    `)
    .eq('tenant_id', tenant.id)
    .eq('jobs.status', 'open') // drafts/closed jobs never reach job boards
    .eq('is_active', true)
    .eq('publish_to_talent', true)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to fetch postings: ${error.message}`)

  // One entry per place a board can list. A post with nothing to read, or that
  // names no country, is held back (2026-11-26): boards can't place "Remote".
  const now = new Date()
  const entries: FeedEntry[] = []
  const held: Record<string, number> = {}
  for (const posting of (postings ?? []) as unknown as FeedPosting[]) {
    // The address the sitemap lists and the page calls its own (generate-jobs-sitemap).
    const orgId = (posting as unknown as { jobs?: { organization_id?: string | null } }).jobs?.organization_id
    const jobUrl = orgId === VIRGILIO_INTERNAL_ORG_ID
      ? `https://app.gogio.io/virgilio-careers/${posting.slug}`
      : resolvedCompanySlug
        ? `https://app.gogio.io/careers/${resolvedCompanySlug}/${posting.slug}`
        : `https://app.gogio.io/p/${posting.slug}`
    const out = feedEntries(posting, { board, jobUrl, now })
    if (out.held) held[out.held] = (held[out.held] ?? 0) + 1
    entries.push(...out.entries)
  }
  console.log('[generate-talent-feed] feed built:', { board, posts: postings?.length ?? 0, entries: entries.length, held })

  const functionsUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1`
  return renderFeed({
    board,
    company: tenant.name,
    entries,
    now,
    talentApply: (postingId) => ({
      postUrl: `${functionsUrl}/talent-apply-webhook?posting_id=${postingId}`,
      questionsUrl: `${functionsUrl}/talent-questions?posting_id=${postingId}`,
    }),
  })
}

/** Writes the feed's file; returns its address, or null when it couldn't be written. */
async function storeFeed(supabase: SupabaseClient, board: FeedBoard, tenantId: string, xml: string): Promise<string | null> {
  const path = feedFilePath(board, tenantId)
  const url = feedFileUrl(Deno.env.get('SUPABASE_URL') ?? '', board, tenantId)
  if (!path || !url) return null
  const { error } = await supabase.storage.from(FEED_BUCKET).upload(
    path,
    // Bytes, not a Blob: a Blob goes as a form upload and the type rides on its part.
    new TextEncoder().encode(xml),
    { contentType: FEED_CONTENT_TYPE, upsert: true, cacheControl: '300' },
  )
  if (error) {
    console.error('[generate-talent-feed] could not write the feed file:', { board, path, error: error.message })
    return null
  }
  return url
}

/** The file's address when it was written in the last 15 minutes. */
async function recentFile(supabase: SupabaseClient, board: FeedBoard, tenantId: string): Promise<string | null> {
  const path = feedFilePath(board, tenantId)
  if (!path) return null
  const name = path.slice(board.length + 1)
  const { data } = await supabase.storage.from(FEED_BUCKET).list(board, { search: name, limit: 5 })
  const file = (data ?? []).find((f) => f.name === name)
  const at = file?.updated_at ? Date.parse(file.updated_at) : NaN
  if (!Number.isFinite(at) || Date.now() - at > REUSE_MS) return null
  return feedFileUrl(Deno.env.get('SUPABASE_URL') ?? '', board, tenantId)
}

const redirectTo = (url: string) =>
  new Response(null, { status: 302, headers: { ...corsHeaders, Location: url, 'Cache-Control': 'no-store' } })

/** pg_cron: rewrite every enabled board's file. */
async function refreshAll(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('job_board_integrations')
    .select('tenant_id, board_name')
    .eq('is_enabled', true)
  if (error) throw new Error(`Failed to read integrations: ${error.message}`)
  let written = 0
  const failed: string[] = []
  for (const row of (data ?? []) as { tenant_id: string; board_name: string }[]) {
    if (!(FEED_BOARDS as readonly string[]).includes(row.board_name)) continue
    const board = row.board_name as FeedBoard
    try {
      const tenant = await findTenant(supabase, row.tenant_id, null)
      if (!tenant) { failed.push(`${board}:no-workspace`); continue }
      const xml = await buildFeed(supabase, tenant, board, null)
      if (await storeFeed(supabase, board, tenant.id, xml)) written++
      else failed.push(`${board}:write`)
    } catch (e) {
      console.error('[generate-talent-feed] refresh failed:', { board, error: (e as Error).message })
      failed.push(`${board}:build`)
    }
  }
  console.log('[generate-talent-feed] refresh:', { written, failed })
  return { written, failed }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    if (req.method === 'POST') {
      const expected = Deno.env.get('INTERNAL_FUNCTION_SECRET')
      if (!expected || req.headers.get('x-internal-secret') !== expected) return json(401, { error: 'unauthorized' })
      return json(200, await refreshAll(supabase))
    }

    const url = new URL(req.url)
    const tenantId = url.searchParams.get('tenant_id')
    const companySlug = url.searchParams.get('company_slug')
    const board = (url.searchParams.get('board') || 'talent') as FeedBoard

    if (!(FEED_BOARDS as readonly string[]).includes(board)) return json(400, { error: 'Unknown board' })
    if (!tenantId && !companySlug) return json(400, { error: 'Missing tenant_id or company_slug parameter' })

    const tenant = await findTenant(supabase, tenantId, companySlug)
    if (!tenant) return json(404, { error: 'Tenant not found' })
    if (!(await boardEnabled(supabase, tenant.id, board))) return json(403, { error: `${board} integration not enabled` })

    const recent = await recentFile(supabase, board, tenant.id)
    if (recent) return redirectTo(recent)

    const xml = await buildFeed(supabase, tenant, board, companySlug)
    const stored = await storeFeed(supabase, board, tenant.id, xml)
    if (stored) return redirectTo(stored)

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': FEED_CONTENT_TYPE,
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (error) {
    console.error('Error generating feed:', error)
    return json(500, { error: 'Failed to build the feed' })
  }
})
