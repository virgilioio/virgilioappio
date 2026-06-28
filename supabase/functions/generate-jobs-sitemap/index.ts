import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BASE_URL = 'https://app.gogio.io'

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const VIRGILIO_INTERNAL_ORG_ID = '4b8e739f-2b15-487e-8d31-0a2ce765a8ef'

interface PostingRow {
  slug: string
  updated_at: string | null
  jobs: { organization_id: string | null; status: string } | null
}

interface CareersRow {
  organization_id: string
  company_slug: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: postings, error } = await supabase
      .from('job_postings')
      .select('slug, updated_at, jobs!inner(organization_id, status)')
      .eq('is_active', true)
      .eq('jobs.status', 'open')
      .filter('syndication->google_jobs->>enabled', 'eq', 'true')
      .limit(50000)

    if (error) {
      console.error('sitemap query failed', error)
      return new Response('error', { status: 500, headers: corsHeaders })
    }

    const rows = (postings ?? []) as unknown as PostingRow[]
    const orgIds = Array.from(
      new Set(
        rows
          .map((r) => r.jobs?.organization_id)
          .filter((v): v is string => !!v && v !== VIRGILIO_INTERNAL_ORG_ID),
      ),
    )

    const slugMap = new Map<string, string>()
    if (orgIds.length) {
      const { data: careers } = await supabase
        .from('careers_page_settings')
        .select('organization_id, company_slug')
        .in('organization_id', orgIds)
      ;((careers ?? []) as CareersRow[]).forEach((c) => {
        if (c.company_slug) slugMap.set(c.organization_id, c.company_slug)
      })
    }

    const urls: string[] = []
    for (const row of rows) {
      const orgId = row.jobs?.organization_id
      let path: string
      if (orgId === VIRGILIO_INTERNAL_ORG_ID) {
        path = `/virgilio-careers/${row.slug}`
      } else {
        const companySlug = orgId ? slugMap.get(orgId) : null
        path = companySlug ? `/careers/${companySlug}/${row.slug}` : `/p/${row.slug}`
      }
      const loc = `${BASE_URL}${path}`
      const lastmod = row.updated_at ? row.updated_at.slice(0, 10) : null
      urls.push(
        [
          '  <url>',
          `    <loc>${xmlEscape(loc)}</loc>`,
          lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
          '    <changefreq>weekly</changefreq>',
          '  </url>',
        ]
          .filter(Boolean)
          .join('\n'),
      )
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls,
      '</urlset>',
    ].join('\n')

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('sitemap fatal', err)
    return new Response('error', { status: 500, headers: corsHeaders })
  }
})
