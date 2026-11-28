import { createClient } from 'npm:@supabase/supabase-js@2'
import { FEED_BOARDS, feedEntries, renderFeed, type FeedBoard, type FeedEntry, type FeedPosting } from '../_shared/jobFeed.ts'

const VIRGILIO_INTERNAL_ORG_ID = '4b8e739f-2b15-487e-8d31-0a2ce765a8ef'

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
    const tenantId = url.searchParams.get('tenant_id')
    const companySlug = url.searchParams.get('company_slug')
    const board = (url.searchParams.get('board') || 'talent') as FeedBoard

    if (!(FEED_BOARDS as readonly string[]).includes(board)) {
      return new Response(JSON.stringify({ error: 'Unknown board' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('[generate-talent-feed] Request params:', { tenantId, companySlug, board })

    if (!tenantId && !companySlug) {
      return new Response(JSON.stringify({ error: 'Missing tenant_id or company_slug parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get tenant by ID or slug
    let tenant: any = null
    if (tenantId) {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, about')
        .eq('id', tenantId)
        .single()
      console.log('[generate-talent-feed] Tenant by ID result:', { data, error })
      tenant = data
    } else if (companySlug) {
      const { data: careersPage, error } = await supabase
        .from('careers_page_settings')
        .select('tenant_id, tenants!inner(id, name, about)')
        .eq('company_slug', companySlug)
        .single()
      console.log('[generate-talent-feed] Tenant by slug result:', { careersPage, error })
      tenant = careersPage?.tenants
    }

    if (!tenant) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if the board integration is enabled
    const { data: integration } = await supabase
      .from('job_board_integrations')
      .select('is_enabled')
      .eq('tenant_id', tenant.id)
      .eq('board_name', board)
      .single()

    if (!integration?.is_enabled) {
      return new Response(JSON.stringify({ error: `${board} integration not enabled` }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Resolve company_slug for direct careers-page URLs (fallback to /p/ if none)
    let resolvedCompanySlug: string | null = companySlug ?? null
    if (!resolvedCompanySlug) {
      const { data: careersRow } = await supabase
        .from('careers_page_settings')
        .select('company_slug')
        .eq('tenant_id', tenant.id)
        .maybeSingle()
      resolvedCompanySlug = careersRow?.company_slug ?? null
    }

    // Fetch active job postings
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

    if (error) {
      console.error('[generate-talent-feed] Error fetching postings:', error)
      return new Response(JSON.stringify({ error: 'Failed to fetch postings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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
    const xml = renderFeed({
      board,
      company: tenant.name,
      entries,
      now,
      talentApply: (postingId) => ({
        postUrl: `${functionsUrl}/talent-apply-webhook?posting_id=${postingId}`,
        questionsUrl: `${functionsUrl}/talent-questions?posting_id=${postingId}`,
      }),
    })

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (error) {
    console.error('Error generating feed:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
