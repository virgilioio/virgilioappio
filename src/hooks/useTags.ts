import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { useMemo } from 'react'

export interface Tag {
  id: string
  tenant_id: string
  name: string
  color: string
  created_by: string | null
  created_at: string
  updated_at: string
  usage_count?: number
}

const db = supabase as any

const RECENT_KEY = 'virgilio:tags:recent'

export function getRecentTagIds(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[] } catch { return [] }
}
export function pushRecentTagId(id: string) {
  const cur = getRecentTagIds().filter(x => x !== id)
  cur.unshift(id)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, 6))) } catch {}
}

export function useTags() {
  const { tenant } = useTenant()
  const queryClient = useQueryClient()
  const queryKey = ['tags', tenant?.id]

  const tagsQuery = useQuery({
    queryKey,
    enabled: !!tenant,
    queryFn: async () => {
      if (!tenant) return [] as Tag[]
      const { data: tags, error } = await db
        .from('tags')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('name', { ascending: true })
      if (error) throw error
      const { data: counts } = await db
        .from('candidate_tags')
        .select('tag_id')
        .eq('tenant_id', tenant.id)
      const countMap = new Map<string, number>()
      for (const row of (counts ?? []) as { tag_id: string }[]) {
        countMap.set(row.tag_id, (countMap.get(row.tag_id) ?? 0) + 1)
      }
      return ((tags ?? []) as Tag[]).map(t => ({ ...t, usage_count: countMap.get(t.id) ?? 0 }))
    },
  })

  return {
    tags: (tagsQuery.data ?? []) as Tag[],
    isLoading: tagsQuery.isLoading,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  }
}

export function useCandidateTagsMap(candidateIds: string[]) {
  const { tenant } = useTenant()
  const key = useMemo(() => [...candidateIds].sort().join(','), [candidateIds])
  return useQuery({
    queryKey: ['candidate-tags', tenant?.id, key],
    enabled: !!tenant && candidateIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db
        .from('candidate_tags')
        .select('candidate_id, tag_id')
        .in('candidate_id', candidateIds)
      if (error) throw error
      const map: Record<string, string[]> = {}
      for (const id of candidateIds) map[id] = []
      for (const row of (data ?? []) as { candidate_id: string; tag_id: string }[]) {
        ;(map[row.candidate_id] ??= []).push(row.tag_id)
      }
      return map
    },
  })
}

/** Map every candidate to its tag ids (used for the rail filter). */
export function useAllCandidateTagsMap() {
  const { tenant } = useTenant()
  return useQuery({
    queryKey: ['candidate-tags-all', tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await db
        .from('candidate_tags')
        .select('candidate_id, tag_id')
        .eq('tenant_id', tenant!.id)
      if (error) throw error
      const map = new Map<string, string[]>()
      for (const row of (data ?? []) as { candidate_id: string; tag_id: string }[]) {
        const arr = map.get(row.candidate_id) ?? []
        arr.push(row.tag_id)
        map.set(row.candidate_id, arr)
      }
      return map
    },
  })
}

export function useTagMutations() {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const qc = useQueryClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tags'] })
    qc.invalidateQueries({ queryKey: ['candidate-tags'] })
    qc.invalidateQueries({ queryKey: ['candidate-tags-all'] })
  }

  const createTag = useMutation({
    mutationFn: async (input: { name: string; color: string }) => {
      if (!user || !tenant) throw new Error('Not authenticated')
      const { data, error } = await db
        .from('tags')
        .insert({
          tenant_id: tenant.id,
          name: input.name.trim(),
          color: input.color,
          created_by: user.id,
        })
        .select()
        .single()
      if (error) throw error
      return data as Tag
    },
    onSuccess: () => invalidate(),
  })

  const renameTag = useMutation({
    mutationFn: async (input: { id: string; name?: string; color?: string }) => {
      const patch: Record<string, unknown> = {}
      if (input.name !== undefined) patch.name = input.name.trim()
      if (input.color !== undefined) patch.color = input.color
      const { error } = await db.from('tags').update(patch).eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => invalidate(),
  })

  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('tags').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidate(),
  })

  const applyTags = useMutation({
    mutationFn: async (input: { candidateIds: string[]; addTagIds?: string[]; removeTagIds?: string[] }) => {
      const { candidateIds, addTagIds = [], removeTagIds = [] } = input
      if (candidateIds.length === 0) return
      if (removeTagIds.length > 0) {
        const { error } = await db
          .from('candidate_tags')
          .delete()
          .in('candidate_id', candidateIds)
          .in('tag_id', removeTagIds)
        if (error) throw error
      }
      if (addTagIds.length > 0) {
        const rows = candidateIds.flatMap(cid =>
          addTagIds.map(tid => ({ candidate_id: cid, tag_id: tid, tenant_id: tenant?.id })),
        )
        const { error } = await db
          .from('candidate_tags')
          .upsert(rows, { onConflict: 'candidate_id,tag_id', ignoreDuplicates: true })
        if (error) throw error
      }
    },
    onSuccess: () => invalidate(),
  })

  return { createTag, renameTag, deleteTag, applyTags }
}

export const TAG_COLOR_PRESETS = [
  'purple', 'green', 'blue', 'pink', 'yellow', 'orange', 'lilac', 'neutral',
] as const
export type TagColor = typeof TAG_COLOR_PRESETS[number]

const COLOR_TO_CLASSES: Record<string, { dot: string; chip: string; text: string }> = {
  purple:  { dot: 'bg-virgilio-purple',         chip: 'bg-pastel-purple/40',  text: 'text-pastel-purple-foreground' },
  green:   { dot: 'bg-pastel-green-foreground', chip: 'bg-pastel-green/40',   text: 'text-pastel-green-foreground' },
  blue:    { dot: 'bg-pastel-blue-foreground',  chip: 'bg-pastel-blue/40',    text: 'text-pastel-blue-foreground' },
  pink:    { dot: 'bg-pastel-pink-foreground',  chip: 'bg-pastel-pink/40',    text: 'text-pastel-pink-foreground' },
  yellow:  { dot: 'bg-pastel-yellow-foreground',chip: 'bg-pastel-yellow/40',  text: 'text-pastel-yellow-foreground' },
  orange:  { dot: 'bg-pastel-orange-foreground',chip: 'bg-pastel-orange/40',  text: 'text-pastel-orange-foreground' },
  lilac:   { dot: 'bg-virgilio-purple/70',      chip: 'bg-virgilio-purple/10',text: 'text-virgilio-purple' },
  neutral: { dot: 'bg-text-tertiary',           chip: 'bg-muted',             text: 'text-text-secondary' },
}
export function tagColorClasses(color?: string | null) {
  return COLOR_TO_CLASSES[color ?? 'purple'] ?? COLOR_TO_CLASSES.purple
}
