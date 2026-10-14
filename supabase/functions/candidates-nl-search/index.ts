// Translate a natural-language candidate search into Candidates-page filters,
// date filters and a few keywords, via the Lovable AI Gateway.
//
// 2026-10-14:
// - Signed-in people only: a valid key alone used to be enough, so anyone with
//   the app's public key could spend AI credits.
// - Every value the model returns is checked against the options the page sent
//   (ignoring case and accents) and mapped to the exact stored value; anything
//   else is dropped instead of becoming a filter that matches nobody.
// - It understands dates ("interviewed in the last two weeks", "applied since
//   March") and pipeline status, and returns only keywords that must appear in
//   a profile as `query`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeadersFor, handlePreflight } from '../_shared/cors.ts'

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

interface FilterOptionLite { value: string; label?: string }
type OptionKey =
  | 'skills' | 'countries' | 'cities' | 'companies' | 'seniorityLevels' | 'functionalAreas'
  | 'jobs' | 'stages' | 'statuses' | 'sources' | 'pipelineStatuses'
type OptionsPayload = Partial<Record<OptionKey, FilterOptionLite[]>>

const DATE_FIELDS = ['added', 'applied', 'added_to_job', 'interview', 'stage_moved', 'offer', 'hired', 'rejected', 'updated'] as const
type DateField = typeof DATE_FIELDS[number]

const CAPS: Record<OptionKey, number> = {
  skills: 150, companies: 100, cities: 100, countries: 60, seniorityLevels: 30, functionalAreas: 40,
  jobs: 50, stages: 50, statuses: 20, sources: 30, pipelineStatuses: 10,
}

function systemPrompt(today: string) {
  return `You turn a recruiter's request for candidates into JSON search filters.
Today is ${today}.

Use ONLY values listed in "available_options" for skills, countries, cities, companies,
seniorityLevels, functionalAreas, jobs (use the id), stages, statuses, sources and
pipelineStatuses. If a concept doesn't match an option, leave that list empty; never invent values.

Dates go in "dates" (at most 3), each:
  { "field": one of ${DATE_FIELDS.join(', ')},
    "withinDays": number | null,   // the last N days
    "nextDays": number | null,     // the next N days (only for upcoming interviews)
    "from": "YYYY-MM-DD" | null, "to": "YYYY-MM-DD" | null }
Meanings: added = added to Gio; applied = applied to a job themselves; added_to_job = put in any
job's pipeline; interview = an interview (past or upcoming); stage_moved = moved stage;
offer / hired / rejected = when that happened; updated = profile last edited.
"Recently" with no number means withinDays 30. "This week" means withinDays 7.

"query" holds only words that must appear in the candidate's profile and aren't already covered
by a filter, such as a job title ("account executive") or a keyword ("SaaS"). Leave out filler
words ("candidates", "people", "who", "with", "show me"). Use "" when nothing is left.

Return strict JSON:
{
  "query": string,
  "skills": string[], "countries": string[], "cities": string[], "companies": string[],
  "seniorityLevels": string[], "functionalAreas": string[], "jobs": string[], "stages": string[],
  "statuses": string[], "sources": string[], "pipelineStatuses": string[],
  "experienceMin": number | null, "experienceMax": number | null,
  "dates": [...]
}
No other keys, no markdown.`
}

const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function buildOptionsHint(opts: OptionsPayload): string {
  const parts: string[] = []
  for (const key of Object.keys(CAPS) as OptionKey[]) {
    const arr = opts[key]
    if (!arr?.length) continue
    const list = arr.slice(0, CAPS[key])
    parts.push(key === 'jobs'
      ? `jobs (use the id): ${list.map((j) => `${j.label ?? j.value} = ${j.value}`).join('; ')}`
      : `${key}: ${list.map((o) => o.label ?? o.value).join(', ')}`)
  }
  return parts.join('\n')
}

/** Keeps only values the page offered, mapped to the exact stored value. */
function pick(raw: unknown, offered: FilterOptionLite[] | undefined): string[] {
  if (!Array.isArray(raw)) return []
  const strings = raw.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
  // The top-bar preview sends no options: show the model's reading as is.
  if (!offered?.length) return strings
  const byKey = new Map<string, string>()
  for (const o of offered) {
    byKey.set(fold(o.value), o.value)
    if (o.label) byKey.set(fold(o.label), o.value)
  }
  return [...new Set(strings.map((s) => byKey.get(fold(s))).filter((v): v is string => !!v))]
}

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const posInt = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(Math.round(v), 3650) : null)

function pickDates(raw: unknown, legacyNewWithin: unknown) {
  const out: { field: DateField; within: number | null; next: number | null; from: string | null; to: string | null }[] = []
  const list = Array.isArray(raw) ? raw : []
  for (const d of list) {
    if (!d || typeof d !== 'object') continue
    const r = d as Record<string, unknown>
    const field = DATE_FIELDS.find((f) => f === r.field)
    if (!field || out.some((o) => o.field === field)) continue
    const within = posInt(r.withinDays)
    const next = field === 'interview' ? posInt(r.nextDays) : null
    const from = isDay(r.from) ? r.from : null
    const to = isDay(r.to) ? r.to : null
    if (within) out.push({ field, within, next: null, from: null, to: null })
    else if (next) out.push({ field, within: null, next, from: null, to: null })
    else if (from || to) out.push({ field, within: null, next: null, from, to })
    if (out.length === 3) break
  }
  const legacy = posInt(legacyNewWithin)
  if (legacy && !out.some((o) => o.field === 'added')) out.push({ field: 'added', within: legacy, next: null, from: null, to: null })
  return out
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)

Deno.serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req.headers.get('origin') ?? undefined)
  const preflight = handlePreflight(req)
  if (preflight) return preflight
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    // Signed-in people only.
    const auth = req.headers.get('Authorization') ?? ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)

    if (!LOVABLE_API_KEY) return json({ error: 'not_configured' }, 500)

    const { prompt, options } = await req.json().catch(() => ({}))
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) return json({ error: 'prompt_required' }, 400)
    const opts = (options ?? {}) as OptionsPayload

    const today = new Date().toISOString().slice(0, 10)
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(today) },
          { role: 'user', content: `available_options:\n${buildOptionsHint(opts) || '(none)'}\n\nrequest: ${prompt.slice(0, 1000)}` },
        ],
      }),
    })

    if (resp.status === 429) return json({ error: 'rate_limited' }, 429)
    if (resp.status === 402) return json({ error: 'credits_exhausted' }, 402)
    if (!resp.ok) {
      console.error('candidates-nl-search gateway', resp.status, (await resp.text()).slice(0, 300))
      return json({ error: 'gateway' }, 502)
    }

    const payload = await resp.json()
    const raw = payload?.choices?.[0]?.message?.content ?? '{}'
    let parsed: Record<string, unknown> = {}
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw } catch { parsed = {} }

    return json({
      query: typeof parsed.query === 'string' ? parsed.query.trim().slice(0, 200) : '',
      skills: pick(parsed.skills, opts.skills),
      countries: pick(parsed.countries, opts.countries),
      cities: pick(parsed.cities, opts.cities),
      companies: pick(parsed.companies, opts.companies),
      seniorityLevels: pick(parsed.seniorityLevels, opts.seniorityLevels),
      functionalAreas: pick(parsed.functionalAreas, opts.functionalAreas),
      jobs: pick(parsed.jobs, opts.jobs),
      stages: pick(parsed.stages, opts.stages),
      statuses: pick(parsed.statuses, opts.statuses),
      sources: pick(parsed.sources, opts.sources),
      pipelineStatuses: pick(parsed.pipelineStatuses, opts.pipelineStatuses),
      experienceMin: num(parsed.experienceMin),
      experienceMax: num(parsed.experienceMax),
      dates: pickDates(parsed.dates, parsed.newWithinDays),
    })
  } catch (e) {
    console.error('candidates-nl-search error', e)
    return json({ error: 'internal' }, 500)
  }
})
