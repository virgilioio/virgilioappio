// File questions on public application forms: Audio, Video and File upload.
// The candidate's browser uploads straight to storage through a one-time link
// (public-application-upload), into a staging folder per posting and question;
// public-submit-application checks the file and files it with the candidate.
// Kept in step with src/lib/applicationMedia.ts.

export type MediaKind = "audio" | "video" | "file";

export const MEDIA_RULES: Record<MediaKind, { exts: string[]; mime: RegExp; maxBytes: number; label: string }> = {
  audio: {
    exts: ["mp3", "m4a", "wav", "ogg", "aac"],
    mime: /^audio\//,
    maxBytes: 100 * 1024 * 1024,
    label: "MP3, M4A, WAV, OGG or AAC, up to 100 MB",
  },
  video: {
    exts: ["mp4", "mov", "m4v", "webm"],
    mime: /^video\//,
    maxBytes: 500 * 1024 * 1024,
    label: "MP4, MOV or WebM, up to 500 MB",
  },
  file: {
    exts: ["pdf", "doc", "docx", "txt", "rtf", "odt", "jpg", "jpeg", "png"],
    mime: /^(application\/(pdf|msword|rtf|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.oasis\.opendocument\.text)|text\/(plain|rtf)|image\/(jpeg|png))$/,
    maxBytes: 25 * 1024 * 1024,
    label: "PDF, Word, text or an image, up to 25 MB",
  },
};

export const MEDIA_BUCKET = "candidate-attachments";
export const STAGE_ROOT = "public-applications/staged";
/** Staged uploads nobody submitted are cleared after this long. */
export const STAGE_TTL_MS = 24 * 60 * 60 * 1000;

export function isMediaKind(t: unknown): t is MediaKind {
  return t === "audio" || t === "video" || t === "file";
}

export function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name || "");
  return m ? m[1].toLowerCase() : "";
}

/** Why this file can't answer this question, or null when it can. */
export function mediaProblem(kind: MediaKind, name: string, type: string, size: number): string | null {
  const rule = MEDIA_RULES[kind];
  const ext = extOf(name);
  const typeOk = !type || type === "application/octet-stream" || rule.mime.test(type);
  if (!rule.exts.includes(ext) || !typeOk) return `This question takes ${rule.label}.`;
  if (!Number.isFinite(size) || size <= 0) return "That file is empty.";
  if (size > rule.maxBytes) return `That file is too big. This question takes ${rule.label}.`;
  return null;
}

/** The staging folder for one posting's question. */
export function stageDir(postingId: string, fieldId: string): string {
  return `${STAGE_ROOT}/${postingId}/${fieldId}`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A staged answer as the form sends it. */
export interface StagedMedia {
  path: string;
  name: string;
  type: string;
  size: number;
}

export function readStaged(v: unknown): StagedMedia | null {
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.path !== "string" || typeof o.name !== "string") return null;
  return {
    path: o.path,
    name: o.name.slice(0, 240),
    type: typeof o.type === "string" ? o.type.slice(0, 120) : "",
    size: typeof o.size === "number" ? o.size : Number(o.size) || 0,
  };
}
