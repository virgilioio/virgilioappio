import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { ChevronDown, Copy, Database, Info, Lock, Minus, Plus, Trash2, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { loadTemplatePdf, pageTextSize } from '@/lib/sign/pdf'
import { PdfPage, edge, tint } from '@/components/sign/PdfPage'
import { FieldList } from './FieldList'
import { FIELD_ICON } from './fieldIcons'
import { FieldSummary, FormatPicker, PanelHead } from './FieldPanel'
import { formatKind, offerCategory } from '@/lib/sign/formats'
import {
  FIELD_LABEL,
  FIELD_SIZE,
  TEXT_FIELDS,
  autoFontSize,
  pagesOf,
  tagLabel,
  tagsFor,
  useOfferFormTags,
  uid,
  type FieldType,
  type SignerFieldType,
  type TplDoc,
  type TplDraft,
  type TplField,
} from '@/lib/sign/templates'

/** How the signer fills each kind of field in (the right panel's note). */
const SIGNER_NOTE: Record<SignerFieldType, string> = {
  signature: 'They draw, type or upload their signature here when they sign.',
  initials: 'They add their initials here; Gio offers the ones from their signature.',
  date: 'Filled in for them with the day they sign.',
  name: 'Filled in with their name; they can correct it before signing.',
  email: 'Filled in with the email the agreement was sent to.',
  text: 'They type a short answer here.',
  checkbox: 'They tick it if it applies.',
}
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18] as const
const clampSize = (n: number | null | undefined) => (n == null ? null : clamp(Math.round(n * 2) / 2, 6, 24))
const pt = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} pt`
/** A role colour, see-through, so the document shows under the field. */

/** One PDF page drawn to a canvas once it scrolls near view, at the screen's pixel density.
 *  It's drawn again when zooming makes it noticeably bigger, so text stays sharp. */
/** A small page in the Documents panel, with a mark for every field in its role's colour. */
function PageThumb({
  doc,
  index,
  fields,
  colorOf,
  active,
  label,
  onOpen,
}: {
  doc: TplDoc
  index: number
  fields: TplField[]
  colorOf: (f: TplField) => string
  active: boolean
  label: string
  onOpen: () => void
}) {
  const box = useRef<HTMLButtonElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const size = doc.page_sizes[index] ?? { w: 612, h: 792 }

  useEffect(() => {
    const el = box.current
    if (!el) return
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null
    let done = false
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || done) return
        done = true
        io.disconnect()
        try {
          const pdf = await loadTemplatePdf(doc)
          const page = await pdf.getPage(index + 1)
          const c = canvas.current
          if (!c) return
          const base = page.getViewport({ scale: 1 })
          const vp = page.getViewport({ scale: (el.clientWidth / base.width) * Math.min(2, window.devicePixelRatio || 1) })
          c.width = Math.floor(vp.width)
          c.height = Math.floor(vp.height)
          task = page.render({ canvasContext: c.getContext('2d')!, viewport: vp }) as unknown as typeof task
          await task!.promise
          setReady(true)
        } catch {
          /* the big page shows the error */
        }
      },
      { rootMargin: '300px 0px' },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      task?.cancel()
    }
  }, [doc, index])

  return (
    <button
      ref={box}
      type="button"
      onClick={onOpen}
      aria-label={label}
      aria-current={active || undefined}
      className={cn(
        'gio-pressable gio-sign-thumb relative mx-auto block w-[164px] overflow-hidden rounded-[4px] bg-white ring-offset-2',
        active ? 'ring-2 ring-virgilio-purple' : 'ring-1 ring-[#E7E8EE] hover:ring-[#C9C8C1]',
      )}
      style={{ aspectRatio: `${size.w} / ${size.h}` }}
    >
      <canvas ref={canvas} data-ready={ready || undefined} aria-hidden className="absolute inset-0 h-full w-full" />
      {fields.map((f) => (
        <span
          key={f.id}
          aria-hidden
          className="absolute rounded-[2px]"
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            width: `${f.w}%`,
            height: `${Math.max(f.h, 2.2)}%`,
            background: colorOf(f),
            border: f.type === 'data' ? '1px dashed #8456F6' : '1px solid rgba(13,13,9,.25)',
          }}
        />
      ))}
    </button>
  )
}

const ZOOMS = [75, 100, 125, 150, 200] as const
type Zoom = 'fit' | (typeof ZOOMS)[number]

export function FieldsEditor({ d, set }: { d: TplDraft; set: (fn: (d: TplDraft) => TplDraft) => void }) {
  const people = d.roles.filter((r) => r.role !== 'cc')
  const [who, setWho] = useState(people[0]?.id ?? null)
  const [sel, setSel] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number; type: FieldType; key?: string } | null>(null)
  // The page under a field being dragged in (a noir ring), and where the last clicked-in field went.
  const [dropOn, setDropOn] = useState<number | null>(null)
  const stack = useRef<{ page: number; y: number } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const pages = pagesOf(d.docs)
  // Standard values, plus every field of the linked offer form (2026-10-17).
  const formTags = useOfferFormTags(d.kind === 'candidate' ? d.offer_form_id : null)
  const tags = useMemo<[string, string][]>(() => {
    const std = tagsFor(d.kind)
    const seen = new Set(std.map(([k]) => k))
    const extra = (formTags.data ?? []).filter((t) => !seen.has(t.key)).map((t) => [t.key, t.label] as [string, string])
    return [...std, ...extra]
  }, [d.kind, formTags.data])
  const tagText = (k: string) => tags.find(([key]) => key === k)?.[1] ?? tagLabel(d.kind, k)
  const formTag = (k: string | null) => (formTags.data ?? []).find((t) => t.key === k) ?? null
  // Zoom: Fit fills the column; a percentage is of the page's printed size.
  const [zoom, setZoom] = useState<Zoom>('fit')
  const [avail, setAvail] = useState(800)
  const [active, setActive] = useState(0)
  const [closedDocs, setClosedDocs] = useState<Set<string>>(new Set())
  // The document's own text size on each page, so text fields print like it.
  const [docSizes, setDocSizes] = useState<Record<number, number | null>>({})
  const clip = useRef<TplField | null>(null)
  const pagesKey = pages.map((p) => `${p.doc.storage_path}:${p.i}`).join('|')
  useEffect(() => {
    let live = true
    for (const p of pages) {
      void pageTextSize(p.doc, p.i).then((size) => live && setDocSizes((m) => (m[p.gi] === size ? m : { ...m, [p.gi]: size })))
    }
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey])

  useEffect(() => {
    const c = scroller.current
    if (!c) return
    const ro = new ResizeObserver(() => setAvail(Math.max(320, c.clientWidth - 64)))
    ro.observe(c)
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setActive(visiblePage()))
    }
    c.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      ro.disconnect()
      c.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pageWidth = (doc: TplDoc, i: number) => {
    if (zoom === 'fit') return Math.min(avail, 1200)
    const w = (doc.page_sizes[i] ?? { w: 612 }).w
    return Math.round((w * 4) / 3 * (zoom / 100))
  }
  const zoomStep = (dir: 1 | -1) => {
    const current = zoom === 'fit' ? Math.round((Math.min(avail, 1200) / 816) * 100) : zoom
    const next = dir > 0 ? ZOOMS.find((z) => z > current) : [...ZOOMS].reverse().find((z) => z < current)
    if (next) setZoom(next)
  }
  const goTo = (gi: number) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-gi="${gi}"]`)
    if (!el || !scroller.current) return
    scroller.current.scrollTo({ top: el.offsetTop - 16, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  const pageSize = (gi: number) => {
    const p = pages.find((x) => x.gi === gi)
    return p?.doc.page_sizes[p.i] ?? { w: 612, h: 792 }
  }
  /** What sign-seal prints: the chosen size, or the automatic one from the height. */
  const printSize = (f: TplField) => f.font_size ?? autoFontSize(f.h, pageSize(f.page).h)
  const colorOf = (f: TplField) => (f.type === 'data' ? '#F3EDFE' : role(f.rid)?.color ?? '#E7E8EE')

  useEffect(() => {
    if (!people.some((p) => p.id === who)) setWho(people[0]?.id ?? null)
  }, [people, who])

  const role = (id: string | null) => d.roles.find((r) => r.id === id)
  const whoR = role(who)
  const setFields = (fn: (fs: TplField[]) => TplField[]) => set((x) => ({ ...x, fields: fn(x.fields) }))
  const sf = d.fields.find((f) => f.id === sel) ?? null

  const add = (type: FieldType, key: string | undefined, page: number, cx: number, cy: number) => {
    if (type !== 'data' && !who) return
    const [w, h] = FIELD_SIZE[type]
    const f: TplField = {
      id: uid(),
      type,
      rid: type === 'data' ? null : who,
      page,
      x: clamp(cx - w / 2, 1, 99 - w),
      y: clamp(cy - h / 2, 1, 99 - h),
      w,
      h,
      required: type !== 'text' && type !== 'checkbox',
      data_key: type === 'data' ? key ?? tags[0][0] : null,
      font_size: TEXT_FIELDS.has(type) ? clampSize(docSizes[page]) : null,
    }
    setFields((fs) => [...fs, f])
    setSel(f.id)
    setFresh(f.id)
  }

  /** Copy, paste and duplicate keep the field's size, role and settings. */
  const paste = (src: TplField, page: number) => {
    const same = page === src.page
    const f: TplField = {
      ...src,
      id: uid(),
      page,
      x: same ? clamp(src.x + 2, 0, 100 - src.w) : src.x,
      y: same ? clamp(src.y + 2, 0, 100 - src.h) : src.y,
    }
    setFields((fs) => [...fs, f])
    setSel(f.id)
    setFresh(f.id)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.closest('input, textarea, [contenteditable="true"], [role="listbox"], [role="menu"]') || !scroller.current?.closest('[role="dialog"]')?.contains(t))) return
      const k = e.key.toLowerCase()
      const current = d.fields.find((f) => f.id === sel)
      if (k === 'c' && current) {
        if (window.getSelection()?.toString()) return
        clip.current = current
        e.preventDefault()
      } else if (k === 'v' && clip.current) {
        e.preventDefault()
        paste(clip.current, visiblePage())
      } else if (k === 'd' && current) {
        e.preventDefault()
        paste(current, current.page)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const visiblePage = () => {
    const c = scroller.current
    if (!c) return 0
    const top = c.getBoundingClientRect().top
    let best = 0
    let bd = Infinity
    c.querySelectorAll<HTMLElement>('[data-gi]').forEach((el) => {
      const dd = Math.abs(el.getBoundingClientRect().top - top - 24)
      if (dd < bd) {
        bd = dd
        best = Number(el.dataset.gi)
      }
    })
    return best
  }

  /**
   * A click (or Enter) places one field on the page in view; clicking again
   * puts the next one a little below the last, so they don't pile up.
   */
  const placeByClick = (type: FieldType, key?: string) => {
    const page = visiblePage()
    const h = FIELD_SIZE[type][1]
    const last = stack.current
    let cy = last && last.page === page ? last.y + h + 1.5 : 30
    if (cy > 92) cy = 30
    stack.current = { page, y: cy }
    add(type, key, page, 50, cy)
  }

  const pageAt = (x: number, y: number) =>
    document
      .elementsFromPoint(x, y)
      .map((el) => el.closest<HTMLElement>('[data-gi]'))
      .find(Boolean) ?? null

  // Drag a new field from the field list onto a page (it starts after 4px; Esc cancels), or click it.
  const startNew = (e: RPointerEvent, type: FieldType, key?: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    const sx = e.clientX
    const sy = e.clientY
    let moved = false
    const end = () => {
      window.removeEventListener('pointermove', mv)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', esc, true)
      setGhost(null)
      setDropOn(null)
    }
    const mv = (m: PointerEvent) => {
      if (!moved && Math.hypot(m.clientX - sx, m.clientY - sy) > 4) moved = true
      if (!moved) return
      setGhost({ x: m.clientX, y: m.clientY, type, key })
      const pg = pageAt(m.clientX, m.clientY)
      setDropOn(pg ? Number(pg.dataset.gi) : null)
    }
    const up = (u: PointerEvent) => {
      end()
      if (!moved) return placeByClick(type, key)
      const pg = pageAt(u.clientX, u.clientY)
      if (!pg) return
      const r = pg.getBoundingClientRect()
      add(type, key, Number(pg.dataset.gi), ((u.clientX - r.left) / r.width) * 100, ((u.clientY - r.top) / r.height) * 100)
    }
    // Esc drops nothing (and doesn't close the sheet).
    const esc = (k: KeyboardEvent) => {
      if (k.key !== 'Escape' || !moved) return
      k.preventDefault()
      k.stopPropagation()
      end()
    }
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', esc, true)
  }

  // Move (or, from the corner, resize) a placed field. Follows the pointer exactly.
  const startMove = (e: RPointerEvent<HTMLDivElement>, f: TplField, resize: boolean) => {
    e.stopPropagation()
    setSel(f.id)
    if (e.button !== 0) return
    const el = e.currentTarget
    const pg = el.closest<HTMLElement>('[data-gi]')!.getBoundingClientRect()
    const sx = e.clientX
    const sy = e.clientY
    el.setPointerCapture(e.pointerId)
    setDragId(f.id)
    // Esc while dragging puts the field back where it was.
    const esc = (k: KeyboardEvent) => {
      if (k.key !== 'Escape') return
      k.preventDefault()
      k.stopPropagation()
      setFields((fs) => fs.map((x) => (x.id === f.id ? { ...x, x: f.x, y: f.y, w: f.w, h: f.h } : x)))
      up()
    }
    window.addEventListener('keydown', esc, true)
    const mv = (m: PointerEvent) => {
      // The button was let go somewhere we didn't hear about: stop, don't follow the cursor.
      if (m.buttons === 0) return up()
      const dx = ((m.clientX - sx) / pg.width) * 100
      const dy = ((m.clientY - sy) / pg.height) * 100
      setFields((fs) =>
        fs.map((x) =>
          x.id !== f.id
            ? x
            : resize
            ? { ...x, w: clamp(f.w + dx, 2, 100 - f.x), h: clamp(f.h + dy, 1.5, 100 - f.y) }
            : { ...x, x: clamp(f.x + dx, 0, 100 - f.w), y: clamp(f.y + dy, 0, 100 - f.h) },
        ),
      )
    }
    const up = () => {
      el.removeEventListener('pointermove', mv)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('lostpointercapture', up)
      window.removeEventListener('keydown', esc, true)
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      setDragId(null)
    }
    el.addEventListener('pointermove', mv)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('lostpointercapture', up)
  }

  const remove = (id: string) => {
    setFields((fs) => fs.filter((x) => x.id !== id))
    setSel(null)
  }

  const onFieldKey = (e: React.KeyboardEvent, f: TplField) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      remove(f.id)
      scroller.current?.focus()
      return
    }
    const step = e.shiftKey ? 2 : 0.5
    const dl = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, [number, number]>)[e.key]
    if (dl) {
      e.preventDefault()
      setFields((fs) => fs.map((x) => (x.id === f.id ? { ...x, x: clamp(x.x + dl[0], 0, 100 - x.w), y: clamp(x.y + dl[1], 0, 100 - x.h) } : x)))
    }
    if (e.key === 'Escape') {
      setSel(null)
      scroller.current?.focus({ preventScroll: true })
    }
  }

  const patch = (id: string, p: Partial<TplField>) => setFields((fs) => fs.map((x) => (x.id === id ? { ...x, ...p } : x)))

  /** Text size, for fields that print text: the chosen size or the automatic one, matched to the page. */
  const textSize = (sf: TplField) => {
    const docSize = docSizes[sf.page] ?? null
    const size = printSize(sf)
    const off = docSize != null && Math.abs(size - docSize) >= 1.5
    const setSize = (v: number | null) => patch(sf.id, { font_size: v })
    return (
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center justify-between gap-3 font-inter text-[12.5px] font-medium text-text-primary">
          Text size
          <Select value={sf.font_size == null ? 'auto' : String(sf.font_size)} onValueChange={(v) => setSize(v === 'auto' ? null : Number(v))}>
            <SelectTrigger className="h-8 w-[136px] text-[12.5px]" aria-label="Text size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto · {pt(autoFontSize(sf.h, pageSize(sf.page).h))}</SelectItem>
              {[...new Set([...SIZES, ...(sf.font_size != null ? [sf.font_size] : []), ...(docSize != null ? [docSize] : [])])]
                .sort((a, b) => a - b)
                .map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {pt(n)}
                    {n === docSize ? ' · document' : ''}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </label>
        <p className={cn('font-inter text-[11.5px] leading-snug', off ? 'text-[#7A4A06]' : 'text-text-tertiary')}>
          {docSize == null ? (
            `Prints at ${pt(size)}. The page’s own text size couldn’t be read.`
          ) : off ? (
            <>
              Prints at {pt(size)}; the document’s text here is {pt(docSize)}.{' '}
              <button type="button" className="font-medium underline underline-offset-2" onClick={() => setSize(docSize)}>
                Match it
              </button>
            </>
          ) : (
            `Prints at ${pt(size)}, like the document’s text (${pt(docSize)}).`
          )}
        </p>
      </div>
    )
  }

  /** §3.4: what the right panel shows for the selected field. */
  const settings = (sf: TplField) => {
    const close = () => setSel(null)
    const actions = (removeLabel: string) => (
      <div className="flex flex-wrap gap-1">
        <Button variant="ghost" size="sm" icon={Copy} onClick={() => paste(sf, sf.page)}>
          Duplicate
        </Button>
        <Button variant="ghost" size="sm" icon={Trash2} className="text-virgilio-error" onClick={() => remove(sf.id)}>
          {removeLabel}
        </Button>
      </div>
    )
    const help = (
      <p className="font-inter text-[11.5px] leading-snug text-text-tertiary">
        Arrow keys nudge it (Shift for bigger steps). Drag the corner to resize. Copy and paste (⌘C, ⌘V; Ctrl on Windows) puts a same-size copy on the page in view; ⌘D duplicates it. Delete removes it.
      </p>
    )

    if (sf.type === 'data') {
      const tag = formTag(sf.data_key)
      const fk = sf.data_style === 'tick' ? null : formatKind(sf.data_key ?? '', tag?.type)
      return (
        <>
          <PanelHead
            icon={Database}
            title={tagText(sf.data_key ?? '')}
            sub={tag ? `From the offer · ${offerCategory(tag)}` : 'Filled by Gio when the agreement is sent'}
            onClose={close}
          />
          <label className="flex flex-col gap-1.5 font-inter text-[12.5px] font-medium text-text-primary">
            Fills from
            <Select
              value={sf.data_key ?? undefined}
              onValueChange={(v) => {
                const t = formTag(v)
                // A new value keeps its format only if the format still fits it.
                const keep = formatKind(v, t?.type) === formatKind(sf.data_key ?? '', tag?.type)
                patch(sf.id, { data_key: v, data_style: t?.type === 'checkbox' ? sf.data_style : null, data_format: keep ? sf.data_format ?? null : null })
              }}
            >
              <SelectTrigger className="h-9" aria-label="Fills from">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tags.map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {tag?.type === 'checkbox' && (
            <label className="flex items-center justify-between gap-3 font-inter text-[12.5px] text-text-primary">
              Show as a tick
              <Switch checked={sf.data_style === 'tick'} onCheckedChange={(v) => patch(sf.id, { data_style: v ? 'tick' : null, data_format: null })} aria-label="Show as a tick" />
            </label>
          )}
          {fk && (
            <FormatPicker
              fieldKey={sf.data_key ?? ''}
              kind={fk}
              value={sf.data_format}
              onChange={(v) => patch(sf.id, { data_format: v })}
              config={tag?.config}
              formId={d.kind === 'candidate' ? d.offer_form_id : null}
            />
          )}
          <div className="flex items-center justify-between gap-3 font-inter text-[12.5px]">
            <span className="text-text-primary">Signer can edit</span>
            <span className="inline-flex items-center gap-1 text-text-tertiary">
              <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
              No · locked
            </span>
          </div>
          {(sf.data_style === 'tick' || (tag && !tag.required)) && (
            <p className="gio-send-note" data-tone="info">
              <Info className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span>
                {sf.data_style === 'tick'
                  ? 'Ticked when the offer says Yes, left empty for No.'
                  : 'Optional on the form, so it prints blank when the offer leaves it empty.'}
              </span>
            </p>
          )}
          {tag?.type === 'textarea' && (
            <p className="gio-send-note" data-tone="warn">
              <TriangleAlert className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span>Long text wraps only inside this box on an uploaded page; it doesn’t flow on into the page. For job descriptions and plans, Write in Gio works better.</span>
            </p>
          )}
          {sf.data_style !== 'tick' && textSize(sf)}
          {actions('Remove from document')}
          {help}
        </>
      )
    }

    const Icon = FIELD_ICON[sf.type]
    return (
      <>
        <PanelHead icon={Icon} title={FIELD_LABEL[sf.type]} onClose={close} />
        <label className="flex flex-col gap-1.5 font-inter text-[12.5px] font-medium text-text-primary">
          {sf.type === 'signature' ? 'Signs' : 'Assigned to'}
          <Select value={sf.rid ?? undefined} onValueChange={(v) => patch(sf.id, { rid: v })}>
            <SelectTrigger className="h-9" aria-label={sf.type === 'signature' ? 'Signs' : 'Assigned to'}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {people.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: r.color }} />
                    {r.label || 'Unnamed role'}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <p className="gio-send-note" data-tone="info">
          <Info className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span>{SIGNER_NOTE[sf.type as SignerFieldType]}</span>
        </p>
        {sf.type !== 'date' && sf.type !== 'signature' && (
          <label className="flex items-center justify-between gap-3 font-inter text-[12.5px] text-text-primary">
            Required
            <Switch checked={sf.required} onCheckedChange={(v) => patch(sf.id, { required: v })} aria-label="Required" />
          </label>
        )}
        {TEXT_FIELDS.has(sf.type) && textSize(sf)}
        {actions(sf.type === 'signature' ? 'Remove' : 'Remove field')}
        {help}
      </>
    )
  }

  const fieldText = (f: TplField) =>
    f.type === 'data' ? tagText(f.data_key ?? '') + (f.data_style === 'tick' ? ' · tick' : '') : f.type === 'checkbox' ? '' : FIELD_LABEL[f.type]

  return (
    <div
      className={cn(
        'grid h-full min-h-0 border-t border-virgilio-border',
        'grid-cols-[210px_minmax(0,1fr)_240px] min-[1200px]:grid-cols-[230px_minmax(0,1fr)_280px]',
      )}
    >
      <FieldList
        d={d}
        set={set}
        mode="upload"
        who={who}
        setWho={setWho}
        onTile={(type, key) => placeByClick(type, key)}
        onTilePointer={(e, type, key) => startNew(e, type, key)}
      />

      {/* Pages */}
      <div className="flex min-h-0 min-w-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-virgilio-border bg-white px-3">
        <span className="font-inter text-[12px] tabular-nums text-text-secondary">
          Page {active + 1} of {pages.length}
        </span>
        <span className="flex-1" />
        <IconTip label="Zoom out">
          <button type="button" aria-label="Zoom out" onClick={() => zoomStep(-1)} className="gio-pressable inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-[#F4F3EF]">
            <Minus className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </IconTip>
        <Select value={String(zoom)} onValueChange={(v) => setZoom(v === 'fit' ? 'fit' : (Number(v) as Zoom))}>
          <SelectTrigger className="h-7 w-[112px] text-[12px]" aria-label="Zoom">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fit">Fit width</SelectItem>
            {ZOOMS.map((z) => (
              <SelectItem key={z} value={String(z)}>
                {z}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <IconTip label="Zoom in">
          <button type="button" aria-label="Zoom in" onClick={() => zoomStep(1)} className="gio-pressable inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-[#F4F3EF]">
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </IconTip>
      </div>
      <div
        ref={scroller}
        tabIndex={-1}
        className="relative flex min-h-0 flex-1 flex-col items-center gap-[18px] overflow-auto bg-[#ECEAE2] p-8 outline-none"
        onPointerDown={() => setSel(null)}
      >
        {pages.map((p) => (
          <div key={`${p.doc.id}-${p.i}`} data-gi={p.gi} data-drop={dropOn === p.gi || undefined} className="relative" style={{ width: pageWidth(p.doc, p.i) }}>
            {/* §3.3: the file's name at the top left of its pages, the page number at the bottom right. */}
            <p className="mb-1.5 truncate font-inter text-[11px] text-text-tertiary">{p.doc.name}</p>
            <PdfPage doc={p.doc} index={p.i} width={pageWidth(p.doc, p.i)}>
              {d.fields
                .filter((f) => f.page === p.gi)
                .map((f) => {
                  const r = role(f.rid)
                  const Icon = FIELD_ICON[f.type]
                  return (
                    <div
                      key={f.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${r ? r.label + ' · ' : ''}${f.type === 'data' ? 'Data field ' + fieldText(f) : FIELD_LABEL[f.type]}. Arrow keys move it, Delete removes it.`}
                      className="gio-sign-field"
                      data-escape-local
                      data-type={f.type}
                      data-selected={sel === f.id || undefined}
                      data-dragging={dragId === f.id || undefined}
                      data-new={fresh === f.id || undefined}
                      onAnimationEnd={() => setFresh(null)}
                      onFocus={() => setSel(f.id)}
                      onKeyDown={(e) => onFieldKey(e, f)}
                      onPointerDown={(e) => startMove(e, f, false)}
                      style={{
                        left: `${f.x}%`,
                        top: `${f.y}%`,
                        width: `${f.w}%`,
                        height: `${f.h}%`,
                        background: f.type === 'data' ? 'rgba(255,255,255,.35)' : tint(r?.color ?? '#ffffff', 0.32),
                        borderColor: f.type === 'data' ? undefined : edge(r?.color ?? '#9CA3AF'),
                        // Text fields show their label at the size they'll print.
                        ...(TEXT_FIELDS.has(f.type) ? { fontSize: `${(printSize(f) / (pageSize(f.page).w || 612)) * 100}cqw` } : {}),
                      }}
                    >
                      <Icon className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                      <span className="truncate">{fieldText(f)}</span>
                      {f.required && f.type !== 'data' && <span className="ml-auto text-virgilio-error">*</span>}
                      <span className="gio-sign-resize" onPointerDown={(e) => startMove(e as RPointerEvent<HTMLDivElement>, f, true)} aria-hidden />
                    </div>
                  )
                })}
            </PdfPage>
            <p className="mt-1.5 text-right font-inter text-[11px] tabular-nums text-text-tertiary">
              {p.i + 1} / {p.doc.page_count}
            </p>
          </div>
        ))}
      </div>
      </div>

      {/* The Summary, or the selected field's settings; then the pages */}
      <aside aria-label="Field settings and pages" className="flex min-h-0 flex-col overflow-y-auto border-l border-virgilio-border bg-white">
        <div key={sf?.id ?? 'summary'} className="gio-swap-in flex flex-col gap-3.5 border-b border-virgilio-border p-4">
          {sf ? settings(sf) : <FieldSummary d={d} />}
        </div>
        {d.docs.map((doc) => {
          const open = !closedDocs.has(doc.id)
          const docPages = pages.filter((p) => p.doc.id === doc.id)
          return (
            <Collapsible
              key={doc.id}
              open={open}
              onOpenChange={(o) =>
                setClosedDocs((s) => {
                  const n = new Set(s)
                  if (o) n.delete(doc.id)
                  else n.add(doc.id)
                  return n
                })
              }
              className="border-b border-virgilio-border last:border-b-0"
            >
              <CollapsibleTrigger className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-[#FAFAF7] [&[data-state=open]>svg]:rotate-180">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-inter text-[12px] font-semibold uppercase tracking-[0.03em] text-text-primary">{doc.name}</span>
                  <span className="font-inter text-[11.5px] tabular-nums text-text-tertiary">{plural(doc.page_count, 'page')}</span>
                </span>
                <ChevronDown className="gio-disclosure-chevron mt-0.5 h-4 w-4 shrink-0 text-text-secondary" strokeWidth={2} aria-hidden />
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-3 px-4 pb-4">
                {docPages.map((p) => (
                  <div key={p.gi} className="flex flex-col gap-1">
                    <PageThumb
                      doc={doc}
                      index={p.i}
                      fields={d.fields.filter((f) => f.page === p.gi)}
                      colorOf={colorOf}
                      active={active === p.gi}
                      label={`Go to page ${p.i + 1} of ${doc.name}`}
                      onOpen={() => goTo(p.gi)}
                    />
                    <span className={cn('text-center font-inter text-[11px] tabular-nums', active === p.gi ? 'font-semibold text-text-primary' : 'text-text-tertiary')}>{p.i + 1}</span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </aside>

      {ghost && (
        <div
          className="gio-sign-ghost"
          style={{
            left: ghost.x,
            top: ghost.y,
            background: ghost.type === 'data' ? '#fff' : whoR?.color ?? '#eee',
            border: ghost.type === 'data' ? '1.5px dashed #B9A3F4' : undefined,
          }}
        >
          {(() => {
            const Icon = FIELD_ICON[ghost.type]
            return <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          })()}
          {ghost.type === 'data' ? tagLabel(d.kind, ghost.key ?? '') : FIELD_LABEL[ghost.type]}
        </div>
      )}
    </div>
  )
}
