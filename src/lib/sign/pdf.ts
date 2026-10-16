import type { PDFDocumentProxy } from 'pdfjs-dist'
import { supabase } from '@/lib/supabaseClient'
import { ensurePdfJs } from '@/utils/pdfText'

export const MAX_PDF_BYTES = 25 * 1024 * 1024
const BUCKET = 'sign-files'

export class PdfProblem extends Error {}

async function sha256(buf: ArrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function open(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const lib = await ensurePdfJs()
  // pdf.js takes ownership of the buffer it's given, so hand it a copy.
  return lib.getDocument({ data: new Uint8Array(data.slice(0)) }).promise
}

/** Page count, page sizes in points and the file's hash; rejects anything that isn't a readable PDF. */
export async function inspectPdf(file: File) {
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    throw new PdfProblem(`${file.name} isn’t a PDF. Save it as a PDF and add it again.`)
  }
  if (file.size > MAX_PDF_BYTES) throw new PdfProblem(`${file.name} is over 25 MB.`)
  if (file.size === 0) throw new PdfProblem(`${file.name} is empty.`)
  const buf = await file.arrayBuffer()
  let pdf: PDFDocumentProxy
  try {
    pdf = await open(buf)
  } catch (e) {
    const name = (e as { name?: string })?.name
    throw new PdfProblem(
      name === 'PasswordException'
        ? `${file.name} is password-protected. Remove the password and add it again.`
        : `${file.name} couldn’t be read as a PDF.`,
    )
  }
  if (pdf.numPages > 200) throw new PdfProblem(`${file.name} has ${pdf.numPages} pages; the limit is 200.`)
  const page_sizes: { w: number; h: number }[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const v = page.getViewport({ scale: 1 })
    page_sizes.push({ w: Math.round(v.width * 100) / 100, h: Math.round(v.height * 100) / 100 })
  }
  return { page_count: pdf.numPages, page_sizes, size_bytes: file.size, sha256: await sha256(buf), pdf }
}

/**
 * Upload a template PDF straight to the private bucket with real progress
 * (a signed upload URL, then a PUT). Admins only, by the storage policy.
 */
export async function uploadTemplatePdf(
  tenantId: string,
  templateId: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const path = `${tenantId}/templates/${templateId}/${crypto.randomUUID()}.pdf`
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) throw new PdfProblem(`Couldn’t upload ${file.name}. Try again.`)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', data.signedUrl)
    xhr.setRequestHeader('content-type', 'application/pdf')
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.min(99, (e.loaded / e.total) * 100))
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new PdfProblem(`Couldn’t upload ${file.name}. Try again.`)))
    xhr.onerror = () => reject(new PdfProblem(`Couldn’t upload ${file.name}. Check your connection and try again.`))
    xhr.send(file)
  })
  onProgress(100)
  return path
}

const cache = new Map<string, Promise<PDFDocumentProxy>>()

/** Keep an already-open PDF for its stored path, so the editor doesn't fetch it again. */
export function primePdf(path: string, pdf: PDFDocumentProxy) {
  cache.set(path, Promise.resolve(pdf))
}

/** Open a template document for the fields editor: from the local file if we have it, else from storage. */
export function loadTemplatePdf(doc: { storage_path: string; file?: Blob }): Promise<PDFDocumentProxy> {
  const key = doc.storage_path
  let p = cache.get(key)
  if (!p) {
    p = (async () => {
      if (doc.file) return open(await doc.file.arrayBuffer())
      const { data, error } = await supabase.storage.from(BUCKET).download(doc.storage_path)
      if (error || !data) throw new PdfProblem('This document couldn’t be loaded.')
      return open(await data.arrayBuffer())
    })()
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return p
}

const byKey = new Map<string, Promise<PDFDocumentProxy>>()

/** Open a PDF from a (short-lived) URL, once per key (the signing page's documents). */
export function loadPdfFromUrl(key: string, url: string): Promise<PDFDocumentProxy> {
  let p = byKey.get(key)
  if (!p) {
    p = (async () => {
      const res = await fetch(url)
      if (!res.ok) throw new PdfProblem('This document couldn’t be loaded.')
      return open(await res.arrayBuffer())
    })()
    p.catch(() => byKey.delete(key))
    byKey.set(key, p)
  }
  return p
}

const textSizes = new Map<string, Promise<number | null>>()

/**
 * The size of most of the text on a page, in points (to the half point), so a
 * new field can print like the document around it. Null when the page has
 * no real text (a scan).
 */
export function pageTextSize(doc: { storage_path: string; file?: Blob }, index: number): Promise<number | null> {
  const key = `${doc.storage_path}#${index}`
  let p = textSizes.get(key)
  if (!p) {
    p = (async () => {
      try {
        const pdf = await loadTemplatePdf(doc)
        const page = await pdf.getPage(index + 1)
        const content = await page.getTextContent()
        const weight = new Map<number, number>()
        for (const item of content.items as { str?: string; transform?: number[] }[]) {
          const str = (item.str ?? '').trim()
          if (str.length < 3 || !item.transform) continue
          const size = Math.round(Math.hypot(item.transform[2], item.transform[3]) * 2) / 2
          if (size < 5 || size > 30) continue
          weight.set(size, (weight.get(size) ?? 0) + str.length)
        }
        let best: number | null = null
        let most = 0
        for (const [size, n] of weight) if (n > most) [best, most] = [size, n]
        return best
      } catch {
        return null
      }
    })()
    textSizes.set(key, p)
  }
  return p
}
