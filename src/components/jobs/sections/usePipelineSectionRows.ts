import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PS_AMBER, PS_GREEN, PS_PURPLE, PS_RUST, PS_TEAL, PS_TERTIARY } from './psAtoms'
import { PS_STATUS_ICONS, type PSRowData, type PSSection } from './pipelineSectionConfigs'

const dayDiff = (iso?: string | null) => {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.floor(ms / 86400000))
}

const shortDate = (iso?: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const titleCase = (s?: string | null) =>
  s ? s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : null

/** Pull a plausible compensation string out of an offer's stored field values. */
function offerFigure(fieldValues: any): string | null {
  if (!fieldValues || typeof fieldValues !== 'object') return null
  const keys = Object.keys(fieldValues)
  const salaryKey = keys.find((k) => /salary|base|compensation|package|rate/i.test(k))
  const equityKey = keys.find((k) => /equity|options|shares/i.test(k))
  const salary = salaryKey ? fieldValues[salaryKey] : null
  const equity = equityKey ? fieldValues[equityKey] : null
  const parts: string[] = []
  if (salary !== null && salary !== undefined && `${salary}`.trim() !== '') parts.push(`${salary}`)
  if (equity !== null && equity !== undefined && `${equity}`.trim() !== '') parts.push(`${equity}`)
  return parts.length ? parts.join(' + ') : null
}

function startDateFromOffer(fieldValues: any): string | null {
  if (!fieldValues || typeof fieldValues !== 'object') return null
  const key = Object.keys(fieldValues).find((k) => /start[_ ]?date|start/i.test(k))
  if (!key) return null
  const v = fieldValues[key]
  return shortDate(typeof v === 'string' ? v : null) ?? (v ? `${v}` : null)
}

export interface SectionSource {
  jobId: string
  section: PSSection
  /** Candidate rows for the section, already filtered/searched by the caller. */
  candidates: any[]
  associations: any[]
  stageMap: Record<string, { type: string; name: string }>
}

/**
 * Joins the candidate rows with everything the four flat sections need:
 * owners, offers, onboarding checklists, rejection reasons and the furthest
 * stage reached. Nothing is invented — missing data renders as an em dash.
 */
export function usePipelineSectionRows({
  jobId,
  section,
  candidates,
  associations,
  stageMap,
}: SectionSource) {
  const assocByCandidate = useMemo(() => {
    const m = new Map<string, any>()
    for (const a of associations || []) m.set(a.candidate_id, a)
    return m
  }, [associations])

  const relevantAssocs = useMemo(
    () => (candidates || []).map((c) => assocByCandidate.get(c.id)).filter(Boolean),
    [candidates, assocByCandidate],
  )

  const assocIds = useMemo(
    () => relevantAssocs.map((a: any) => a.id).sort(),
    [relevantAssocs],
  )
  const candidateIds = useMemo(() => (candidates || []).map((c) => c.id).sort(), [candidates])

  // Owner profiles (added_by / offered_by / hired_by / rejected_by).
  const ownerIds = useMemo(() => {
    const ids = new Set<string>()
    for (const a of relevantAssocs) {
      for (const k of ['added_by', 'offered_by', 'hired_by', 'rejected_by']) {
        if (a?.[k]) ids.add(a[k])
      }
    }
    return Array.from(ids).sort()
  }, [relevantAssocs])

  const { data: owners } = useQuery({
    queryKey: ['ps-owner-profiles', ownerIds.join(',')],
    queryFn: async () => {
      if (!ownerIds.length) return []
      const { data } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', ownerIds)
      return data || []
    },
    enabled: ownerIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const ownerById = useMemo(() => {
    const m = new Map<string, { name: string; avatar: string | null }>()
    for (const p of (owners as any[]) || []) {
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
      m.set(p.user_id, { name: name || 'Teammate', avatar: p.avatar_url ?? null })
    }
    return m
  }, [owners])

  // Offers (offers + hired sections).
  const needsOffers = section === 'offers' || section === 'hired'
  const { data: offers } = useQuery({
    queryKey: ['ps-offers', jobId, candidateIds.join(',')],
    queryFn: async () => {
      if (!candidateIds.length) return []
      const { data } = await supabase
        .from('offer_letters')
        .select('id, candidate_id, status, sent_at, expires_at, field_values, created_at')
        .eq('job_id', jobId)
        .in('candidate_id', candidateIds)
        .order('created_at', { ascending: false })
      return data || []
    },
    enabled: needsOffers && candidateIds.length > 0,
    staleTime: 60 * 1000,
  })

  const offerByCandidate = useMemo(() => {
    const m = new Map<string, any>()
    for (const o of (offers as any[]) || []) if (!m.has(o.candidate_id)) m.set(o.candidate_id, o)
    return m
  }, [offers])

  // Onboarding checklists (hired section) — discrete steps, x of y.
  const { data: onboarding } = useQuery({
    queryKey: ['ps-onboarding', assocIds.join(',')],
    queryFn: async () => {
      if (!assocIds.length) return []
      const { data } = await supabase
        .from('onboarding_tasks')
        .select('application_id, done, label')
        .in('application_id', assocIds)
      return data || []
    },
    enabled: section === 'hired' && assocIds.length > 0,
    staleTime: 60 * 1000,
  })

  const onboardingByAssoc = useMemo(() => {
    const m = new Map<string, { done: number; total: number; pending: string[] }>()
    for (const t of (onboarding as any[]) || []) {
      const cur = m.get(t.application_id) || { done: 0, total: 0, pending: [] as string[] }
      cur.total += 1
      if (t.done) cur.done += 1
      else if (t.label) cur.pending.push(t.label)
      m.set(t.application_id, cur)
    }
    return m
  }, [onboarding])

  // Rejection reasons (rejected section).
  const reasonIds = useMemo(
    () =>
      Array.from(
        new Set(relevantAssocs.map((a: any) => a.rejection_reason_id).filter(Boolean)),
      ).sort() as string[],
    [relevantAssocs],
  )

  const { data: reasons } = useQuery({
    queryKey: ['ps-rejection-reasons', reasonIds.join(',')],
    queryFn: async () => {
      if (!reasonIds.length) return []
      const { data } = await supabase
        .from('rejection_reasons')
        .select('id, name, category')
        .in('id', reasonIds)
      return data || []
    },
    enabled: section === 'rejected' && reasonIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const reasonById = useMemo(() => {
    const m = new Map<string, { name: string; category: string }>()
    for (const r of (reasons as any[]) || []) m.set(r.id, { name: r.name, category: r.category })
    return m
  }, [reasons])

  // Furthest stage reached (rejected section).
  const { data: history } = useQuery({
    queryKey: ['ps-stage-history', assocIds.join(',')],
    queryFn: async () => {
      if (!assocIds.length) return []
      const { data } = await supabase
        .from('job_candidate_stage_history')
        .select('association_id, to_stage_id, moved_at')
        .in('association_id', assocIds)
        .order('moved_at', { ascending: true })
      return data || []
    },
    enabled: section === 'rejected' && assocIds.length > 0,
    staleTime: 60 * 1000,
  })

  const reachedByAssoc = useMemo(() => {
    const m = new Map<string, string>()
    for (const h of (history as any[]) || []) {
      const name = h.to_stage_id ? stageMap[h.to_stage_id]?.name : null
      if (name) m.set(h.association_id, name)
    }
    return m
  }, [history, stageMap])

  const rows: PSRowData[] = useMemo(() => {
    return (candidates || []).map((c: any) => {
      const a = assocByCandidate.get(c.id) || {}
      const base: PSRowData = {
        id: c.id,
        associationId: a.id ?? null,
        name: c.candidate_name || 'Unnamed candidate',
        role: c.current_job_title || c.role_current || null,
        company: c.company_current || null,
        favorite: !!a.is_favorite,
        score: typeof a.ai_fit_score === 'number' ? a.ai_fit_score : (c.ai_fit_score ?? null),
        raw: c,
      }

      if (section === 'application') {
        const days = dayDiff(a.entered_stage_at || a.created_at || c.created_at)
        const source = titleCase(c.source || c.job_board_source)
        const owner = a.added_by ? ownerById.get(a.added_by) : undefined
        let status = null as PSRowData['status']
        if (typeof days === 'number' && days > 7) {
          status = {
            label: 'Past SLA',
            icon: PS_STATUS_ICONS.alert,
            color: PS_RUST,
            note: `48h target · ${days} days waiting`,
          }
        } else if (/referral/i.test(source || '')) {
          status = {
            label: 'Referral',
            icon: PS_STATUS_ICONS.userCheck,
            color: PS_TEAL,
            note: owner?.name ? `Vouched by ${owner.name.split(' ')[0]}` : null,
          }
        } else if (typeof base.score === 'number') {
          status = {
            label: `Auto-screened · ${base.score >= 70 ? 'pass' : 'review'}`,
            icon: PS_STATUS_ICONS.sparkles,
            color: PS_PURPLE,
            note: `Match ${Math.round(base.score)} against this job's must-haves`,
          }
        } else {
          status = { label: 'Awaiting review', icon: PS_STATUS_ICONS.clock, color: PS_TERTIARY, note: null }
        }
        return { ...base, days, source, status, ownerName: owner?.name ?? null, ownerAvatar: owner?.avatar ?? null }
      }

      if (section === 'offers') {
        const offer = offerByCandidate.get(c.id)
        const sentAt = offer?.sent_at || a.offered_at || offer?.created_at
        const days = dayDiff(sentAt)
        const owner = a.offered_by ? ownerById.get(a.offered_by) : a.added_by ? ownerById.get(a.added_by) : undefined
        const st = (offer?.status || '').toLowerCase()
        let status: PSRowData['status'] = null
        const expiresDays = offer?.expires_at
          ? Math.ceil((new Date(offer.expires_at).getTime() - Date.now()) / 86400000)
          : null
        if (/approv/.test(st)) {
          status = {
            label: 'Awaiting approval',
            icon: PS_STATUS_ICONS.shield,
            color: PS_TEAL,
            note: 'With the approval chain',
          }
        } else if (/negotiat|counter/.test(st)) {
          status = {
            label: 'Negotiating',
            icon: PS_STATUS_ICONS.message,
            color: PS_RUST,
            note: 'Counter under discussion',
          }
        } else {
          status = {
            label: 'Awaiting response',
            icon: PS_STATUS_ICONS.clock,
            color: PS_AMBER,
            note:
              typeof expiresDays === 'number'
                ? expiresDays >= 0
                  ? `Expires in ${expiresDays} day${expiresDays === 1 ? '' : 's'}`
                  : 'Response deadline passed'
                : 'No response deadline set',
          }
        }
        return {
          ...base,
          days,
          offerLabel: offerFigure(offer?.field_values),
          status,
          ownerName: owner?.name ?? null,
          ownerAvatar: owner?.avatar ?? null,
        }
      }

      if (section === 'hired') {
        const offer = offerByCandidate.get(c.id)
        const ob = a.id ? onboardingByAssoc.get(a.id) : undefined
        const owner = a.hired_by ? ownerById.get(a.hired_by) : a.added_by ? ownerById.get(a.added_by) : undefined
        const status: PSRowData['status'] = !ob || ob.total === 0
          ? {
              label: 'Onboarding · not started',
              icon: PS_STATUS_ICONS.loader,
              color: PS_AMBER,
              note: 'No checklist attached yet',
            }
          : ob.done === ob.total
            ? {
                label: 'Ready to start',
                icon: PS_STATUS_ICONS.check,
                color: PS_GREEN,
                note: `All ${ob.total} steps complete`,
              }
            : {
                label: `Onboarding · ${ob.done} of ${ob.total}`,
                icon: PS_STATUS_ICONS.loader,
                color: PS_AMBER,
                note: ob.pending.length ? `${ob.pending.slice(0, 2).join(' · ')} pending` : null,
              }
        return {
          ...base,
          acceptedLabel: shortDate(a.hired_at || a.updated_at),
          startDateLabel: startDateFromOffer(offer?.field_values),
          status,
          ownerName: owner?.name ?? null,
          ownerAvatar: owner?.avatar ?? null,
        }
      }

      // rejected
      const reason = a.rejection_reason_id ? reasonById.get(a.rejection_reason_id) : undefined
      const owner = a.rejected_by ? ownerById.get(a.rejected_by) : undefined
      const withdrew = reason?.category === 'candidate_declined'
      const autoScreened = !reason && typeof base.score === 'number' && base.score < 50
      const status: PSRowData['status'] = reason
        ? {
            label: reason.name,
            icon: withdrew ? PS_STATUS_ICONS.userX : PS_STATUS_ICONS.slash,
            color: withdrew ? PS_TERTIARY : PS_RUST,
            note: a.rejection_notes || (reachedByAssoc.get(a.id) ? `Rejected after ${reachedByAssoc.get(a.id)}` : null),
          }
        : autoScreened
          ? {
              label: 'Auto-screened out',
              icon: PS_STATUS_ICONS.sparkles,
              color: PS_TERTIARY,
              note: 'Below match floor',
            }
          : {
              label: 'No reason recorded',
              icon: PS_STATUS_ICONS.slash,
              color: PS_TERTIARY,
              note: a.rejection_notes || null,
            }
      return {
        ...base,
        reachedLabel: (a.id ? reachedByAssoc.get(a.id) : null) ?? (a.current_stage_id ? stageMap[a.current_stage_id]?.name : null) ?? null,
        rejectedLabel: shortDate(a.rejected_at || a.updated_at),
        status,
        ownerName: owner?.name ?? null,
        ownerAvatar: owner?.avatar ?? null,
      }
    })
  }, [
    candidates,
    section,
    assocByCandidate,
    ownerById,
    offerByCandidate,
    onboardingByAssoc,
    reasonById,
    reachedByAssoc,
    stageMap,
  ])

  return rows
}
