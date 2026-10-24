import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Database, Json } from '@/integrations/supabase/types'
import { commissionRoleLabel } from './commissions'
import { segmentLabel, specialtyLabel } from './workProfile'

/**
 * People & Access (Gio OS, Part B, 2026-10-14): who works at Virgilio and
 * what they can open. The database decides everything (os_* tables,
 * os_people(), os_set_app_role()); these hooks only read and ask.
 */

export type AppKey = 'ats' | 'sales' | 'docs'

export const APPS: { key: AppKey; name: string; roles: { id: string; label: string }[] }[] = [
  {
    key: 'ats',
    name: 'Gio ATS',
    roles: [
      { id: 'admin', label: 'Admin' },
      { id: 'member', label: 'Member' },
      { id: 'sales', label: 'Sales (legacy)' },
    ],
  },
  {
    key: 'sales',
    name: 'Gio Sales',
    roles: [
      { id: 'billing', label: 'Billing' },
      { id: 'read_only', label: 'Read-only' },
      { id: 'rep', label: 'Rep' },
      { id: 'admin', label: 'Admin' },
      { id: 'owner', label: 'Owner' },
    ],
  },
  {
    key: 'docs',
    name: 'Gio Docs',
    roles: [
      { id: 'member', label: 'Member' },
      { id: 'owner', label: 'Owner' },
    ],
  },
]

export const appName = (key: string) => APPS.find((a) => a.key === key)?.name ?? key
export const roleLabel = (app: string, role: string) =>
  APPS.find((a) => a.key === app)?.roles.find((r) => r.id === role)?.label ?? role

export type GrantStatus = 'pending' | 'active' | 'error' | 'revoked'
export interface Grant {
  app: AppKey
  role: string
  status: GrantStatus
  sync_error: string | null
  granted_at: string
}

export interface Person {
  member_id: string
  user_id: string | null
  email: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  member_status: string
  system_role: string
  user_type: string | null
  last_sign_in_at: string | null
  profile_status: string
  bundle_id: string | null
  google_email: string | null
  google_status: 'connected' | 'reconnect' | 'not_connected'
  active_jobs: number
  closed_jobs: number
  grants: Grant[]
}

export interface BundleGrant {
  app: AppKey
  role: string
}

export interface Bundle {
  id: string
  tenant_id: string
  name: string
  description: string | null
  grants: BundleGrant[]
  archived_at: string | null
  created_at: string
}

export interface AuditRow {
  id: number
  actor_id: string | null
  subject_user_id: string | null
  action: string
  app_key: string | null
  detail: Record<string, unknown>
  created_at: string
}

export function personName(p: Pick<Person, 'first_name' | 'last_name' | 'email'>) {
  const name = [p.first_name, p.last_name].filter((s) => s && s.trim()).join(' ').trim()
  return name || p.email || 'Unnamed person'
}

export function personInitials(p: Pick<Person, 'first_name' | 'last_name' | 'email'>) {
  const f = p.first_name?.trim()?.[0] ?? ''
  const l = p.last_name?.trim()?.[0] ?? ''
  const both = `${f}${l}`.toUpperCase()
  return both || p.email?.[0]?.toUpperCase() || '?'
}

/** Where someone stands: invited, active, or deactivated in the ATS. */
export type PersonState = 'active' | 'invited' | 'deactivated'
export function personState(p: Person): PersonState {
  if (p.member_status === 'invited') return 'invited'
  if (p.member_status !== 'active' || p.profile_status !== 'active') return 'deactivated'
  return 'active'
}

/** The access a person has today, including the ATS role that the ATS enforces. */
export function effectiveGrants(p: Person): Grant[] {
  const others = p.grants.filter((g) => g.app !== 'ats')
  const ats: Grant = {
    app: 'ats',
    role: p.system_role,
    status: 'active',
    sync_error: null,
    granted_at: '',
  }
  return [ats, ...others]
}

export function readBundleGrants(raw: Json | null | undefined): BundleGrant[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((g) => (g && typeof g === 'object' && !Array.isArray(g) ? (g as Record<string, unknown>) : null))
    .filter((g): g is Record<string, unknown> => !!g && typeof g.app === 'string' && typeof g.role === 'string')
    .map((g) => ({ app: g.app as AppKey, role: g.role as string }))
}

const keys = {
  people: (tenantId: string | undefined) => ['os-people', tenantId] as const,
  bundles: (tenantId: string | undefined) => ['os-bundles', tenantId] as const,
  audit: (tenantId: string | undefined, subject?: string | null) => ['os-audit', tenantId, subject ?? 'all'] as const,
  jobs: (userId: string | null | undefined) => ['os-person-jobs', userId] as const,
  details: (tenantId: string | undefined, userId: string | null | undefined) => ['os-person-details', tenantId, userId] as const,
}

export function usePeople(tenantId: string | undefined) {
  return useQuery({
    queryKey: keys.people(tenantId),
    enabled: !!tenantId,
    queryFn: async (): Promise<Person[]> => {
      const { data, error } = await supabase.rpc('os_people', { _tenant_id: tenantId! })
      if (error) throw error
      return (data ?? []).map((row) => ({
        ...row,
        google_status: (row.google_status as Person['google_status']) ?? 'not_connected',
        grants: (Array.isArray(row.grants) ? row.grants : []) as unknown as Grant[],
      }))
    },
  })
}

export function useBundles(tenantId: string | undefined, { includeArchived = false } = {}) {
  return useQuery({
    queryKey: [...keys.bundles(tenantId), includeArchived],
    enabled: !!tenantId,
    queryFn: async (): Promise<Bundle[]> => {
      let q = supabase.from('os_bundles').select('*').eq('tenant_id', tenantId!).order('name')
      if (!includeArchived) q = q.is('archived_at', null)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((b) => ({ ...b, grants: readBundleGrants(b.grants) }))
    },
  })
}

export function useAudit(tenantId: string | undefined, subjectUserId?: string | null) {
  return useQuery({
    queryKey: keys.audit(tenantId, subjectUserId),
    enabled: !!tenantId && subjectUserId !== null,
    queryFn: async (): Promise<AuditRow[]> => {
      let q = supabase
        .from('os_audit_log')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(300)
      if (subjectUserId) q = q.eq('subject_user_id', subjectUserId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((r) => ({ ...r, detail: (r.detail ?? {}) as Record<string, unknown> }))
    },
  })
}

export interface PersonJob {
  job_id: string
  title: string
  status: string
  role: string
  client: string | null
  organization_id: string
  created_at: string
}

export function usePersonJobs(userId: string | null | undefined) {
  return useQuery({
    queryKey: keys.jobs(userId),
    enabled: !!userId,
    queryFn: async (): Promise<PersonJob[]> => {
      const { data, error } = await supabase
        .from('job_assignments')
        .select('job_id, role, jobs!inner(title, status, created_at, organization_id, organizations(name))')
        .eq('user_id', userId!)
        .is('deleted_at', null)
      if (error) throw error
      type Row = {
        job_id: string
        role: string
        jobs: { title: string; status: string; created_at: string; organization_id: string; organizations: { name: string } | null }
      }
      const rows = (data ?? []) as unknown as Row[]
      const order = { open: 0, draft: 1, closed: 2, archived: 3 } as Record<string, number>
      return rows
        .map((r) => ({
          job_id: r.job_id,
          role: r.role,
          title: r.jobs.title,
          status: r.jobs.status,
          client: r.jobs.organizations?.name ?? null,
          organization_id: r.jobs.organization_id,
          created_at: r.jobs.created_at,
        }))
        .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.title.localeCompare(b.title))
    },
  })
}

/** A person's personal details (os_person_details): admins and the person themself. */
export interface PersonDetails {
  personal_email: string | null
  personal_phone: string | null
  country_code: string | null
  region: string | null
  city: string | null
  /** YYYY-MM-DD. The year stays with the person and admins (2026-10-24). */
  birth_date: string | null
}

export const PERSONAL_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const PERSONAL_PHONE_RE = /^\+?[0-9 ().-]{5,40}$/

export function usePersonDetails(tenantId: string | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: keys.details(tenantId, userId),
    enabled: !!tenantId && !!userId,
    queryFn: async (): Promise<PersonDetails | null> => {
      const { data, error } = await supabase
        .from('os_person_details')
        .select('personal_email, personal_phone, country_code, region, city, birth_date')
        .eq('tenant_id', tenantId!)
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Saves the whole set (the database turns blanks into nulls and records which fields changed). */
export function useSavePersonDetails(tenantId: string | undefined, userId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (details: PersonDetails) => {
      const { data, error } = await supabase
        .from('os_person_details')
        .upsert({ tenant_id: tenantId!, user_id: userId!, ...details }, { onConflict: 'tenant_id,user_id' })
        .select('personal_email, personal_phone, country_code, region, city, birth_date')
        .single()
      if (error) throw error
      return data as PersonDetails
    },
    onSuccess: (saved) => {
      qc.setQueryData(keys.details(tenantId, userId), saved)
      void qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
    },
  })
}

/** Which tab of a person's Jobs a status belongs to. */
export type JobBucket = 'open' | 'draft' | 'closed'
export const jobBucket = (status: string): JobBucket =>
  status === 'open' ? 'open' : status === 'draft' ? 'draft' : 'closed'

/** Seats a job role holds, in the words the ATS uses. */
export const JOB_SEAT_LABEL: Record<string, string> = {
  recruiter: 'Recruiter',
  sourcer: 'Sourcer',
  hiring_manager: 'Hiring manager',
  interviewer: 'Interviewer',
}

/**
 * Gives someone's seats to other people before they leave (offboarding).
 * One insert, so either every handover lands or none does; the one-seat rule
 * (GJT01) refuses a person who is already on the job.
 */
export async function handOverSeats(
  seats: { job_id: string; organization_id: string; role: string; to_user_id: string }[],
  assignedBy: string,
) {
  if (seats.length === 0) return
  const { error } = await supabase.from('job_assignments').insert(
    seats.map((s) => ({
      job_id: s.job_id,
      organization_id: s.organization_id,
      user_id: s.to_user_id,
      role: s.role as Database['public']['Enums']['job_assignment_role'],
      assigned_by: assignedBy,
    })),
  )
  if (error) throw error
}

/** Plain words for the database's refusals (GOS0x codes and 42501). */
export function accessErrorMessage(err: unknown, fallback = "Couldn't save the change.") {
  const e = err as { code?: string; message?: string } | null
  if (!e) return fallback
  if (e.code === '42501') return 'Only admins can change access.'
  if (e.code && /^GOS0\d$/.test(e.code) && e.message) return e.message
  return fallback
}

function useInvalidateAll(tenantId: string | undefined) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: keys.people(tenantId) })
    qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
  }
}

/** Apps that receive grants from People & Access (Gio Sales and Gio Docs). */
export const SYNCED_APPS: ReadonlySet<string> = new Set(['sales', 'docs'])

/**
 * Sends queued changes to the apps right away (os-sync). Failures are fine to
 * ignore here: the change stays queued and the cron retries every few minutes.
 */
export async function syncNow(tenantId: string | undefined) {
  if (!tenantId) return
  try {
    await supabase.functions.invoke('os-sync', { body: { tenant_id: tenantId } })
  } catch {
    /* retried by the cron */
  }
}

export type ResendResult = { outcome: string; detail: string | null }

/** A Gio Docs or Gio Sales grant waiting this long reads "Not delivered yet". */
export const UNDELIVERED_AFTER_MS = 10 * 60_000

/**
 * Sends someone's invitation to an app again (os_resend_access), then pushes it
 * out right away. The answer is the app's own: 'invited' (a fresh link went
 * out), 'unchanged' (already in the app; detail says so), 'refused', or
 * 'queued' when the app couldn't be reached and the cron will send it.
 */
export function useResendAccess(tenantId: string | undefined) {
  const invalidate = useInvalidateAll(tenantId)
  return useMutation({
    mutationFn: async ({ userId, app }: { userId: string; app: AppKey }): Promise<ResendResult> => {
      const { data: id, error } = await supabase.rpc('os_resend_access', {
        _tenant_id: tenantId!,
        _user_id: userId,
        _app: app,
      })
      if (error) throw error
      try {
        const { data } = await supabase.functions.invoke('os-sync', { body: { tenant_id: tenantId } })
        const hit = (data?.results as Array<{ id: string; result: string; detail?: string | null }> | undefined)?.find(
          (r) => r.id === id,
        )
        if (hit && hit.result !== 'retry') return { outcome: hit.result, detail: hit.detail ?? null }
      } catch {
        /* the cron sends it */
      }
      return { outcome: 'queued', detail: null }
    },
    onSettled: invalidate,
  })
}

/** The toast after a resend, in plain words. */
export function resendMessage(app: AppKey, who: string, r: ResendResult): string {
  const name = appName(app)
  switch (r.outcome) {
    case 'invited':
    case 'invite_updated':
      return `${name} invitation sent to ${who}.`
    case 'unchanged':
      return r.detail ?? `${who} is already in ${name}.`
    case 'refused':
      return r.detail ?? `${name} refused to send the invitation.`
    default:
      return `${name} can't be reached right now. The invitation goes out automatically within a few minutes.`
  }
}

export function useSetAppRole(tenantId: string | undefined) {
  const invalidate = useInvalidateAll(tenantId)
  return useMutation({
    mutationFn: async ({ userId, app, role }: { userId: string; app: AppKey; role: string | null }) => {
      const { error } = await supabase.rpc('os_set_app_role', {
        _tenant_id: tenantId!,
        _user_id: userId,
        _app: app,
        _role: role,
      })
      if (error) throw error
      if (SYNCED_APPS.has(app)) await syncNow(tenantId)
    },
    onSettled: invalidate,
  })
}

/**
 * Gives someone a job role: records it, then grants exactly the bundle's apps.
 * The ATS role is the bundle's, or Member when the bundle has no ATS entry
 * (everyone in People & Access keeps an ATS membership). Apps the bundle
 * leaves out are removed.
 */
export function useApplyBundle(tenantId: string | undefined) {
  const invalidate = useInvalidateAll(tenantId)
  return useMutation({
    mutationFn: async ({ person, bundle }: { person: Person; bundle: Bundle }) => {
      if (!person.user_id) throw new Error('not_joined')
      const { error: profileError } = await supabase
        .from('os_person_profile')
        .upsert(
          { tenant_id: tenantId!, user_id: person.user_id, bundle_id: bundle.id, status: person.profile_status || 'active' },
          { onConflict: 'tenant_id,user_id' },
        )
      if (profileError) throw profileError
      for (const app of APPS) {
        const wanted = bundle.grants.find((g) => g.app === app.key)?.role ?? (app.key === 'ats' ? 'member' : null)
        const current =
          app.key === 'ats' ? person.system_role : person.grants.find((g) => g.app === app.key)?.role ?? null
        if (wanted === current) continue
        const { error } = await supabase.rpc('os_set_app_role', {
          _tenant_id: tenantId!,
          _user_id: person.user_id,
          _app: app.key,
          _role: wanted,
        })
        if (error) throw error
      }
      await syncNow(tenantId)
    },
    onSettled: invalidate,
  })
}

export function useSaveBundle(tenantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; description: string | null; grants: BundleGrant[] }) => {
      const row = {
        tenant_id: tenantId!,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        grants: input.grants as unknown as Json,
      }
      const { error } = input.id
        ? await supabase.from('os_bundles').update(row).eq('id', input.id)
        : await supabase.from('os_bundles').insert(row)
      if (error) throw error
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.bundles(tenantId) })
      qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
    },
  })
}

export function useArchiveBundle(tenantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('os_bundles')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.bundles(tenantId) })
      qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
    },
  })
}

/** One line of history in plain words. */
export function describeAudit(row: AuditRow, nameOf: (userId: string | null) => string): string {
  const d = row.detail
  const app = row.app_key ? appName(row.app_key) : ''
  const role = typeof d.role === 'string' && row.app_key ? roleLabel(row.app_key, d.role) : ''
  const prev = typeof d.previous_role === 'string' && row.app_key ? roleLabel(row.app_key, d.previous_role) : ''
  const who = nameOf(row.subject_user_id)
  switch (row.action) {
    case 'grant.added':
      return `${who} got ${app} as ${role}`
    case 'grant.removed':
      return `${who} lost ${app}${prev ? ` (${prev})` : role ? ` (${role})` : ''}`
    case 'grant.role_changed':
      return `${who}'s ${app} role changed from ${prev} to ${role}`
    case 'grant.resent':
      return `${who}'s ${app} invitation was sent again`
    case 'grant.active':
      return `${app} confirmed ${who}'s access`
    case 'grant.error':
      return `${app} couldn't apply ${who}'s access${typeof d.sync_error === 'string' ? `: ${d.sync_error}` : ''}`
    case 'person.added':
      return `${who} was added to People & Access`
    case 'person.updated':
      return `${who}'s job role changed`
    case 'person.suspended':
      return `${who} was suspended`
    case 'person.details_updated': {
      const names: Record<string, string> = {
        personal_email: 'personal email',
        personal_phone: 'personal phone',
        country: 'country',
        region: 'state or province',
        city: 'city',
      }
      const fields = Array.isArray(d.fields) ? (d.fields as string[]).map((f) => names[f] ?? f) : []
      const list = fields.length ? `: ${fields.join(', ')}` : ''
      return row.actor_id && row.actor_id === row.subject_user_id
        ? `${who} updated their personal details${list}`
        : `${who}'s personal details were updated${list}`
    }
    case 'person.bank_updated': {
      const names: Record<string, string> = {
        bank_details: 'added',
        kind: 'kind of account',
        holder_name: 'account holder',
        bank_name: 'bank',
        clabe: 'CLABE',
        account_number: 'account number',
        iban: 'IBAN',
        currency: 'currency',
        country: 'country',
        routing_number: 'routing number',
        account_type: 'account type',
        swift: 'SWIFT/BIC',
      }
      const fields = Array.isArray(d.fields) ? (d.fields as string[]).map((f) => names[f] ?? f) : []
      const list = fields.length ? `: ${fields.join(', ')}` : ''
      return row.actor_id && row.actor_id === row.subject_user_id
        ? `${who} updated their bank details${list}`
        : `${who}'s bank details were changed${list}`
    }
    case 'person.bank_revealed':
      return `${who}'s ${typeof d.field === 'string' ? d.field : 'account number'} was shown in full`
    case 'person.work_updated': {
      const parts: string[] = []
      if (Array.isArray(d.segments))
        parts.push(`segments ${(d.segments as string[]).map(segmentLabel).join(', ') || 'cleared'}`)
      if (Array.isArray(d.specialties))
        parts.push(`specialties ${(d.specialties as string[]).map(specialtyLabel).join(', ') || 'cleared'}`)
      if ('max_open_jobs' in d)
        parts.push(typeof d.max_open_jobs === 'number' ? `capacity ${d.max_open_jobs} open jobs` : 'capacity cleared')
      return `${who}'s work profile was updated${parts.length ? `: ${parts.join(' · ')}` : ''}`
    }
    case 'person.rating_updated': {
      const parts: string[] = []
      if ('rating' in d) parts.push(typeof d.rating === 'number' ? `rated ${d.rating} of 5` : 'rating cleared')
      if (d.note_changed) parts.push('note changed')
      return `${who}: ${parts.join(' · ') || 'rating updated'}`
    }
    case 'person.offboarded':
      return `${who} was offboarded`
    case 'person.active':
      return `${who} was reactivated`
    case 'commission.rate_added':
      return `Commission rate: ${commissionRoleLabel(String(d.role_key ?? ''))} ${Number(d.pct)}% from ${String(d.effective_from ?? '')}`
    case 'bundle.added':
      return `Job role "${String(d.name ?? '')}" was created`
    case 'bundle.updated':
      return `Job role "${String(d.name ?? '')}" was edited`
    case 'bundle.archived':
      return `Job role "${String(d.name ?? '')}" was archived`
    default:
      return row.action
  }
}
