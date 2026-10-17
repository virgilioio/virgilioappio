import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import {
  AtSign,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  Database,
  Info,
  Minus,
  PanelRight,
  PenLine,
  Plus,
  SquareCheck,
  TextCursorInput,
  Trash2,
  TriangleAlert,
  Type,
  User,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { loadTemplatePdf, pageTextSize } from '@/lib/sign/pdf'
import { PdfPage, edge, tint } from '@/components/sign/PdfPage'
import {
  FIELD_LABEL,
  FIELD_SIZE,
  TEXT_FIELDS,
  autoFontSize,
  listLabels,
  offerCoverage,
  pagesOf,
  usedTags,
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

const ICON: Record<FieldType, LucideIcon> = {
  signature: PenLine,
  initials: Type,
  date: Calendar,
  name: User,
  email: AtSign,
  text: TextCursorInput,
  checkbox: SquareCheck,
  data: Database,
}
const PALETTE: SignerFieldType[] = ['signature', 'initials', 'date', 'name', 'email', 'text', 'checkbox']
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

/** The Fields step when every document is written in Gio: nothing to place by hand. */
export function WrittenOnlyFields({ d, go }: { d: TplDraft; go: (step: number) => void }) {
  const formTags = useOfferFormTags(d.kind === 'candidate' ? d.offer_form_id : null)
  const coverage = d.kind === 'candidate' && d.offer_form_id && formTags.data?.length ? offerCoverage(usedTags(d), formTags.data) : null
  return (
    <div className="max-w-[640px] rounded-xl border border-[#E7E8EE] bg-white p-5">
      <p className="font-poppins text-[15px] font-semibold text-text-primary">Nothing to place here</p>
      <p className="mt-1 font-inter text-[13px] leading-relaxed text-text-secondary">
        Written documents carry their own fields and signing blocks. Signing blocks become each person’s fields when the document is sent. To change them, edit the document on the first step.
      </p>
      {coverage && (
        <p className={cn('mt-3 font-inter text-[12.5px]', coverage.missing.length ? 'text-[#7A4A06]' : 'text-text-tertiary')}>
          <span className="tabular-nums">
            {coverage.placed.length} of {coverage.total}
          </span>{' '}
          offer fields used.{coverage.missing.length ? ` Not used: ${listLabels(coverage.missing.map((t) => t.label), 4)}.` : ''}
        </p>
      )}
      <Button variant="secondary" size="sm" className="mt-4" onClick={() => go(0)}>
        Edit the documents
      </Button>
    </div>
  )
}

export function FieldsEditor({ d, set }: { d: TplDraft; set: (fn: (d: TplDraft) => TplDraft) => void }) {
  const people = d.roles.filter((r) => r.role !== 'cc')
  const [who, setWho] = useState(people[0]?.id ?? null)
  const [sel, setSel] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number; type: FieldType; key?: string } | null>(null)
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
  const coverage = d.kind === 'candidate' && d.offer_form_id && formTags.data?.length ? offerCoverage(usedTags(d), formTags.data) : null
  // Zoom: Fit fills the column; a percentage is of the page's printed size.
  const [zoom, setZoom] = useState<Zoom>('fit')
  const [avail, setAvail] = useState(800)
  const [active, setActive] = useState(0)
  const [panel, setPanel] = useState(true)
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

  // Drag a new field from the palette onto a page, or click it to drop it on the page in view.
  const startNew = (e: RPointerEvent, type: FieldType, key?: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    const sx = e.clientX
    const sy = e.clientY
    let moved = false
    const mv = (m: PointerEvent) => {
      if (!moved && Math.hypot(m.clientX - sx, m.clientY - sy) > 4) moved = true
      if (moved) setGhost({ x: m.clientX, y: m.clientY, type, key })
    }
    const up = (u: PointerEvent) => {
      window.removeEventListener('pointermove', mv)
      window.removeEventListener('pointerup', up)
      setGhost(null)
      if (!moved) return add(type, key, visiblePage(), 50, 30)
      const pg = document
        .elementsFromPoint(u.clientX, u.clientY)
        .map((el) => el.closest<HTMLElement>('[data-gi]'))
        .find(Boolean)
      if (!pg) return
      const r = pg.getBoundingClientRect()
      add(type, key, Number(pg.dataset.gi), ((u.clientX - r.left) / r.width) * 100, ((u.clientY - r.top) / r.height) * 100)
    }
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
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

  const missing = d.roles.filter((r) => r.role === 'signer' && !d.fields.some((f) => f.rid === r.id && f.type === 'signature'))
  const fieldText = (f: TplField) =>
    f.type === 'data' ? tagText(f.data_key ?? '') + (f.data_style === 'tick' ? ' · tick' : '') : f.type === 'checkbox' ? '' : FIELD_LABEL[f.type]
  const sideH = 'font-inter text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary'
  const paletteItem =
    'flex cursor-grab select-none items-center gap-2 rounded-lg border border-[#E7E8EE] bg-white px-2.5 py-[7px] font-inter text-[12.5px] font-medium text-text-primary [touch-action:none] transition-colors duration-hover hover:bg-[#FAFAF7] active:cursor-grabbing'

  return (
    <div
      className={cn(
        'grid h-full min-h-0 border-t border-virgilio-border',
        panel || sf ? 'grid-cols-[230px_minmax(0,1fr)_232px]' : 'grid-cols-[230px_minmax(0,1fr)]',
      )}
    >
      {/* Palette */}
      <aside className="flex flex-col gap-4 overflow-y-auto border-r border-virgilio-border bg-white p-4">
        <div className="flex flex-col gap-1.5">
          <h5 className={sideH}>Placing fields for</h5>
          {people.map((r) => {
            const n = d.fields.filter((f) => f.rid === r.id).length
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={who === r.id}
                onClick={() => setWho(r.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left font-inter text-[12.5px] transition-colors duration-hover',
                  who === r.id ? 'border-[#E7E8EE] bg-[#F4F3EF]' : 'border-transparent hover:bg-[#FAFAF7]',
                )}
              >
                <span aria-hidden className="h-3 w-3 shrink-0 rounded" style={{ background: r.color }} />
                <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{r.label}</span>
                <span className="font-inter text-[11px] tabular-nums text-text-tertiary">{n}</span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-col gap-1.5">
          <h5 className={sideH}>Signer fields</h5>
          {PALETTE.map((t) => {
            const Icon = ICON[t]
            return (
              <div key={t} className={paletteItem} style={{ borderLeft: `4px solid ${whoR?.color ?? '#E7E8EE'}` }} onPointerDown={(e) => startNew(e, t)} role="button" tabIndex={0} aria-label={`Add ${FIELD_LABEL[t]} for ${whoR?.label ?? 'the selected role'}`} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), add(t, undefined, visiblePage(), 50, 30))}>
                <Icon className="h-3.5 w-3.5 text-text-secondary" strokeWidth={2} aria-hidden />
                {FIELD_LABEL[t]}
              </div>
            )
          })}
        </div>
        <div className="flex flex-col gap-1.5">
          <h5 className={sideH}>{d.offer_form_id ? 'Data fields · from the offer' : 'Data fields · from the record'}</h5>
          {tags.map(([k, l]) => (
            <div key={k} className={paletteItem} onPointerDown={(e) => startNew(e, 'data', k)} role="button" tabIndex={0} aria-label={`Add data field ${l}`} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), add('data', k, visiblePage(), 50, 30))}>
              <Database className="h-3.5 w-3.5 text-[#6F3FF5]" strokeWidth={2} aria-hidden />
              {l}
            </div>
          ))}
        </div>
        <p className="font-inter text-[11.5px] leading-snug text-text-tertiary">Drag a field onto a page, or click it to drop it on the page in view.</p>
      </aside>

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
        <span aria-hidden className="mx-1 h-5 w-px bg-virgilio-border" />
        <IconTip label={panel ? 'Hide pages' : 'Show pages'}>
          <button
            type="button"
            aria-label={panel ? 'Hide pages' : 'Show pages'}
            aria-pressed={panel}
            onClick={() => setPanel((v) => !v)}
            className={cn('gio-pressable inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#F4F3EF]', panel ? 'bg-[#F4F3EF] text-text-primary' : 'text-text-secondary')}
          >
            <PanelRight className="h-3.5 w-3.5" strokeWidth={2} />
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
          <div key={`${p.doc.id}-${p.i}`} data-gi={p.gi} className="relative" style={{ width: pageWidth(p.doc, p.i) }}>
            <PdfPage doc={p.doc} index={p.i} width={pageWidth(p.doc, p.i)}>
              {d.fields
                .filter((f) => f.page === p.gi)
                .map((f) => {
                  const r = role(f.rid)
                  const Icon = ICON[f.type]
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
            <p className="mt-1.5 flex justify-between font-inter text-[11px] text-text-tertiary">
              <span className="truncate">{p.doc.name}</span>
              <span className="tabular-nums">
                {p.i + 1} / {p.doc.page_count}
              </span>
            </p>
          </div>
        ))}
      </div>
      </div>

      {/* Documents, and the selected field */}
      {panel || sf ? (
      <aside aria-label="Pages and fields" className="flex min-h-0 flex-col overflow-y-auto border-l border-virgilio-border bg-white">
        {sf ? (
          <div className="flex flex-col gap-3 border-b border-virgilio-border p-4">
            <h5 className={sideH}>{FIELD_LABEL[sf.type]}</h5>
            {sf.type === 'data' ? (
              <label className="flex flex-col gap-1.5 font-inter text-[12.5px] font-medium text-text-primary">
                Fills from
                <Select
                  value={sf.data_key ?? undefined}
                  onValueChange={(v) =>
                    setFields((fs) => fs.map((x) => (x.id === sf.id ? { ...x, data_key: v, data_style: formTag(v)?.type === 'checkbox' ? x.data_style : null } : x)))
                  }
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
            ) : (
              <label className="flex flex-col gap-1.5 font-inter text-[12.5px] font-medium text-text-primary">
                Filled by
                <Select value={sf.rid ?? undefined} onValueChange={(v) => setFields((fs) => fs.map((x) => (x.id === sf.id ? { ...x, rid: v } : x)))}>
                  <SelectTrigger className="h-9" aria-label="Filled by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}
            {sf.type === 'data' && formTag(sf.data_key)?.type === 'checkbox' && (
              <label className="flex items-center justify-between gap-3 font-inter text-[12.5px] text-text-primary">
                Show as a tick
                <Switch
                  checked={sf.data_style === 'tick'}
                  onCheckedChange={(v) => setFields((fs) => fs.map((x) => (x.id === sf.id ? { ...x, data_style: v ? 'tick' : null } : x)))}
                  aria-label="Show as a tick"
                />
              </label>
            )}
            {sf.type === 'data' ? (
              <p className="flex gap-2 rounded-lg bg-[#F6F1FE] p-2.5 font-inter text-[12px] leading-snug text-text-secondary">
                <Info className="mt-px h-3.5 w-3.5 shrink-0 text-virgilio-purple" strokeWidth={2} aria-hidden />
                {sf.data_style === 'tick'
                  ? 'Ticked when the offer says Yes, left empty for No. Signers can’t change it.'
                  : formTag(sf.data_key) && !formTag(sf.data_key)!.required
                  ? 'Filled from the offer when it’s sent; optional on the form, so it prints blank when the offer leaves it empty.'
                  : 'Filled from the record when it’s sent. Signers can’t change it.'}
              </p>
            ) : (
              <label className="flex items-center justify-between gap-3 font-inter text-[12.5px] text-text-primary">
                Required
                <Switch checked={sf.required} onCheckedChange={(v) => setFields((fs) => fs.map((x) => (x.id === sf.id ? { ...x, required: v } : x)))} aria-label="Required" />
              </label>
            )}
            {TEXT_FIELDS.has(sf.type) && sf.data_style !== 'tick' && (() => {
              const docSize = docSizes[sf.page] ?? null
              const size = printSize(sf)
              const off = docSize != null && Math.abs(size - docSize) >= 1.5
              const setSize = (v: number | null) => setFields((fs) => fs.map((x) => (x.id === sf.id ? { ...x, font_size: v } : x)))
              return (
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center justify-between gap-3 font-inter text-[12.5px] font-medium text-text-primary">
                    Text size
                    <Select value={sf.font_size == null ? 'auto' : String(sf.font_size)} onValueChange={(v) => setSize(v === 'auto' ? null : Number(v))}>
                      <SelectTrigger className="h-8 w-[156px] text-[12.5px]" aria-label="Text size">
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
                    {docSize == null
                      ? `Prints at ${pt(size)}. The page’s own text size couldn’t be read.`
                      : off
                      ? <>Prints at {pt(size)}; the document’s text here is {pt(docSize)}. <button type="button" className="font-medium underline underline-offset-2" onClick={() => setSize(docSize)}>Match it</button></>
                      : `Prints at ${pt(size)}, like the document’s text (${pt(docSize)}).`}
                  </p>
                </div>
              )
            })()}
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" icon={Copy} onClick={() => paste(sf, sf.page)}>
                Duplicate
              </Button>
              <Button variant="ghost" size="sm" icon={Trash2} className="text-virgilio-error" onClick={() => remove(sf.id)}>
                Remove
              </Button>
            </div>
            <p className="font-inter text-[11.5px] leading-snug text-text-tertiary">
              Arrow keys nudge it (Shift for bigger steps). Drag the corner to resize. Copy and paste (⌘C, ⌘V; Ctrl on Windows) puts a same-size copy on the page in view; ⌘D duplicates it. Delete removes it.
            </p>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 border-b border-virgilio-border p-4">
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {people.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1.5 font-inter text-[11.5px] text-text-secondary">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />
                {r.label} <span className="tabular-nums text-text-tertiary">{d.fields.filter((f) => f.rid === r.id).length}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 font-inter text-[11.5px] text-text-secondary">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-dashed border-[#8456F6] bg-[#F3EDFE]" />
              Data <span className="tabular-nums text-text-tertiary">{d.fields.filter((f) => f.type === 'data').length}</span>
            </span>
          </div>
          {missing.length ? (
            <p className="flex gap-1.5 font-inter text-[11.5px] leading-snug text-[#7A4A06]">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              {missing.map((m) => m.label).join(', ')} still need{missing.length === 1 ? 's' : ''} a signature field.
            </p>
          ) : (
            <p className="flex gap-1.5 font-inter text-[11.5px] leading-snug text-[#16704A]">
              <Check className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              Every signer has a signature field.
            </p>
          )}
          {coverage &&
            (coverage.missing.length ? (
              <p className="flex gap-1.5 font-inter text-[11.5px] leading-snug text-[#7A4A06]">
                <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                <span>
                  <span className="tabular-nums">
                    {coverage.placed.length} of {coverage.total}
                  </span>{' '}
                  offer fields placed. Not placed: {listLabels(coverage.missing.map((t) => t.label), 4)}.
                </span>
              </p>
            ) : (
              <p className="flex gap-1.5 font-inter text-[11.5px] leading-snug text-[#16704A]">
                <Check className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                Every offer field is placed.
              </p>
            ))}
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
      ) : null}

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
            const Icon = ICON[ghost.type]
            return <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          })()}
          {ghost.type === 'data' ? tagLabel(d.kind, ghost.key ?? '') : FIELD_LABEL[ghost.type]}
        </div>
      )}
    </div>
  )
}
