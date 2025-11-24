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
  tenants: {
    id: string
    name: string
    about: string
    website_url: string
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
      const { data } = await supabase
        .from('tenants')
        .select('id, name, about, website_url')
        .eq('id', tenantId)
        .single()
      tenant = data
    } else if (companySlug) {
      const { data: careersPage } = await supabase
        .from('careers_page_settings')
        .select('tenant_id, tenants!inner(id, name, about, website_url)')
        .eq('company_slug', companySlug)
        .single()
      tenant = careersPage?.tenants
    }

    if (!tenant) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if Talent.com integration is enabled
    const { data: integration } = await supabase
      .from('job_board_integrations')
      .select('is_enabled')
      .eq('tenant_id', tenant.id)
      .eq('board_name', 'talent')
      .single()

    if (!integration?.is_enabled) {
      return new Response(JSON.stringify({ error: 'Talent.com integration not enabled' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
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
        jobs!inner (id),
        tenants!inner (id, name, about, website_url)
      `)
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .eq('publish_to_talent', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching postings:', error)
      return new Response(JSON.stringify({ error: 'Failed to fetch postings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const typedPostings = postings as unknown as JobPosting[]

    // Generate XML feed
    const xmlJobs = typedPostings.map(posting => {
      const details = posting.details || {}
      const location = posting.location || ''
      const [city, state, country] = parseLocation(location)
      
      const webhookUrl = encodeURIComponent(`${Deno.env.get('SUPABASE_URL')}/functions/v1/talent-apply-webhook?posting_id=${posting.id}`)
      const questionsUrl = encodeURIComponent(`${Deno.env.get('SUPABASE_URL')}/functions/v1/talent-questions?posting_id=${posting.id}`)

      return `
  <job>
    <referencenumber>${posting.id}</referencenumber>
    <title><![CDATA[${escapeXml(posting.title)}]]></title>
    <company><![CDATA[${escapeXml(tenant.name)}]]></company>
    ${city ? `<city><![CDATA[${escapeXml(city)}]]></city>` : ''}
    ${state ? `<state><![CDATA[${escapeXml(state)}]]></state>` : ''}
    ${country ? `<country><![CDATA[${escapeXml(country)}]]></country>` : ''}
    <dateposted>${posting.created_at}</dateposted>
    <url><![CDATA[https://app.virgilio.io/p/${posting.slug}?source=talent]]></url>
    <description><![CDATA[${posting.description || ''}]]></description>
    ${posting.job_type ? `<jobtype><![CDATA[${mapJobType(posting.job_type)}]]></jobtype>` : ''}
    ${details.location_type ? `<isremote>${details.location_type === 'remote' ? 'yes' : 'no'}</isremote>` : ''}
    ${details.show_salary && details.salary_amount ? `
    <salary>
      <currency>${details.salary_currency || 'USD'}</currency>
      <period>${details.salary_period || 'year'}</period>
      <min>${details.salary_amount}</min>
    </salary>` : ''}
    <talent-apply-data><![CDATA[talent-apply-posturl=${webhookUrl}&talent-apply-questions=${questionsUrl}]]></talent-apply-data>
  </job>`
    }).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>Virgilio ATS</publisher>
  <publisherurl>https://app.virgilio.io</publisherurl>
  <lastbuilddate>${new Date().toISOString()}</lastbuilddate>
  ${xmlJobs}
</source>`

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8'
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
