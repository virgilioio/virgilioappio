import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/integrations/supabase/client'

/**
 * Useful links (member profile part 2, 2026-10-24): links People & Access
 * admins pin for everyone in the workspace, shown on the My profile home.
 * Every member reads the live ones; admins add, edit, reorder and archive
 * (never erase) them. The database tidies the text, refuses anything that
 * isn't a web address and writes each change to the history.
 */

export interface UsefulLink {
  id: string
  title: string
  description: string | null
  url: string
  position: number
  archived_at: string | null
}

export interface LinkDraft {
  title: string
  description: string
  url: string
}

const key = (tenantId?: string) => ['useful-links', tenantId] as const

/** Live links in order; archived ones too for admins who ask (they come last). */
export function useUsefulLinks(tenantId: string | undefined) {
  return useQuery({
    queryKey: key(tenantId),
    enabled: !!tenantId,
    queryFn: async (): Promise<UsefulLink[]> => {
      const { data, error } = await supabase
        .from('os_useful_links')
        .select('id, title, description, url, position, archived_at')
        .eq('tenant_id', tenantId!)
        .order('position')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as UsefulLink[]
    },
  })
}

/** "https://…" in front of a bare address, so "notion.so/handbook" works too. */
export function normalUrl(raw: string) {
  const v = raw.trim()
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

/** The site's name for the row's second line: "notion.so". */
export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** The database's rules, worded for the form. */
export function linkProblems(d: LinkDraft): Partial<Record<keyof LinkDraft, string>> {
  const p: Partial<Record<keyof LinkDraft, string>> = {}
  const title = d.title.trim()
  if (!title) p.title = 'Give the link a name.'
  else if (title.length > 80) p.title = 'Keep the name to 80 characters.'
  if (d.description.trim().length > 200) p.description = 'Keep the description to 200 characters.'
  const url = normalUrl(d.url)
  if (!url) p.url = 'Add the address.'
  else if (url.length > 2000 || /\s/.test(url)) p.url = "This doesn't look like a web address."
  else {
    try {
      const u = new URL(url)
      if (!u.hostname.includes('.')) p.url = "This doesn't look like a web address."
    } catch {
      p.url = "This doesn't look like a web address."
    }
  }
  return p
}

export function useSaveLink(tenantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, draft, position }: { id?: string; draft: LinkDraft; position?: number }) => {
      const row = { title: draft.title.trim(), description: draft.description.trim() || null, url: normalUrl(draft.url) }
      const { error } = id
        ? await supabase.from('os_useful_links').update(row).eq('id', id)
        : await supabase.from('os_useful_links').insert({ ...row, tenant_id: tenantId!, position: position ?? 0 })
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key(tenantId) })
      void qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
    },
  })
}

/** Archive or restore, optimistic: the row leaves (or comes back) at once. */
export function useArchiveLink(tenantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('os_useful_links')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, archived }) => {
      await qc.cancelQueries({ queryKey: key(tenantId) })
      const before = qc.getQueryData<UsefulLink[]>(key(tenantId))
      qc.setQueryData<UsefulLink[]>(key(tenantId), (rows) =>
        rows?.map((r) => (r.id === id ? { ...r, archived_at: archived ? new Date().toISOString() : null } : r)),
      )
      return { before }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(key(tenantId), ctx.before)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key(tenantId) })
      void qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
    },
  })
}

/** Moves one link up or down by swapping positions with its neighbour, optimistic. */
export function useMoveLink(tenantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (order: UsefulLink[]) => {
      // Positions are rewritten 10 apart, so there is always room between two links.
      const results = await Promise.all(
        order.map((l, i) => supabase.from('os_useful_links').update({ position: (i + 1) * 10 }).eq('id', l.id)),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },
    onMutate: async (order) => {
      await qc.cancelQueries({ queryKey: key(tenantId) })
      const before = qc.getQueryData<UsefulLink[]>(key(tenantId))
      const pos = new Map(order.map((l, i) => [l.id, (i + 1) * 10]))
      qc.setQueryData<UsefulLink[]>(key(tenantId), (rows) =>
        rows
          ?.map((r) => (pos.has(r.id) ? { ...r, position: pos.get(r.id)! } : r))
          .sort((a, b) => a.position - b.position),
      )
      return { before }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(key(tenantId), ctx.before)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key(tenantId) }),
  })
}
