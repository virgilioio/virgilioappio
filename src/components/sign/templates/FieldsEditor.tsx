import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import {
  AtSign,
  Calendar,
  Check,
  Database,
  Info,
  PenLine,
  SquareCheck,
  TextCursorInput,
  Trash2,
  TriangleAlert,
  Type,
  User,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { loadTemplatePdf } from '@/lib/sign/pdf'
import {
  FIELD_LABEL,
  FIELD_SIZE,
  pagesOf,
  tagLabel,
  tagsFor,
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

/** One PDF page drawn to a canvas once it scrolls near view, at the screen's pixel density. */
function PdfPage({ doc, index, children }: { doc: TplDoc; index: number; children?: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<'idle' | 'ready' | 'error'>('idle')
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
          const scale = (el.clientWidth / base.width) * Math.min(2, window.devicePixelRatio || 1)
          const vp = page.getViewport({ scale })
          c.width = Math.floor(vp.width)
          c.height = Math.floor(vp.height)
          task = page.render({ canvasContext: c.getContext('2d')!, viewport: vp }) as unknown as typeof task
          await task!.promise
          setState('ready')
        } catch (e) {
          if ((e as { name?: string })?.name !== 'RenderingCancelledException') setState('error')
        }
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      task?.cancel()
    }
  }, [doc, index])

  return (
    <div ref={box} className="gio-sign-page w-full max-w-[600px]" style={{ aspectRatio: `${size.w} / ${size.h}` }}>
      {state === 'idle' && <Skeleton className="absolute inset-[7%] rounded-md opacity-60" />}
      {state === 'error' && (
        <p className="absolute inset-x-0 top-1/3 text-center font-inter text-[12.5px] text-virgilio-error">This page couldn’t be drawn. Close and open the template again.</p>
      )}
      <canvas ref={canvas} data-ready={state === 'ready' || undefined} aria-hidden />
      {children}
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
  const tags = tagsFor(d.kind)

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
    }
    setFields((fs) => [...fs, f])
    setSel(f.id)
    setFresh(f.id)
  }

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
      setDragId(null)
    }
    el.addEventListener('pointermove', mv)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
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
  const fieldText = (f: TplField) => (f.type === 'data' ? tagLabel(d.kind, f.data_key ?? '') : f.type === 'checkbox' ? '' : FIELD_LABEL[f.type])
  const sideH = 'font-inter text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary'
  const paletteItem =
    'flex cursor-grab select-none items-center gap-2 rounded-lg border border-[#E7E8EE] bg-white px-2.5 py-[7px] font-inter text-[12.5px] font-medium text-text-primary [touch-action:none] transition-colors duration-hover hover:bg-[#FAFAF7] active:cursor-grabbing'

  return (
    <div className="grid h-full min-h-0 grid-cols-[230px_minmax(0,1fr)_260px] border-t border-virgilio-border">
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
          <h5 className={sideH}>Data fields · from the record</h5>
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
      <div
        ref={scroller}
        tabIndex={-1}
        className="flex flex-col items-center gap-[18px] overflow-y-auto bg-[#ECEAE2] p-6 outline-none"
        onPointerDown={() => setSel(null)}
      >
        {pages.map((p) => (
          <div key={`${p.doc.id}-${p.i}`} data-gi={p.gi} className="relative w-full max-w-[600px]">
            <PdfPage doc={p.doc} index={p.i}>
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
                      style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%`, background: r?.color ?? '#fff' }}
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

      {/* Inspector */}
      <aside className="flex flex-col gap-3 overflow-y-auto border-l border-virgilio-border bg-white p-4">
        {sf ? (
          <>
            <h5 className={sideH}>{FIELD_LABEL[sf.type]}</h5>
            {sf.type === 'data' ? (
              <label className="flex flex-col gap-1.5 font-inter text-[12.5px] font-medium text-text-primary">
                Fills from
                <Select value={sf.data_key ?? undefined} onValueChange={(v) => setFields((fs) => fs.map((x) => (x.id === sf.id ? { ...x, data_key: v } : x)))}>
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
            {sf.type === 'data' ? (
              <p className="flex gap-2 rounded-lg bg-[#F6F1FE] p-2.5 font-inter text-[12px] leading-snug text-text-secondary">
                <Info className="mt-px h-3.5 w-3.5 shrink-0 text-virgilio-purple" strokeWidth={2} aria-hidden />
                Filled from the record when it’s sent. Signers can’t change it.
              </p>
            ) : (
              <label className="flex items-center justify-between gap-3 font-inter text-[12.5px] text-text-primary">
                Required
                <Switch checked={sf.required} onCheckedChange={(v) => setFields((fs) => fs.map((x) => (x.id === sf.id ? { ...x, required: v } : x)))} aria-label="Required" />
              </label>
            )}
            <Button variant="ghost" size="sm" icon={Trash2} className="self-start text-virgilio-error" onClick={() => remove(sf.id)}>
              Remove field
            </Button>
            <p className="font-inter text-[11.5px] leading-snug text-text-tertiary">Arrow keys nudge it (Shift for bigger steps). Drag the corner to resize. Delete removes it.</p>
          </>
        ) : (
          <>
            <h5 className={sideH}>Summary</h5>
            {people.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 font-inter text-[12.5px]">
                <span className="flex min-w-0 items-center gap-1.5 text-text-primary">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />
                  <span className="truncate">{r.label}</span>
                </span>
                <span className="tabular-nums text-text-secondary">{plural(d.fields.filter((f) => f.rid === r.id).length, 'field')}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 font-inter text-[12.5px]">
              <span className="text-text-secondary">Data fields</span>
              <span className="tabular-nums text-text-secondary">{d.fields.filter((f) => f.type === 'data').length}</span>
            </div>
            {missing.length ? (
              <p className="flex gap-2 rounded-lg bg-[#FCF1DC] p-2.5 font-inter text-[12px] leading-snug text-[#7A4A06]">
                <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                {missing.map((m) => m.label).join(', ')} still need{missing.length === 1 ? 's' : ''} a signature field.
              </p>
            ) : (
              <p className="flex gap-2 rounded-lg bg-[#E3F3EA] p-2.5 font-inter text-[12px] leading-snug text-[#16704A]">
                <Check className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                Every signer has a signature field.
              </p>
            )}
          </>
        )}
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
            const Icon = ICON[ghost.type]
            return <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          })()}
          {ghost.type === 'data' ? tagLabel(d.kind, ghost.key ?? '') : FIELD_LABEL[ghost.type]}
        </div>
      )}
    </div>
  )
}
