import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, LayoutTemplate, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { coverage, sourceIcon, subline, useOfferFormTags, useOfferForms, type OfferFormTag, type PickTemplate } from '@/lib/sign/templates'

/**
 * The template picker in Send for signature (2026-10-17): a field that opens a
 * searchable, grouped list. From an offer, templates linked to the offer's
 * form come first, then ones that work with any offer, then ones linked to
 * other forms (pickable, so the sheet can say why they can't go). From Other
 * agreement only unlinked templates show. Esc closes the list before the sheet
 * (data-escape-local while open).
 */

type Mode = 'offer' | 'other'
type Status =
  | { kind: 'blocking'; n: number }
  | { kind: 'any'; label: string }
  | { kind: 'other_form' }
  | { kind: 'partial'; mapped: number; total: number }
  | { kind: 'all' }

function statusOf(t: PickTemplate, offerFormId: string | null, mode: Mode, formFields: OfferFormTag[] | undefined, anyLabel: string): Status {
  if (mode === 'offer') {
    const c = coverage(t, formFields)
    if (c.blocking.length) return { kind: 'blocking', n: c.blocking.length }
    if (!t.offer_form_id) return { kind: 'any', label: anyLabel }
    if (t.offer_form_id !== offerFormId) return { kind: 'other_form' }
    if (c.missing.length) return { kind: 'partial', mapped: c.mapped.length, total: c.total }
    return { kind: 'all' }
  }
  return { kind: 'any', label: anyLabel }
}

function MiniBar({ ratio, tone }: { ratio: number; tone: 'amber' | 'green' }) {
  return (
    <span className="tsel-bar" aria-hidden>
      <span className="tsel-bar-fill" data-tone={tone} style={{ transform: `scaleX(${Math.max(0, Math.min(1, ratio))})` }} />
    </span>
  )
}

export function TemplateStatus({ status }: { status: Status | null }) {
  if (!status) return null
  switch (status.kind) {
    case 'blocking':
      return (
        <Badge tone="red" size="sm">
          <span className="tabular-nums">{`Missing ${status.n} offer field${status.n === 1 ? '' : 's'}`}</span>
        </Badge>
      )
    case 'any':
      return (
        <Badge tone="neutral" size="sm">
          {status.label}
        </Badge>
      )
    case 'other_form':
      return (
        <Badge tone="neutral" size="sm">
          Other offer form
        </Badge>
      )
    case 'partial':
      return (
        <span className="tsel-status">
          <MiniBar ratio={status.total ? status.mapped / status.total : 0} tone="amber" />
          <span className="tabular-nums">
            {status.mapped} of {status.total} mapped
          </span>
        </span>
      )
    case 'all':
      return (
        <span className="tsel-status">
          <MiniBar ratio={1} tone="green" />
          All mapped
        </span>
      )
  }
}

interface Group {
  key: string
  label: string
  items: PickTemplate[]
}

export function TemplateSelect<T extends PickTemplate>({
  templates,
  offerFormId,
  mode,
  value,
  onChange,
  kind = 'candidate',
}: {
  templates: T[]
  offerFormId: string | null
  mode: Mode
  value: string | null
  onChange: (id: string) => void
  /** Who the agreement is for, for the "any" labels. */
  kind?: 'candidate' | 'member'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hi, setHi] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)

  const forms = useOfferForms()
  const formName = forms.data?.find((f) => f.id === offerFormId)?.name ?? 'this offer’s form'
  const formTags = useOfferFormTags(mode === 'offer' ? offerFormId : null)
  const anyLabel = mode === 'offer' ? 'Any offer' : kind === 'member' ? 'Any member' : 'Any candidate'

  const status = (t: PickTemplate) => statusOf(t, offerFormId, mode, formTags.data, anyLabel)

  const pool = useMemo(() => (mode === 'offer' ? templates : templates.filter((t) => !t.offer_form_id)), [templates, mode])
  const groups = useMemo<Group[]>(() => {
    const q = query.trim().toLowerCase()
    const hit = q ? pool.filter((t) => t.name.toLowerCase().includes(q)) : pool
    const out: Group[] =
      mode === 'offer'
        ? [
            { key: 'linked', label: `Linked to ${formName}`, items: hit.filter((t) => offerFormId && t.offer_form_id === offerFormId) },
            { key: 'any', label: 'Works with any offer', items: hit.filter((t) => !t.offer_form_id) },
            { key: 'other', label: 'Linked to other offer forms', items: hit.filter((t) => t.offer_form_id && t.offer_form_id !== offerFormId) },
          ]
        : [{ key: 'any', label: kind === 'member' ? 'Works with any member' : 'Works with any candidate', items: hit }]
    return out.filter((g) => g.items.length)
  }, [pool, query, mode, formName, offerFormId, kind])
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  const picked = templates.find((t) => t.id === value) ?? null
  const linkedCount = mode === 'offer' && offerFormId ? pool.filter((t) => t.offer_form_id === offerFormId).length : 0

  const openList = () => {
    setQuery('')
    setOpen(true)
  }
  const close = (focusField = true) => {
    setOpen(false)
    if (focusField) field.current?.focus({ preventScroll: true })
  }
  const pick = (t: PickTemplate) => {
    onChange(t.id)
    close()
  }

  // On open: clear the search, focus it, start the highlight on the picked template.
  useEffect(() => {
    if (!open) return
    const i = flat.findIndex((t) => t.id === value)
    setHi(i >= 0 ? i : 0)
    const timer = window.setTimeout(() => input.current?.focus({ preventScroll: true }), 30)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Click outside closes it.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Keep the highlighted row in view (below the sticky group header, above the bottom edge).
  useEffect(() => {
    if (!open) return
    const box = list.current
    const row = box?.querySelector<HTMLElement>(`[data-index="${hi}"]`)
    if (!box || !row) return
    const top = row.offsetTop
    const bottom = top + row.offsetHeight
    if (top - box.scrollTop < 34) box.scrollTop = Math.max(0, top - 34)
    else if (bottom - box.scrollTop > box.clientHeight - 4) box.scrollTop = bottom - box.clientHeight + 4
  }, [hi, open])

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHi((i) => Math.min(flat.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const t = flat[hi]
      if (t) pick(t)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const PickedIcon = picked ? sourceIcon(picked) : LayoutTemplate
  let index = -1

  return (
    <div ref={root} className="tsel" data-escape-local={open || undefined}>
      <button
        ref={field}
        type="button"
        className="tsel-t"
        aria-haspopup="listbox"
        aria-expanded={open}
        data-open={open || undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            openList()
          }
        }}
      >
        <span className="tsel-tile" aria-hidden>
          <PickedIcon className="h-[15px] w-[15px]" strokeWidth={2} />
        </span>
        {picked ? (
          <span key={picked.id} className="tsel-text tsel-swap">
            <span className="tsel-name">{picked.name}</span>
            <span className="tsel-sub">{subline(picked)}</span>
          </span>
        ) : (
          <span className="tsel-text">
            <span className="tsel-name text-text-secondary !font-medium">Choose a template</span>
            <span className="tsel-sub tabular-nums">
              {pool.length} available
              {mode === 'offer' && ` · ${linkedCount} linked to this offer’s form`}
            </span>
          </span>
        )}
        <span>{picked && <TemplateStatus status={status(picked)} />}</span>
        <ChevronsUpDown className="h-[15px] w-[15px] text-text-tertiary" strokeWidth={2} aria-hidden />
      </button>

      <div className="tsel-p" data-open={open || undefined} role="listbox" aria-label="Templates" aria-hidden={!open}>
        <div className="tsel-q">
          <Search className="h-[13px] w-[13px] shrink-0 text-text-tertiary" strokeWidth={2} aria-hidden />
          <input
            ref={input}
            value={query}
            tabIndex={open ? 0 : -1}
            placeholder="Search templates…"
            aria-label="Search templates"
            onChange={(e) => {
              setQuery(e.target.value)
              setHi(0)
            }}
            onKeyDown={onListKey}
          />
        </div>
        <div ref={list} className="tsel-l">
          {groups.map((g) => (
            <div key={g.key} role="group" aria-label={g.label}>
              <div className="tsel-g">
                {g.label} <span className="tsel-g-n">{g.items.length}</span>
              </div>
              {g.items.map((t) => {
                index += 1
                const i = index
                const st = status(t)
                const on = t.id === value
                return (
                  <div
                    key={t.id}
                    role="option"
                    aria-selected={on}
                    data-index={i}
                    data-hi={i === hi || undefined}
                    data-blocked={st.kind === 'blocking' || undefined}
                    className="tsel-o"
                    onPointerMove={() => i !== hi && setHi(i)}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => pick(t)}
                  >
                    <span className="tsel-text">
                      <span className="tsel-name">{t.name}</span>
                      <span className="tsel-sub">{subline(t)}</span>
                    </span>
                    <TemplateStatus status={st} />
                    <span className="gio-mrow-check">{on && <Check className="h-4 w-4" strokeWidth={2} aria-hidden />}</span>
                  </div>
                )
              })}
            </div>
          ))}
          {!flat.length && <p className="tsel-none">No templates match “{query.trim()}”</p>}
        </div>
      </div>
    </div>
  )
}
