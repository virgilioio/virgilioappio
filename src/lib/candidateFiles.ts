/**
 * What a candidate file is, and how big it may be (Allan, 2026-10-20: videos
 * such as MP4 go on a candidate's Files and play in the profile and the client
 * dossier).
 *
 * The storage bucket `candidate-attachments` holds the largest of these limits;
 * the project's global upload limit (Supabase › Storage › Settings) must be at
 * least as large, or bigger videos are refused there.
 */

export type FileKind = 'video' | 'audio' | 'image' | 'document' | 'other'

const MB = 1024 * 1024

const VIDEO_EXT: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', webm: 'video/webm' }
const AUDIO_EXT: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', aac: 'audio/aac' }

const extOf = (name: string) => (name.split('.').pop() || '').toLowerCase()

export function fileKind(name: string | null | undefined, type: string | null | undefined): FileKind {
  const ext = extOf(name || '')
  const t = type || ''
  if (VIDEO_EXT[ext] || t.startsWith('video/')) return 'video'
  if (AUDIO_EXT[ext] || t.startsWith('audio/')) return 'audio'
  if (t.startsWith('image/')) return 'image'
  if (/pdf|word|officedocument|text\/plain/.test(t)) return 'document'
  return 'other'
}

/** Largest upload per kind. Videos are big; everything else keeps the old 25 MB. */
export const UPLOAD_LIMITS: Record<'video' | 'audio' | 'other', number> = {
  video: 500 * MB,
  audio: 100 * MB,
  other: 25 * MB,
}

export function uploadLimit(file: File): { bytes: number; label: string; what: string } {
  const kind = fileKind(file.name, file.type)
  const key = kind === 'video' || kind === 'audio' ? kind : 'other'
  const bytes = UPLOAD_LIMITS[key]
  return { bytes, label: `${Math.round(bytes / MB)} MB`, what: key === 'other' ? 'files' : `${key} files` }
}

/** The file's type, from the browser or, when it gives none, from the extension,
 *  so a video is stored as a video and plays from its link. */
export function contentTypeFor(file: File): string {
  if (file.type) return file.type
  const ext = extOf(file.name)
  return VIDEO_EXT[ext] || AUDIO_EXT[ext] || 'application/octet-stream'
}
