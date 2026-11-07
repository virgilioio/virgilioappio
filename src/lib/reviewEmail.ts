import { useQuery, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { renderTemplate } from '@/utils/templateUtils'
import { COMPOSER_VARIABLES } from '@/lib/automations'

/**
 * The rejection email from Application review (2026-11-07): one set of values for the
 * preview and the send, so what Allan reads is what the candidate gets. The values
 * follow send-user-email's own fill (the template editors' sender), so no variable the
 * menus offer goes out blank because this screen didn't know it. Booking links and
 * interview times aren't filled here (a booking link is minted per candidate on the
 * server); the preview flags them.
 */
export interface ReviewEmailContext {
  job: { title: string; department: string; location: string; salaryRange: string; clientName: string; workspaceName: string }
  sender: { firstName: string; lastName: string; email: string; title: string; phone: string; linkedin: string }
  /** The mailbox it goes out from, or null when none is connected. */
  fromEmail: string | null
}

export interface ReviewEmailCandidate {
  candidateName: string
  email: string | null
  phone: string | null
  locationCity: string | null
  locationState: string | null
  locationCountry: string | null
}

const money = (n: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(n)

async function loadContext(jobId: string, userId: string): Promise<ReviewEmailContext> {
  const [jobRes, senderRes, identityRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('title, department, location, salary_min, salary_max, currency, organization:organizations(name), tenant:tenants(name)')
      .eq('id', jobId)
      .single(),
    supabase
      .from('profiles')
      .select('first_name, last_name, email, title, phone, linkedin_url')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_mail_identities')
      .select('email_address')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
  ])
  if (jobRes.error) throw jobRes.error
  type JobRow = { title: string | null; department: string | null; location: string | null; salary_min: number | null; salary_max: number | null; currency: string | null; organization: { name: string | null } | null; tenant: { name: string | null } | null }
  type ProfileRow = { first_name?: string | null; last_name?: string | null; email?: string | null; title?: string | null; phone?: string | null; linkedin_url?: string | null }
  const j = jobRes.data as unknown as JobRow
  const p = (senderRes.data ?? {}) as ProfileRow
  const min = Number(j?.salary_min) || 0
  const max = Number(j?.salary_max) || 0
  // The same wording as send-user-email's {{job.salary_range}}.
  const cur = j?.currency || 'USD'
  const salaryRange = min && max ? `${money(min, cur)} – ${money(max, cur)}` : min || max ? money(min || max, cur) : ''
  const fromEmail = (identityRes.data as { email_address?: string } | null)?.email_address ?? null
  return {
    job: {
      title: j?.title ?? '',
      department: j?.department ?? '',
      location: j?.location ?? '',
      salaryRange,
      clientName: j?.organization?.name ?? '',
      workspaceName: j?.tenant?.name ?? '',
    },
    sender: {
      firstName: p.first_name ?? '',
      lastName: p.last_name ?? '',
      email: p.email || fromEmail || '',
      title: p.title ?? '',
      phone: p.phone ?? '',
      linkedin: p.linkedin_url ?? '',
    },
    fromEmail,
  }
}

const contextKey = (jobId: string, userId: string) => ['review-email-context', jobId, userId] as const

/** Loaded once per job and sender, kept for 5 minutes. */
export function useReviewEmailContext(jobId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: contextKey(jobId ?? '', userId ?? ''),
    enabled: !!jobId && !!userId,
    staleTime: 5 * 60_000,
    queryFn: () => loadContext(jobId!, userId!),
  })
}

/** For the send: the cached context, or a fresh load. */
export function fetchReviewEmailContext(qc: QueryClient, jobId: string, userId: string) {
  return qc.fetchQuery({ queryKey: contextKey(jobId, userId), staleTime: 5 * 60_000, queryFn: () => loadContext(jobId, userId) })
}

/** Every key the email can carry, as send-user-email fills it. Empty when there's nothing. */
export function reviewEmailValues(ctx: ReviewEmailContext, c: ReviewEmailCandidate, stageName: string): Record<string, string> {
  const name = c.candidateName || ''
  const senderName = [ctx.sender.firstName, ctx.sender.lastName].filter(Boolean).join(' ') || ctx.sender.email
  return {
    'candidate.name': name,
    'candidate.full_name': name,
    'candidate.first_name': name.split(' ')[0] || '',
    'candidate.email': c.email || '',
    'candidate.phone': c.phone || '',
    'candidate.location': [c.locationCity, c.locationState, c.locationCountry].filter(Boolean).join(', '),
    'job.title': ctx.job.title,
    'job.department': ctx.job.department,
    'department.name': ctx.job.department,
    'job.location': ctx.job.location,
    'job.salary_range': ctx.job.salaryRange,
    'client.name': ctx.job.clientName,
    'organization.name': ctx.job.workspaceName,
    'stage.name': stageName,
    'interview.datetime': '',
    'interview.date': '',
    'interview.time': '',
    'sender.name': senderName,
    'sender.first_name': ctx.sender.firstName,
    'sender.last_name': ctx.sender.lastName,
    'sender.email': ctx.sender.email,
    'sender.title': ctx.sender.title,
    'sender.phone': ctx.sender.phone,
    'sender.linkedin': ctx.sender.linkedin,
    'recruiter.first_name': ctx.sender.firstName,
    'recruiter.name': senderName,
    'sender.booking_link': '',
    'stage.booking_link': '',
    'scheduling.link': '',
  }
}

/** The email as it goes out. */
export function fillReviewEmail(text: string, values: Record<string, string>) {
  return renderTemplate(text, values)
}

const KEY = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g

/** What an empty variable is called in the preview ("Job salary range", "Your phone"). */
export function variableName(key: string): string {
  const v = COMPOSER_VARIABLES.find((x) => x.key === key)
  if (!v) return key
  if ((v.group === 'Candidate' || v.group === 'Job') && !/^(Client|Your)\b/.test(v.label)) {
    return `${v.group} ${v.label.charAt(0).toLowerCase()}${v.label.slice(1)}`
  }
  return v.label.replace(/\s*\(.*\)$/, '')
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The preview: values filled in, an empty one shown as an amber chip with its name
 * (`.gio-var-empty`), and the names of the empty ones once each, in order.
 */
export function previewReviewEmail(text: string, values: Record<string, string>, html: boolean) {
  const empty: string[] = []
  const out = (text || '').replace(/&nbsp;/g, ' ').replace(KEY, (_m, raw: string) => {
    const key = raw.trim()
    const value = values[key]
    if (value) return html ? esc(value) : value
    const label = variableName(key)
    if (!empty.includes(label)) empty.push(label)
    return html ? `<span class="gio-var-empty">${esc(label)}</span>` : `\u0000${label}\u0000`
  })
  return { out, empty }
}
