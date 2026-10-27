import { supabase } from '@/lib/supabaseClient'

/**
 * File questions on public application forms: Audio, Video and File upload.
 * The browser asks public-application-upload for a one-time link, then puts
 * the file straight into storage with real progress; the answer sent with the
 * application is the staged file ({ path, name, type, size }), which
 * public-submit-application checks and files with the candidate.
 * Kept in step with supabase/functions/_shared/applicationMedia.ts.
 */
export type MediaKind = 'audio' | 'video' | 'file'

export const MEDIA_RULES: Record<MediaKind, { exts: string[]; accept: string; maxBytes: number; label: string; hint: string }> = {
  audio: {
    exts: ['mp3', 'm4a', 'wav', 'ogg', 'aac'],
    accept: 'audio/*,.mp3,.m4a,.wav,.ogg,.aac',
    maxBytes: 100 * 1024 * 1024,
    label: 'MP3, M4A, WAV, OGG or AAC, up to 100 MB',
    hint: 'MP3, M4A or WAV · up to 100 MB',
  },
  video: {
    exts: ['mp4', 'mov', 'm4v', 'webm'],
    accept: 'video/*,.mp4,.mov,.m4v,.webm',
    maxBytes: 500 * 1024 * 1024,
    label: 'MP4, MOV or WebM, up to 500 MB',
    hint: 'MP4, MOV or WebM · up to 500 MB',
  },
  file: {
    exts: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'jpg', 'jpeg', 'png'],
    accept: '.pdf,.doc,.docx,.txt,.rtf,.odt,.jpg,.jpeg,.png',
    maxBytes: 25 * 1024 * 1024,
    label: 'PDF, Word, text or an image, up to 25 MB',
    hint: 'PDF, Word or an image · up to 25 MB',
  },
}

export function isMediaKind(t: unknown): t is MediaKind {
  return t === 'audio' || t === 'video' || t === 'file'
}

function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name || '')
  return m ? m[1].toLowerCase() : ''
}

/** Why this file can't answer the question, or null. Checked again on the server. */
export function mediaFileProblem(kind: MediaKind, file: File): string | null {
  const rule = MEDIA_RULES[kind]
  if (!rule.exts.includes(extOf(file.name))) return `This question takes ${rule.label}.`
  if (file.size <= 0) return 'That file is empty.'
  if (file.size > rule.maxBytes) return `That file is too big. This question takes ${rule.label}.`
  return null
}

export interface StagedMedia {
  path: string
  name: string
  type: string
  size: number
}

const TYPE_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain', rtf: 'application/rtf', odt: 'application/vnd.oasis.opendocument.text',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
}

export class UploadProblem extends Error {}

/**
 * Upload one answer file. Resolves with the staged file to send with the
 * application; `onProgress` gets 0–100; `signal` cancels it.
 */
export async function uploadApplicationMedia(
  postingId: string,
  fieldId: string,
  file: File,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<StagedMedia> {
  const type = file.type || TYPE_BY_EXT[extOf(file.name)] || 'application/octet-stream'
  const { data, error } = await supabase.functions.invoke('public-application-upload', {
    body: { posting_id: postingId, field_id: fieldId, file_name: file.name, content_type: type, size: file.size },
  })
  if (error || !data?.signed_url) {
    let message = 'The upload couldn’t start. Try again.'
    try {
      const ctx = (error as { context?: Response } | null)?.context
      const body = ctx ? await ctx.json() : null
      if (body?.error) message = body.error
    } catch {
      /* keep the plain message */
    }
    throw new UploadProblem(message)
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', data.signed_url)
    xhr.setRequestHeader('content-type', type)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.min(99, (e.loaded / e.total) * 100))
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadProblem(`Couldn’t upload ${file.name}. Try again.`)))
    xhr.onerror = () => reject(new UploadProblem(`Couldn’t upload ${file.name}. Check your connection and try again.`))
    xhr.onabort = () => reject(new UploadProblem('Upload cancelled.'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(file)
  })
  onProgress(100)
  return { path: data.path as string, name: file.name, type, size: file.size }
}

/** A filed answer as stored in candidate_application_responses.field_value. */
export interface MediaAnswer {
  attachment_id: string
  name: string
  type?: string
  size?: number
  kind?: MediaKind
}

export function readMediaAnswer(value: unknown): MediaAnswer | null {
  let v = value
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v)
    } catch {
      return null
    }
  }
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.attachment_id !== 'string' || typeof o.name !== 'string') return null
  return {
    attachment_id: o.attachment_id,
    name: o.name,
    type: typeof o.type === 'string' ? o.type : undefined,
    size: typeof o.size === 'number' ? o.size : undefined,
    kind: isMediaKind(o.kind) ? o.kind : undefined,
  }
}
