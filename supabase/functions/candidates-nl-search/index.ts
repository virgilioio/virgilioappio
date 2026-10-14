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
// - It tells a job ("in an Account Executive role", "for the SDR job") apart
//   from what people are ("Account Executives"), picks a sort ("made it the
//   furthest", "newest", "most experienced"), and never drops a place or skill
//   it can't match: those become keywords instead.
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

const SORTS = ['added_desc', 'added_asc', 'applied', 'interview', 'stage_moved', 'updated', 'furthest', 'name', 'experience'] as const

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

A job they were considered for is not the same as who they are:
- "jobTitle" is the job/role/opening/search whose pipeline they're in: "in an Account Executive role",
  "for the SDR job", "applied to the Backend opening", "our Head of Sales search". Just the job name.
- "query" is what the person is or knows, words that must appear in their profile and aren't already
  covered by a filter: "Account Executives" -> "account executive", "SaaS", "B2B". Singular is fine.
Leave out filler words ("candidates", "people", "who", "with", "show me", "what are"). Use "" when nothing is left.

"sort" orders the list, one of: ${SORTS.join(', ')}, or null.
- furthest = made it the furthest / got closest to an offer / best progress in the pipeline
- applied = newest applicants; interview = latest interviews; stage_moved = most recently moved stage
- added_desc = newest; added_asc = oldest; updated = recently updated; experience = most experienced; name = alphabetical

Examples:
- "What are the candidates that made it the furthest in an Account Executive role?"
  -> jobTitle "Account Executive", sort "furthest", query ""
- "Show me Account Executives in Canada" -> query "account executive", countries ["Canada"] (or the
  closest listed spelling); if Canada isn't listed, still put "Canada" in countries
- "Who did we interview this week for the SDR job?" -> jobTitle "SDR", dates [{interview, withinDays 7}]
- "Most experienced engineers in Mexico" -> query "engineer", countries ["Mexico"], sort "experience"
- "People we rejected after an offer" -> pipelineStatuses ["rejected"] (if listed), query ""

Places, skills, companies, seniority and functions the user names go in their list even when they
aren't in available_options; they'll be searched as keywords.

Return strict JSON:
{
  "query": string,
  "jobTitle": string,
  "sort": string | null,
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

/**
 * Maps the model's values to the exact stored values the page offered. Values
 * that aren't offered come back in `missed` (the caller decides: keywords for
 * places and skills, dropped for jobs and stages).
 */
function pick(raw: unknown, offered: FilterOptionLite[] | undefined): { values: string[]; missed: string[] } {
  if (!Array.isArray(raw)) return { values: [], missed: [] }
  const strings = raw.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
  // The top-bar preview sends no options: show the model's reading as is.
  if (!offered?.length) return { values: [...new Set(strings)], missed: [] }
  const byKey = new Map<string, string>()
  for (const o of offered) {
    byKey.set(fold(o.value), o.value)
    if (o.label) byKey.set(fold(o.label), o.value)
  }
  const values: string[] = []
  const missed: string[] = []
  for (const s of strings) {
    const hit = byKey.get(fold(s))
    if (hit) values.push(hit)
    else missed.push(s)
  }
  return { values: [...new Set(values)], missed: [...new Set(missed)] }
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

    // Places, skills, companies, seniority and functions nobody has as a
    // stored value are still searched, as keywords ("Canada" in a summary).
    const keywordKinds = ['skills', 'countries', 'cities', 'companies', 'seniorityLevels', 'functionalAreas'] as const
    const strictKinds = ['jobs', 'stages', 'statuses', 'sources', 'pipelineStatuses'] as const
    const out: Record<string, unknown> = {}
    const extraKeywords: string[] = []
    for (const k of keywordKinds) {
      const r = pick(parsed[k], opts[k])
      out[k] = r.values
      extraKeywords.push(...r.missed)
    }
    for (const k of strictKinds) out[k] = pick(parsed[k], opts[k]).values

    const query = [typeof parsed.query === 'string' ? parsed.query.trim() : '', ...extraKeywords]
      .filter(Boolean).join(' ').slice(0, 200)
    const sort = SORTS.find((x) => x === parsed.sort) ?? null

    return json({
      query,
      jobTitle: typeof parsed.jobTitle === 'string' ? parsed.jobTitle.trim().slice(0, 120) : '',
      sort,
      ...out,
      keywordsFromFilters: extraKeywords,
      experienceMin: num(parsed.experienceMin),
      experienceMax: num(parsed.experienceMax),
      dates: pickDates(parsed.dates, parsed.newWithinDays),
    })
  } catch (e) {
    console.error('candidates-nl-search error', e)
    return json({ error: 'internal' }, 500)
  }
})
