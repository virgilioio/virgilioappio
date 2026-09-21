import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const FIELDS: Array<{ key: string; label: string; incomingKeys?: string[] }> = [
  { key: 'candidate_name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'current_job_title', label: 'Current title', incomingKeys: ['current_job_title', 'current_role', 'role_current'] },
  { key: 'company_current', label: 'Current company', incomingKeys: ['company_current', 'current_company'] },
  { key: 'location_city', label: 'City' },
  { key: 'location_state', label: 'State / region' },
  { key: 'location_country', label: 'Country' },
  { key: 'linkedin_url', label: 'LinkedIn' },
  { key: 'salary_amount', label: 'Salary expectation' },
  { key: 'salary_currency', label: 'Currency' },
  { key: 'salary_period', label: 'Salary period' },
  { key: 'years_experience', label: 'Years of experience' },
  { key: 'profile_summary', label: 'Profile summary' },
  { key: 'source', label: 'Source' },
]

const blank = (v: unknown) =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

const str = (v: unknown) => (blank(v) ? null : String(v).trim())

const initials = (name?: string | null) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '—'

const digits = (v?: string | null) => (v || '').replace(/[^\d]/g, '')

const normName = (v?: string | null) =>
  (v || '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => null)
    const existingId: string | undefined = body?.existing_candidate_id
    const incoming: Record<string, any> = body?.incoming ?? {}
    if (!existingId || typeof existingId !== 'string') {
      return json({ error: 'existing_candidate_id is required' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: candidate, error: candErr } = await admin
      .from('candidates')
      .select('*')
      .eq('id', existingId)
      .maybeSingle()
    if (candErr) return json({ error: candErr.message }, 500)
    if (!candidate) return json({ error: 'Candidate not found' }, 404)

    // ── tenant + permission, resolved server-side ──
    const { data: member } = await admin
      .from('members')
      .select('id, tenant_id, system_role, is_active')
      .eq('user_id', user.id)
      .eq('tenant_id', candidate.tenant_id)
      .maybeSingle()

    const { data: profileRow } = await admin
      .from('profiles')
      .select('user_id, first_name, last_name, email')
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: tenantRow } = await admin
      .from('tenants')
      .select('id, owner_user_id')
      .eq('id', candidate.tenant_id)
      .maybeSingle()

    const isOwner = tenantRow?.owner_user_id === user.id
    if (!isOwner && (!member || member.is_active === false)) {
      return json({ error: 'Forbidden' }, 403)
    }
    const canMerge = isOwner || ['admin', 'member'].includes(String(member?.system_role ?? ''))

    // ── owner of the record ──
    let ownerName: string | null = null
    if (candidate.created_by) {
      const { data: ownerProfile } = await admin
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('user_id', candidate.created_by)
        .maybeSingle()
      ownerName = ownerProfile
        ? [ownerProfile.first_name, ownerProfile.last_name].filter(Boolean).join(' ') || ownerProfile.email
        : null
    }

    // ── applications ──
    const { data: assocs } = await admin
      .from('job_candidate_associations')
      .select(`
        id, job_id, status, current_stage_id, entered_stage_at, created_at, updated_at,
        added_by, rejected_at, rejected_by, rejection_reason_id, rejection_notes, offered_at, hired_at,
        jobs ( id, title, department, location, status ),
        job_hiring_stages ( id, custom_stage_name, job_stages ( stage_name ) )
      `)
      .eq('candidate_id', existingId)
      .order('created_at', { ascending: false })

    const assocRows = assocs ?? []
    const assocIds = assocRows.map((a: any) => a.id)

    const reasonIds = assocRows.map((a: any) => a.rejection_reason_id).filter(Boolean)
    const reasonMap = new Map<string, string>()
    if (reasonIds.length) {
      const { data: reasons } = await admin
        .from('rejection_reasons')
        .select('id, name')
        .in('id', reasonIds)
      for (const r of reasons ?? []) reasonMap.set(r.id, r.name)
    }

    const actorIds = [
      ...new Set(
        assocRows
          .flatMap((a: any) => [a.added_by, a.rejected_by])
          .filter(Boolean),
      ),
    ] as string[]
    const actorMap = new Map<string, string>()
    if (actorIds.length) {
      const { data: actors } = await admin
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', actorIds)
      for (const p of actors ?? []) {
        actorMap.set(
          p.user_id,
          [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unknown',
        )
      }
    }

    // scheduled interviews (upcoming, per association)
    const nowIso = new Date().toISOString()
    const { data: bookings } = assocIds.length
      ? await admin
          .from('scheduled_bookings')
          .select('id, association_id, scheduled_start, status, title')
          .in('association_id', assocIds)
          .in('status', ['confirmed', 'rescheduled'])
          .gte('scheduled_end', nowIso)
          .order('scheduled_start', { ascending: true })
      : { data: [] as any[] }

    const bookingMap = new Map<string, any>()
    for (const b of bookings ?? []) if (!bookingMap.has(b.association_id)) bookingMap.set(b.association_id, b)

    // open offers
    const { data: offers } = await admin
      .from('offer_letters')
      .select('id, job_id, status, expires_at, sent_at')
      .eq('candidate_id', existingId)

    const offerByJob = new Map<string, any>()
    for (const o of offers ?? []) {
      if (['draft', 'cancelled', 'declined', 'rejected'].includes(String(o.status))) continue
      offerByJob.set(o.job_id, o)
    }

    const applications = assocRows.map((a: any) => {
      const stage =
        a.job_hiring_stages?.custom_stage_name ||
        a.job_hiring_stages?.job_stages?.stage_name ||
        null
      const booking = bookingMap.get(a.id)
      const offer = offerByJob.get(a.job_id)
      const status = a.hired_at
        ? 'hired'
        : a.rejected_at
        ? 'rejected'
        : a.status === 'offer' || a.offered_at
        ? 'offered'
        : a.status === 'withdrawn'
        ? 'withdrawn'
        : 'active'
      return {
        association_id: a.id,
        job_id: a.job_id,
        job_title: a.jobs?.title ?? 'Untitled job',
        job_status: a.jobs?.status ?? null,
        department: a.jobs?.department ?? null,
        location: a.jobs?.location ?? null,
        req_id: String(a.job_id).slice(0, 6).toUpperCase(),
        stage_name: stage,
        status,
        last_moved_at: a.entered_stage_at ?? a.updated_at ?? a.created_at,
        owner_initials: initials(actorMap.get(a.added_by) ?? null),
        owner_name: actorMap.get(a.added_by) ?? null,
        scheduled_interview: booking
          ? { at: booking.scheduled_start, title: booking.title ?? 'Interview' }
          : null,
        open_offer: status === 'offered'
          ? { expires_at: offer?.expires_at ?? null, sent_at: offer?.sent_at ?? a.offered_at }
          : null,
        rejection_reason: a.rejection_reason_id ? reasonMap.get(a.rejection_reason_id) ?? null : null,
        rejection_notes: a.rejection_notes ?? null,
        rejected_at: a.rejected_at ?? null,
        rejected_by_name: a.rejected_by ? actorMap.get(a.rejected_by) ?? null : null,
      }
    })

    // ── counts ──
    const countOf = async (table: string, column = 'candidate_id') => {
      const { count } = await admin
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq(column, existingId)
      return count ?? 0
    }
    const interviewsCount = assocIds.length
      ? (await admin
          .from('scheduled_bookings')
          .select('id', { count: 'exact', head: true })
          .in('association_id', assocIds)).count ?? 0
      : 0
    const scorecardsCount = assocIds.length
      ? (await admin
          .from('job_stage_scorecards')
          .select('id', { count: 'exact', head: true })
          .in('association_id', assocIds)).count ?? 0
      : 0

    const counts = {
      applications: applications.length,
      interviews: interviewsCount,
      scorecards: scorecardsCount,
      notes: await countOf('candidate_comments'),
      files: await countOf('candidate_attachments'),
      emails: await countOf('email_logs'),
    }

    // ── flags ──
    const flags: Array<{ id: string; tone: 'warning' | 'info'; title: string; body: string }> = []
    const sixMonthsAgo = Date.now() - 1000 * 60 * 60 * 24 * 183

    for (const app of applications) {
      if (app.status === 'rejected' && app.rejected_at && new Date(app.rejected_at).getTime() > sixMonthsAgo) {
        const reason = app.rejection_reason || app.rejection_notes
        flags.push({
          id: `rejected-${app.association_id}`,
          tone: 'warning',
          title: `Rejected for ${app.job_title} within the last 6 months`,
          body: [
            reason ? `Reason on file: “${reason}”.` : 'No reason was recorded.',
            app.rejected_by_name ? `${app.rejected_by_name} made that call and may own other open jobs.` : '',
          ].filter(Boolean).join(' '),
        })
      }
    }
    const offered = applications.filter((a) => a.status === 'offered')
    if (offered.length) {
      flags.push({
        id: 'live-offer',
        tone: 'warning',
        title: 'A live offer is open on this candidate',
        body: `The offer on ${offered[0].job_title} is untouched by this merge, but two recruiters may be working the same person on different jobs.`,
      })
    }
    const activeOpen = applications.filter((a) => a.status === 'active' && a.job_status === 'open')
    if (activeOpen.length >= 2) {
      flags.push({
        id: 'multi-active',
        tone: 'info',
        title: `Active on ${activeOpen.length} open jobs at once`,
        body: activeOpen.map((a) => a.job_title).join(' · '),
      })
    }
    if (candidate.merged_at) {
      flags.push({
        id: 'merged-before',
        tone: 'info',
        title: `This record was merged before, on ${new Date(candidate.merged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        body: 'Field history for that merge lives in the audit log.',
      })
    }

    // ── recent activity ──
    const { data: activityRows } = await admin
      .from('activities')
      .select('id, activity_type, description, created_at, user_id')
      .eq('candidate_id', existingId)
      .order('created_at', { ascending: false })
      .limit(4)

    const activityActorIds = [...new Set((activityRows ?? []).map((a: any) => a.user_id).filter(Boolean))] as string[]
    const activityActors = new Map<string, string>()
    if (activityActorIds.length) {
      const { data: rows } = await admin
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', activityActorIds)
      for (const p of rows ?? []) {
        activityActors.set(p.user_id, [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unknown')
      }
    }

    const kindOf = (t: string) =>
      t.includes('email') ? 'email'
      : t.includes('interview') || t.includes('booking') ? 'calendar'
      : t.includes('attachment') || t.includes('file') || t.includes('resume') ? 'file'
      : t.includes('scorecard') ? 'scorecard'
      : 'file'

    const activity = (activityRows ?? []).map((a: any) => ({
      kind: kindOf(String(a.activity_type ?? '')),
      text: a.description ?? String(a.activity_type ?? '').replace(/_/g, ' '),
      actor: a.user_id ? activityActors.get(a.user_id) ?? 'Someone' : 'Gio',
      at: a.created_at,
    }))

    // ── field classification ──
    const pick = (f: typeof FIELDS[number]) => {
      for (const k of f.incomingKeys ?? [f.key]) {
        if (!blank(incoming[k])) return incoming[k]
      }
      return null
    }

    const fields = FIELDS.map((f) => {
      const existingValue = (candidate as any)[f.key] ?? null
      const incomingValue = pick(f)
      let classification: 'conflict' | 'identical' | 'gap' | 'none' = 'none'
      if (blank(incomingValue)) classification = 'none'
      else if (blank(existingValue)) classification = 'gap'
      else if (String(existingValue).trim() === String(incomingValue).trim()) classification = 'identical'
      else classification = 'conflict'
      return {
        key: f.key,
        label: f.label,
        existing: blank(existingValue) ? null : existingValue,
        incoming: blank(incomingValue) ? null : incomingValue,
        classification,
      }
    }).filter((f) => f.classification !== 'none')

    // ── skills union ──
    const existingSkills: string[] = Array.isArray(candidate.skills) ? candidate.skills : []
    const incomingSkills: string[] = Array.isArray(incoming.skills) ? incoming.skills : []
    const lower = new Set(existingSkills.map((s) => s.toLowerCase()))
    const newSkills = incomingSkills.filter((s) => s && !lower.has(s.toLowerCase()))
    const union = [...existingSkills, ...newSkills]

    // ── match reasons ──
    const reasons: string[] = []
    if (str(incoming.email) && str(candidate.email) &&
        str(incoming.email)!.toLowerCase() === str(candidate.email)!.toLowerCase()) {
      reasons.push('the email address matches exactly')
    }
    if (digits(incoming.phone) && digits(candidate.phone) && digits(incoming.phone) === digits(candidate.phone)) {
      reasons.push('the phone number matches')
    }
    if (normName(incoming.candidate_name) && normName(incoming.candidate_name) === normName(candidate.candidate_name)) {
      reasons.push('the name matches')
    }
    if (str(incoming.linkedin_url) && str(candidate.linkedin_url) &&
        str(incoming.linkedin_url)!.toLowerCase() === str(candidate.linkedin_url)!.toLowerCase()) {
      reasons.push('the LinkedIn profile is the same')
    }
    const band = reasons.length >= 3 ? 'high' : reasons.length === 2 ? 'medium' : 'low'

    return json({
      candidate,
      owner: ownerName,
      source: candidate.source ?? null,
      created_at: candidate.created_at,
      counts,
      applications,
      flags,
      activity,
      match: { reasons, band },
      fields,
      skills: { union, new: newSkills, total: union.length },
      permissions: {
        can_merge: canMerge,
        ask: canMerge ? null : ownerName ?? 'a workspace admin',
      },
      viewer: {
        name: profileRow
          ? [profileRow.first_name, profileRow.last_name].filter(Boolean).join(' ') || profileRow.email
          : null,
      },
    })
  } catch (err) {
    console.error('[get-duplicate-context] failed:', err)
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
