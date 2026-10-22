import { supabase } from '@/integrations/supabase/client'

/**
 * A job post's cover image and video (Allan, 2026-10-22). Both editors (Create
 * job › Posting and the job page's posting sheet) write the same keys on
 * job_postings.details, and the public post reads them through readBranding():
 *   brand_color, banner_url, banner_name,
 *   video: { enabled, source: 'link' | 'upload', url, name }
 * Files live in the public bucket job-posting-media under {job_id}/.
 */

export const POSTING_MEDIA_BUCKET = 'job-posting-media'
export const VIDEO_MAX_BYTES = 200 * 1024 * 1024
export const COVER_MAX_BYTES = 5 * 1024 * 1024
const COVER_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export interface PostingVideo {
  enabled: boolean
  source: 'link' | 'upload'
  url: string | null
  /** The uploaded file's name, shown in the editor. */
  name?: string | null
}

export interface PostingBranding {
  brandColor: string | null
  bannerUrl: string | null
  bannerName: string | null
  video: PostingVideo
}

export const NO_VIDEO: PostingVideo = { enabled: false, source: 'link', url: null, name: null }

type Details = Record<string, unknown> | null | undefined

/**
 * Reads branding from a posting's details: the shared keys first, then the
 * older posting-sheet shape (details.branding), whose banner was a temporary
 * browser link and is skipped.
 */
export function readBranding(details: Details): PostingBranding {
  const d = (details ?? {}) as Record<string, unknown>
  const obj = (x: unknown) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {})
  const str = (x: unknown) => (typeof x === 'string' && x ? x : null)
  const old = obj(d.branding)
  const oldBanner = str(old.hero_url) && /^https?:/i.test(old.hero_url as string) ? (old.hero_url as string) : null
  const v = obj(d.video)
  return {
    brandColor: str(d.brand_color) || str(old.brand_color),
    bannerUrl: str(d.banner_url) || oldBanner,
    bannerName: str(d.banner_name),
    video: {
      enabled: !!v.enabled,
      source: v.source === 'upload' ? 'upload' : 'link',
      url: str(v.url),
      name: str(v.name),
    },
  }
}

/**
 * The keys both editors save. The old details.branding is cleared so the two
 * can't disagree, and team_photos (a switch that never did anything) is cleared
 * from postings that still carry it.
 */
export function brandingDetails(b: PostingBranding) {
  return {
    brand_color: b.brandColor || null,
    banner_url: b.bannerUrl || null,
    banner_name: b.bannerName || null,
    team_photos: null,
    video: { enabled: b.video.enabled, source: b.video.source, url: b.video.url, name: b.video.name ?? null },
    branding: null,
    culture_video: null,
  }
}

/** A video that is on and has something to play. */
export function playableVideo(v: PostingVideo | null | undefined): VideoSource | null {
  if (!v?.enabled || !v.url) return null
  return v.source === 'upload' ? { kind: 'file', src: v.url } : parseVideoLink(v.url)
}

export type VideoSource =
  | { kind: 'file'; src: string }
  | { kind: 'youtube' | 'vimeo' | 'loom'; id: string }

/** YouTube, Vimeo, Loom or a direct .mp4 link; anything else is null. */
export function parseVideoLink(raw: string): VideoSource | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (!/^https?:$/.test(u.protocol)) return null
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0]
    return /^[\w-]{6,}$/.test(id) ? { kind: 'youtube', id } : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id =
      u.searchParams.get('v') ||
      u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1] ||
      ''
    return /^[\w-]{6,}$/.test(id) ? { kind: 'youtube', id } : null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.match(/(\d{5,})/)?.[1]
    return id ? { kind: 'vimeo', id } : null
  }
  if (host === 'loom.com') {
    const id = u.pathname.match(/^\/(?:share|embed)\/([0-9a-f]{16,})/i)?.[1]
    return id ? { kind: 'loom', id } : null
  }
  if (/\.mp4$/i.test(u.pathname)) return { kind: 'file', src: u.toString() }
  return null
}

/** The player address for a link; `sound` asks it to start unmuted. */
export function embedUrl(v: Exclude<VideoSource, { kind: 'file' }>, opts: { autoplay: boolean; sound: boolean }) {
  const play = opts.autoplay ? '1' : '0'
  const mute = opts.sound ? '0' : '1'
  switch (v.kind) {
    case 'youtube':
      return `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=${play}&mute=${mute}&playsinline=1&rel=0`
    case 'vimeo':
      return `https://player.vimeo.com/video/${v.id}?autoplay=${play}&muted=${mute}&playsinline=1`
    case 'loom':
      return `https://www.loom.com/embed/${v.id}?autoplay=${play}&muted=${opts.sound ? 'false' : 'true'}&hide_owner=true&hide_share=true`
  }
}

/** Why a file can't be used, in plain words; null when it can. */
export function mediaFileProblem(file: File, kind: 'cover' | 'video'): string | null {
  if (kind === 'video') {
    if (file.type !== 'video/mp4' && !/\.mp4$/i.test(file.name)) return 'Choose an MP4 video.'
    if (file.size > VIDEO_MAX_BYTES) return 'Videos can be up to 200 MB.'
    return null
  }
  if (!COVER_TYPES.includes(file.type)) return 'Choose a PNG, JPG or WebP image.'
  if (file.size > COVER_MAX_BYTES) return 'Cover images can be up to 5 MB.'
  return null
}

/** Uploads a cover or video into the job's folder and returns its public address. */
export async function uploadPostingMedia(jobId: string, file: File, kind: 'cover' | 'video'): Promise<string> {
  const problem = mediaFileProblem(file, kind)
  if (problem) throw new Error(problem)
  const ext = kind === 'video' ? 'mp4' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${jobId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(POSTING_MEDIA_BUCKET).upload(path, file, {
    contentType: kind === 'video' ? 'video/mp4' : file.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(kind === 'video' ? "Couldn't upload the video. Try again." : "Couldn't upload the image. Try again.")
  return supabase.storage.from(POSTING_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}
