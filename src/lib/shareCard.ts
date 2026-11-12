/**
 * The share kit's job image (job exposure, Phase 1, 2026-11-12): 1200 × 630, the size
 * LinkedIn, X, Facebook and WhatsApp show in full. Drawn in the browser on a canvas in
 * the ATS's own look (Opaline White, noir title with the purple period, Inter facts, a
 * noir "Apply" pill), so it needs no image service. Downloaded as a PNG to attach to a
 * post; the same picture is what a link preview will show once previews have a host.
 */

export const CARD_W = 1200
export const CARD_H = 630

export interface ShareCardData {
  title: string
  company: string
  /** Place, work mode, type, pay: shown in this order on one line. */
  facts: string[]
  /** The words in the pill ("Apply at app.gogio.io"). */
  cta: string
  logo?: HTMLImageElement | null
}

const PAD = 80
const NOIR = '#0D0D09'
const PURPLE = '#6F3FF5'
const MUTED = '#5A6072'
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

  // Company: logo (when it loads) and name.
  ctx.textBaseline = 'middle'
  let x = PAD
  if (data.logo && data.logo.naturalWidth > 0) {
    const h = 56
    const w = Math.min(160, (data.logo.naturalWidth / data.logo.naturalHeight) * h)
    ctx.drawImage(data.logo, x, y, w, h)
    x += w + 18
  }
  ctx.font = '500 28px Inter, system-ui, sans-serif'
  ctx.fillStyle = MUTED
  const company = wrapLines((s) => ctx.measureText(s).width, data.company, PAD + width - x, 1).lines[0] ?? ''
  ctx.fillText(company, x, y + 28)
  y += 56 + 48

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
