import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { channelLabel } from '@/lib/applySource'
import type { ShareVoice } from '../../supabase/functions/_shared/sharePosts.ts'

export { fillLink, postingFacts, type ShareVoice } from '../../supabase/functions/_shared/sharePosts.ts'

/**
 * The share kit (job exposure, Phase 1; Allan, Go! 2026-11-12): a job's live post shared
 * by channel, each link tagged so the application says where it came from
 * (`?src=` the channel, `?by=` the teammate's share code or `client`).
 */

export type ShareChannel = 'linkedin' | 'whatsapp' | 'x' | 'facebook' | 'email' | 'anywhere'

export const SHARE_CHANNELS: { key: ShareChannel; label: string; hint: string }[] = [
  { key: 'linkedin', label: 'LinkedIn', hint: 'Copy the post, then paste it in LinkedIn' },
  { key: 'whatsapp', label: 'WhatsApp', hint: 'Opens WhatsApp with the message' },
  { key: 'x', label: 'X', hint: 'Opens a post with the link' },
  { key: 'facebook', label: 'Facebook', hint: 'Opens Facebook with the link' },
  { key: 'email', label: 'Email', hint: 'Opens your email with the message' },
  { key: 'anywhere', label: 'Anywhere else', hint: 'A group, a newsletter, a community' },
]

/** The job post's address with this channel's tags. `anywhere` names no channel: the sending site decides. */
export function shareLink(url: string, channel: ShareChannel, by: string | null): string {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return url
  }
  u.search = ''
  if (channel !== 'anywhere') u.searchParams.set('src', channel)
  if (by) u.searchParams.set('by', by)
  return u.toString()
}

/** Where a channel's button goes: the site's own share page, prefilled where it takes text. */
export function shareIntent(channel: ShareChannel, link: string, text: string, title: string): string | null {
  const e = encodeURIComponent
  switch (channel) {
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${e(link)}`
    case 'whatsapp':
      return `https://wa.me/?text=${e(text || link)}`
    case 'x':
      return `https://x.com/intent/post?text=${e(title)}&url=${e(link)}`
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${e(link)}`
    case 'email':
      return `mailto:?subject=${e(title)}&body=${e(text || link)}`
    default:
      return null
  }
}

/** Your share code (made on first use), or `client` for the client's team's links. */
export function useShareCode(enabled: boolean) {
  return useQuery({
    queryKey: ['posting-share-code'],
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('posting_share_code' as never)
      if (error) throw error
      return typeof data === 'string' ? data : null
    },
  })
}

export interface SourceCount {
  key: string | null
  label: string
  count: number
}

/** A job's applications by where they came from, most first; the untracked ones last. */
export function countSources(rows: { applied_via: string | null }[]): SourceCount[] {
  const by = new Map<string | null, number>()
  for (const r of rows) by.set(r.applied_via ?? null, (by.get(r.applied_via ?? null) ?? 0) + 1)
  return Array.from(by.entries())
    .map(([key, count]) => ({ key, count, label: channelLabel(key) }))
    .sort((a, b) => (a.key === null ? 1 : b.key === null ? -1 : b.count - a.count || a.label.localeCompare(b.label)))
}

export function useApplySourceCounts(jobId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['job-apply-sources', jobId],
    enabled: enabled && !!jobId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select('applied_via' as never)
        .eq('job_id', jobId!)
        .not('applied_at', 'is', null)
        .limit(5000)
      if (error) throw error
      return countSources((data ?? []) as unknown as { applied_via: string | null }[])
    },
  })
}

export interface SharePosts {
  linkedin: string
  whatsapp: string
  language: string | null
  voice: ShareVoice
}

/** Gio writes the LinkedIn post and the WhatsApp message. The error is a sentence to show. */
export function useSharePosts(jobId: string) {
  return useMutation({
    mutationFn: async (voice: ShareVoice): Promise<SharePosts> => {
      const { data, error } = await supabase.functions.invoke('generate-share-posts', { body: { job_id: jobId, voice } })
      if (error) {
        let message = "Gio couldn't write the posts."
        try {
          const ctx = (error as { context?: Response }).context
          const parsed = ctx ? await ctx.json() : null
          if (parsed?.code === 'no_live_post') message = 'This job has no live job post to share.'
          if (parsed?.code === 'no_description') message = 'The job post needs a description before Gio can write about it.'
        } catch {
          /* keep the general sentence */
        }
        throw new Error(message)
      }
      return data as SharePosts
    },
  })
}
