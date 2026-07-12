import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JobPosting {
  id: string
  title: string
  slug: string
  description: string
  details: any
  created_at: string
  location: string
  job_type: string
  jobs: {
    id: string
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const tenantId = url.searchParams.get('tenant_id')
    const companySlug = url.searchParams.get('company_slug')
    const board = url.searchParams.get('board') || 'talent'

    const ALLOWED_BOARDS = ['talent', 'jooble', 'adzuna', 'careerjet', 'jobrapido', 'whatjobs', 'juju']
    if (!ALLOWED_BOARDS.includes(board)) {
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
        job_type,
        jobs!inner (id)
      `)
      .eq('tenant_id', tenant.id)
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

    const typedPostings = postings as unknown as JobPosting[]
    console.log('[generate-talent-feed] Found postings:', typedPostings?.length || 0)

    // Extract shared per-job data used by all formats
    const jobData = typedPostings.map(posting => {
      const details = posting.details || {}
      const location = posting.location || ''
      const [city, state, country] = parseLocation(location)
      const jobUrl = `${resolvedCompanySlug ? `https://app.gogio.io/careers/${resolvedCompanySlug}/${posting.slug}` : `https://app.gogio.io/p/${posting.slug}`}?source=${board}`
      const webhookUrl = encodeURIComponent(`${Deno.env.get('SUPABASE_URL')}/functions/v1/talent-apply-webhook?posting_id=${posting.id}`)
      const questionsUrl = encodeURIComponent(`${Deno.env.get('SUPABASE_URL')}/functions/v1/talent-questions?posting_id=${posting.id}`)
      const isRemote = details.location_type === 'remote'
      const salaryPublic = !!(details.show_salary && details.salary_amount)
      return { posting, details, city, state, country, jobUrl, webhookUrl, questionsUrl, isRemote, salaryPublic }
    })

    let xml: string

    if (board === 'whatjobs') {
      const xmlJobs = jobData.map(({ posting, details, city, state, country, jobUrl, isRemote, salaryPublic }) => {
        const salaryStr = salaryPublic
          ? `${details.salary_amount} ${details.salary_currency || 'USD'} / ${details.salary_period || 'year'}`
          : ''
        return `
  <job id="${escapeXml(posting.id)}">
    <id><![CDATA[${posting.id}]]></id>
    <link><![CDATA[${jobUrl}]]></link>
    <title><![CDATA[${posting.title}]]></title>
    <city><![CDATA[${city}]]></city>
    <region><![CDATA[${state}]]></region>
    <state><![CDATA[${state}]]></state>
    <country><![CDATA[${country}]]></country>
    <language><![CDATA[en]]></language>
    <description><![CDATA[${posting.description || ''}]]></description>
    <pubdate><![CDATA[${formatDateDMY(posting.created_at)}]]></pubdate>
    <company><![CDATA[${tenant.name}]]></company>
    ${salaryStr ? `<salary><![CDATA[${salaryStr}]]></salary>` : ''}
    ${posting.job_type ? `<jobtype><![CDATA[${mapJobType(posting.job_type)}]]></jobtype>` : ''}
    ${isRemote ? `<joblocationtype><![CDATA[telecommute]]></joblocationtype>` : ''}
  </job>`
      }).join('\n')

      xml = `<?xml version="1.0" encoding="utf-8"?>
<jobs>
  ${xmlJobs}
</jobs>`
    } else if (board === 'juju') {
      const xmlJobs = jobData.map(({ posting, city, state, country, jobUrl }) => {
        return `
  <job id="${escapeXml(posting.id)}">
    <employer><![CDATA[${tenant.name}]]></employer>
    <title><![CDATA[${posting.title}]]></title>
    <description><![CDATA[${posting.description || ''}]]></description>
    <postingdate>${formatDateYMD(posting.created_at)}</postingdate>
    <joburl><![CDATA[${jobUrl}]]></joburl>
    <location>
      <city><![CDATA[${city}]]></city>
      <state><![CDATA[${state}]]></state>
      <nation><![CDATA[${country}]]></nation>
    </location>
    <type>${mapJujuType(posting.job_type)}</type>
  </job>`
      }).join('\n')

      xml = `<?xml version="1.0" encoding="utf-8"?>
<jobs>
  <jobsource><![CDATA[Gio ATS]]></jobsource>
  <sourceurl><![CDATA[https://app.gogio.io]]></sourceurl>
  <feeddate>${new Date().toISOString()}</feeddate>
  ${xmlJobs}
</jobs>`
    } else {
      // Existing formats: talent, jooble, adzuna, careerjet, jobrapido
      const xmlJobs = jobData.map(({ posting, details, city, state, country, jobUrl, webhookUrl, questionsUrl }) => {
        return `
  <job>
    <referencenumber>${posting.id}</referencenumber>
    <title><![CDATA[${escapeXml(posting.title)}]]></title>
    <company><![CDATA[${escapeXml(tenant.name)}]]></company>
    ${city ? `<city><![CDATA[${escapeXml(city)}]]></city>` : ''}
    ${state ? `<state><![CDATA[${escapeXml(state)}]]></state>` : ''}
    ${country ? `<country><![CDATA[${escapeXml(country)}]]></country>` : ''}
    <dateposted>${posting.created_at}</dateposted>
    <url><![CDATA[${jobUrl}]]></url>
    <description><![CDATA[${posting.description || ''}]]></description>
    ${posting.job_type ? `<jobtype><![CDATA[${mapJobType(posting.job_type)}]]></jobtype>` : ''}
    ${details.location_type ? `<isremote>${details.location_type === 'remote' ? 'yes' : 'no'}</isremote>` : ''}
    ${details.show_salary && details.salary_amount ? `
    <salary>
      <currency>${details.salary_currency || 'USD'}</currency>
      <period>${details.salary_period || 'year'}</period>
      <min>${details.salary_amount}</min>
    </salary>` : ''}
    ${board === 'talent' ? `<talent-apply-data><![CDATA[talent-apply-posturl=${webhookUrl}&talent-apply-questions=${questionsUrl}]]></talent-apply-data>` : ''}
  </job>`
      }).join('\n')

      xml = `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>GoGio</publisher>
  <publisherurl>https://app.gogio.io</publisherurl>
  <lastbuilddate>${new Date().toISOString()}</lastbuilddate>
  ${xmlJobs}
</source>`
    }

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

function parseLocation(location: string): [string, string, string] {
  const parts = location.split(',').map(p => p.trim())
  if (parts.length === 3) return [parts[0], parts[1], parts[2]]
  if (parts.length === 2) return [parts[0], '', parts[1]]
  if (parts.length === 1) return ['', '', parts[0]]
  return ['', '', '']
}

function mapJobType(jobType: string): string {
  const typeMap: Record<string, string> = {
    'full_time': 'Full time',
    'part_time': 'Part time',
    'contract': 'Contract',
    'temporary': 'Temporary',
    'internship': 'Internship'
  }
  return typeMap[jobType] || 'Full time'
}

function mapJujuType(jobType: string): string {
  const typeMap: Record<string, string> = {
    'full_time': 'fulltime',
    'part_time': 'parttime',
    'contract': 'contract',
    'temporary': 'contract',
    'internship': 'parttime'
  }
  return typeMap[jobType] || 'fulltime'
}

function formatDateDMY(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function formatDateYMD(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
