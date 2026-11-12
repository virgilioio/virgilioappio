/**
 * The share kit's job image (job exposure, Phase 1, 2026-11-12): 1200 × 630, the size
 * LinkedIn, X, Facebook and WhatsApp show in full. Drawn in the browser on a canvas in
 * the ATS's own look (Opaline White, noir title with the purple period, Inter facts, a
 * noir "Apply at Virgilio" pill), so it needs no image service. Virgilio's logo heads it
 * (Allan, 2026-11-12: the image is a chance to show our brand), never the client's.
 * Downloaded as a PNG to attach to a post; the same picture is what a link preview will
 * show once previews have a host.
 */

/**
 * Virgilio's logo as the app shows it: the one uploaded in Virgilio's careers settings
 * (`careers_page_settings.logo_url` of the `virgilio` careers page, a public PNG in
 * `careers-logos`). Storage answers any site (`Access-Control-Allow-Origin: *`), so with
 * `crossOrigin` the canvas stays savable. Its address is fixed here because members of
 * other workspaces can't read Virgilio's careers settings; a new upload needs this updated.
 */
export const VIRGILIO_LOGO =
  'https://etrxjxstjfcozdjumfsj.supabase.co/storage/v1/object/public/careers-logos/5ba7b145-f251-4b18-8900-724cb06028ab/1776884137302.png'
export const CARD_CTA = 'Apply at Virgilio'

export const CARD_W = 1200
export const CARD_H = 630

export interface ShareCardData {
  title: string
  /** Place, work mode, type, pay: shown in this order on one line. */
  facts: string[]
  /** The words in the pill ("Apply at Virgilio"). */
  cta: string
  /** Virgilio's logo; "Virgilio" in type when it hasn't loaded. */
  brand?: HTMLImageElement | null
}

const PAD = 80
const NOIR = '#0D0D09'
const PURPLE = '#6F3FF5'
const BODY = '#3A3D48'
const CREAM = '#FFFCF9'

/** Words into lines no wider than `max`; a word too long for a line is cut with an ellipsis. */
export function wrapLines(
  measure: (s: string) => number,
  text: string,
  max: number,
  maxLines: number,
): { lines: string[]; cut: boolean } {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  let used = 0
  for (const word of words) {
    let w = word
    if (measure(w) > max) {
      while (w.length > 1 && measure(`${w}…`) > max) w = w.slice(0, -1)
      w = `${w}…`
    }
    const next = line ? `${line} ${w}` : w
    if (measure(next) <= max) {
      line = next
      used++
      continue
    }
    lines.push(line)
    line = ''
    if (lines.length === maxLines) break
    line = w
    used++
  }
  if (line && lines.length < maxLines) lines.push(line)
  const cut = used < words.length
  if (cut && lines.length) {
    let last = lines[lines.length - 1].replace(/…$/, '')
    while (last.length > 1 && measure(`${last}…`) > max) last = last.slice(0, -1)
    lines[lines.length - 1] = `${last.replace(/[\s.,;:]+$/, '')}…`
  }
  return { lines, cut }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** The fonts the card uses, loaded before drawing so the canvas doesn't fall back. */
export async function loadCardFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  await Promise.all([
    document.fonts.load('600 72px Poppins'),
    document.fonts.load('500 28px Inter'),
    document.fonts.load('600 26px Inter'),
  ]).catch(() => undefined)
}

export function drawShareCard(ctx: CanvasRenderingContext2D, data: ShareCardData): void {
  ctx.save()
  ctx.clearRect(0, 0, CARD_W, CARD_H)
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  // A soft lilac band on the right edge, the only accent besides the period.
  ctx.fillStyle = '#EDE4FF'
  ctx.fillRect(CARD_W - 24, 0, 24, CARD_H)

  const width = CARD_W - PAD * 2 - 24
  let y = PAD

  // Virgilio's logo inside a 360 × 64 box (whatever its shape), or its name when it hasn't loaded.
  const brandH = 64
  if (data.brand && data.brand.naturalWidth > 0) {
    const ratio = data.brand.naturalWidth / data.brand.naturalHeight
    const w = Math.min(360, ratio * brandH)
    const h = w / ratio
    ctx.drawImage(data.brand, PAD, y + (brandH - h) / 2, w, h)
  } else {
    ctx.textBaseline = 'middle'
    ctx.font = '600 40px Poppins, system-ui, sans-serif'
    ctx.fillStyle = NOIR
    ctx.fillText('Virgilio', PAD, y + brandH / 2)
  }
  y += brandH + 48

  // Title: the largest size that fits in three lines, with the purple period.
  ctx.textBaseline = 'alphabetic'
  const title = data.title.trim().replace(/[.]+$/, '')
  let size = 76
  let wrapped = { lines: [title], cut: false }
  for (; size >= 48; size -= 4) {
    ctx.font = `600 ${size}px Poppins, system-ui, sans-serif`
    wrapped = wrapLines((s) => ctx.measureText(`${s}.`).width, title, width, 3)
    if (!wrapped.cut) break
  }
  ctx.font = `600 ${size}px Poppins, system-ui, sans-serif`
  const lineH = Math.round(size * 1.1)
  wrapped.lines.forEach((line, i) => {
    const ly = y + size + i * lineH
    ctx.fillStyle = NOIR
    ctx.fillText(line, PAD, ly)
    if (i === wrapped.lines.length - 1 && !wrapped.cut) {
      ctx.fillStyle = PURPLE
      ctx.fillText('.', PAD + ctx.measureText(line).width, ly)
    }
  })
  y += size + (wrapped.lines.length - 1) * lineH + 40

  // Facts on one line.
  const facts = data.facts.filter(Boolean).join('   ·   ')
  if (facts) {
    ctx.font = '500 28px Inter, system-ui, sans-serif'
    ctx.fillStyle = BODY
    const line = wrapLines((s) => ctx.measureText(s).width, facts, width, 1).lines[0] ?? ''
    ctx.fillText(line, PAD, y + 20)
  }

  // The pill at the bottom.
  ctx.font = '600 26px Inter, system-ui, sans-serif'
  const cta = wrapLines((s) => ctx.measureText(s).width, data.cta, width - 64, 1).lines[0] ?? ''
  const pillW = ctx.measureText(cta).width + 64
  const pillH = 64
  const pillY = CARD_H - PAD - pillH + 8
  ctx.fillStyle = NOIR
  roundRect(ctx, PAD, pillY, pillW, pillH, pillH / 2)
  ctx.fill()
  ctx.fillStyle = CREAM
  ctx.textBaseline = 'middle'
  ctx.fillText(cta, PAD + 32, pillY + pillH / 2 + 1)
  ctx.restore()
}

/** An image for the card, or null when it doesn't load (or can't be drawn into a downloadable canvas). */
export function loadCardImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}
