import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'

/**
 * A person's work profile (os_person_work) and manager rating
 * (os_person_rating), Member profile step 3 (Allan, 2026-10-23).
 * Everyone in the workspace reads the work profile; People & Access admins
 * edit it. The rating is admins only. The load is counted from the person's
 * seats on open jobs, never stored.
 */

export const SEGMENTS = [
  { id: 'smb', label: 'SMB', hint: 'Small business' },
  { id: 'mm', label: 'MM', hint: 'Mid-market' },
  { id: 'ent', label: 'ENT', hint: 'Enterprise' },
] as const
export type Segment = (typeof SEGMENTS)[number]['id']

/** The job areas a person specialises in. Same keys as the database check. */
export const SPECIALTIES = [
  { id: 'sales', label: 'Sales' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'customer_success', label: 'Customer Success' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'operations', label: 'Operations' },
  { id: 'finance', label: 'Finance' },
  { id: 'people', label: 'People' },
  { id: 'product', label: 'Product' },
  { id: 'data', label: 'Data' },
  { id: 'executive', label: 'Executive' },
] as const
export type Specialty = (typeof SPECIALTIES)[number]['id']

export const segmentLabel = (id: string) => SEGMENTS.find((s) => s.id === id)?.label ?? id
export const specialtyLabel = (id: string) => SPECIALTIES.find((s) => s.id === id)?.label ?? id

/** Job roles (People & Access bundles) that work in segments. */
export const SEGMENT_ROLES = ['TA / Sourcer', 'Engagement Specialist']
export const takesSegments = (jobRole: string | null | undefined) =>
  !!jobRole && SEGMENT_ROLES.some((r) => r.toLowerCase() === jobRole.trim().toLowerCase())

export const MAX_CAPACITY = 200

export interface WorkProfile {
  segments: Segment[]
  specialties: Specialty[]
  max_open_jobs: number | null
}

export const EMPTY_WORK: WorkProfile = { segments: [], specialties: [], max_open_jobs: null }

export interface Rating {
  rating: number | null
  note: string | null
  rated_by: string | null
  rated_at: string | null
}

/** How full someone is: under 80% is fine, up to 100% is near, above is over. */
export type LoadLevel = 'unset' | 'ok' | 'near' | 'over'
export function loadLevel(open: number, max: number | null): LoadLevel {
  if (!max) return 'unset'
  if (open > max) return 'over'
  if (open >= Math.ceil(max * 0.8)) return 'near'
  return 'ok'
}

const keys = {
  work: (tenantId: string | undefined, userId: string | null | undefined) => ['os-person-work', tenantId, userId] as const,
  rating: (tenantId: string | undefined, userId: string | null | undefined) => ['os-person-rating', tenantId, userId] as const,
}

const WORK_COLS = 'segments, specialties, max_open_jobs'
const RATING_COLS = 'rating, note, rated_by, rated_at'

export function useWorkProfile(tenantId: string | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: keys.work(tenantId, userId),
    enabled: !!tenantId && !!userId,
    queryFn: async (): Promise<WorkProfile> => {
      const { data, error } = await supabase
        .from('os_person_work')
        .select(WORK_COLS)
        .eq('tenant_id', tenantId!)
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return (data as WorkProfile | null) ?? EMPTY_WORK
    },
  })
}

/** Saves the whole profile; shows the change at once and puts it back if the save fails. */
export function useSaveWorkProfile(tenantId: string | undefined, userId: string | null | undefined) {
  const qc = useQueryClient()
  const key = keys.work(tenantId, userId)
  return useMutation({
    mutationFn: async (work: WorkProfile) => {
      const { data, error } = await supabase
        .from('os_person_work')
        .upsert({ tenant_id: tenantId!, user_id: userId!, ...work }, { onConflict: 'tenant_id,user_id' })
        .select(WORK_COLS)
        .single()
      if (error) throw error
      return data as WorkProfile
    },
    onMutate: async (work) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<WorkProfile>(key)
      qc.setQueryData(key, work)
      return { previous }
    },
    onError: (_e, _work, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    onSuccess: (saved) => {
      qc.setQueryData(key, saved)
      void qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
    },
  })
}

export function useRating(tenantId: string | undefined, userId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: keys.rating(tenantId, userId),
    enabled: enabled && !!tenantId && !!userId,
    queryFn: async (): Promise<Rating | null> => {
      const { data, error } = await supabase
        .from('os_person_rating')
        .select(RATING_COLS)
        .eq('tenant_id', tenantId!)
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data as Rating | null
    },
  })
}

export function useSaveRating(tenantId: string | undefined, userId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (r: { rating: number | null; note: string | null }) => {
      const { data, error } = await supabase
        .from('os_person_rating')
        .upsert({ tenant_id: tenantId!, user_id: userId!, ...r }, { onConflict: 'tenant_id,user_id' })
        .select(RATING_COLS)
        .single()
      if (error) throw error
      return data as Rating
    },
    onSuccess: (saved) => {
      qc.setQueryData(keys.rating(tenantId, userId), saved)
      void qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
    },
  })
}

/** The rating's words, shown beside the stars. */
export const RATING_WORDS: Record<number, string> = {
  1: 'Needs support',
  2: 'Below expectations',
  3: 'Meets expectations',
  4: 'Strong',
  5: 'Exceptional',
}
