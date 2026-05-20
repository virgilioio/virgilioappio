// Translate a natural-language candidate search into a partial CandidateFilters
// object + optional free-text query. Returns JSON via Lovable AI Gateway.
import { corsHeadersFor, handlePreflight } from '../_shared/cors.ts'

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

interface FilterOptionLite { value: string; label?: string }
interface OptionsPayload {
  skills?: FilterOptionLite[]
  countries?: FilterOptionLite[]
  cities?: FilterOptionLite[]
  companies?: FilterOptionLite[]
  seniorityLevels?: FilterOptionLite[]
  functionalAreas?: FilterOptionLite[]
  jobs?: FilterOptionLite[]
  stages?: FilterOptionLite[]
  statuses?: FilterOptionLite[]
  sources?: FilterOptionLite[]
}

const SYSTEM = `You translate a recruiter's natural-language candidate query into a JSON object
of structured filters. ONLY use values that are present in the provided "available_options".
If a concept doesn't match any option, leave that array empty rather than inventing values.

Return strict JSON with this shape:
{
  "query": string,                 // free-text remainder to search by name/email/etc
  "skills": string[],              // values from available_options.skills
  "countries": string[],
  "cities": string[],
  "companies": string[],
  "seniorityLevels": string[],
  "functionalAreas": string[],
  "jobs": string[],                // job IDs from available_options.jobs (value)
  "stages": string[],
  "statuses": string[],
  "sources": string[],
  "experienceMin": number | null,
  "experienceMax": number | null,
  "newWithinDays": number | null
}

Never include keys other than the ones listed. Never wrap the output in markdown.`

function buildOptionsHint(opts: OptionsPayload): string {
  const parts: string[] = []
  const dump = (label: string, arr?: FilterOptionLite[]) => {
    if (!arr?.length) return
    parts.push(`${label}: ${arr.slice(0, 50).map(o => o.label ?? o.value).join(', ')}`)
  }
  dump('skills', opts.skills)
  dump('countries', opts.countries)
  dump('cities', opts.cities)
  dump('companies', opts.companies)
  dump('seniorityLevels', opts.seniorityLevels)
  dump('functionalAreas', opts.functionalAreas)
  dump('stages', opts.stages)
  dump('statuses', opts.statuses)
  dump('sources', opts.sources)
  if (opts.jobs?.length) parts.push(`jobs (use value for jobs[]): ${opts.jobs.slice(0, 30).map(j => `${j.label}=${j.value}`).join('; ')}`)
  return parts.join('\n')
}

Deno.serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req.headers.get('origin') ?? undefined)
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { prompt, options } = await req.json().catch(() => ({}))
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'prompt is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const optionsHint = buildOptionsHint((options ?? {}) as OptionsPayload)

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `available_options:\n${optionsHint || '(none)'}\n\nuser_query: ${prompt}`,
          },
        ],
      }),
    })

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: 'credits_exhausted' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!resp.ok) {
      const text = await resp.text()
      return new Response(JSON.stringify({ error: `gateway_${resp.status}`, detail: text.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = await resp.json()
    const raw = payload?.choices?.[0]?.message?.content ?? '{}'
    let parsed: any = {}
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw } catch { parsed = {} }

    // Whitelist keys.
    const result = {
      query: typeof parsed.query === 'string' ? parsed.query : '',
      skills: Array.isArray(parsed.skills) ? parsed.skills.filter((s: any) => typeof s === 'string') : [],
      countries: Array.isArray(parsed.countries) ? parsed.countries.filter((s: any) => typeof s === 'string') : [],
      cities: Array.isArray(parsed.cities) ? parsed.cities.filter((s: any) => typeof s === 'string') : [],
      companies: Array.isArray(parsed.companies) ? parsed.companies.filter((s: any) => typeof s === 'string') : [],
      seniorityLevels: Array.isArray(parsed.seniorityLevels) ? parsed.seniorityLevels.filter((s: any) => typeof s === 'string') : [],
      functionalAreas: Array.isArray(parsed.functionalAreas) ? parsed.functionalAreas.filter((s: any) => typeof s === 'string') : [],
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs.filter((s: any) => typeof s === 'string') : [],
      stages: Array.isArray(parsed.stages) ? parsed.stages.filter((s: any) => typeof s === 'string') : [],
      statuses: Array.isArray(parsed.statuses) ? parsed.statuses.filter((s: any) => typeof s === 'string') : [],
      sources: Array.isArray(parsed.sources) ? parsed.sources.filter((s: any) => typeof s === 'string') : [],
      experienceMin: typeof parsed.experienceMin === 'number' ? parsed.experienceMin : null,
      experienceMax: typeof parsed.experienceMax === 'number' ? parsed.experienceMax : null,
      newWithinDays: typeof parsed.newWithinDays === 'number' ? parsed.newWithinDays : null,
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('candidates-nl-search error', e)
    return new Response(JSON.stringify({ error: 'internal', detail: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
