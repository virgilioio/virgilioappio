import { useMemo, useState, type PointerEvent as RPointerEvent } from 'react'
import {
  Brackets,
  Check,
  Database,
  Info,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { FIELD_ICON, SIGNER_TILES, sideH } from './fieldIcons'
import { OFFER_CATEGORIES, offerCategory } from '@/lib/sign/formats'
import {
  COMMON_TAGS,
  DATA_TAGS,
  FIELD_LABEL,
  draftCoverage,
  fieldUses,
  listLabels,
  tagLabel,
  useOfferFormTags,
  useOfferForms,
  type FieldType,
  type OfferFormTag,
  type TplDraft,
} from '@/lib/sign/templates'


type Mode = 'upload' | 'written'

/**
 * The Document step's left panel (§3.1, 2026-10-17): find a field, who you're
 * placing for, the signer fields, the linked form's fields grouped by
 * category with coverage, the values every template has, and (written
 * documents) blocks. Coverage lives here only.
 */
export function FieldList({
  d,
  set,
  mode,
  who,
  setWho,
  onTile,
  onTilePointer,
  onBlock,
}: {
  /** The template as it will be saved (effectiveDraft). */
  d: TplDraft
  set: (fn: (d: TplDraft) => TplDraft) => void
  mode: Mode
  who: string | null
  setWho: (id: string) => void
  /** Click, Enter or Space on a tile. */
  onTile: (type: FieldType, key?: string) => void
  /** Pointer down on a tile, for drag-to-place (uploads). A plain click still lands here. */
  onTilePointer?: (e: RPointerEvent, type: FieldType, key?: string) => void
  onBlock?: (block: 'conditional') => void
}) {
  const [q, setQ] = useState('')
  const people = d.roles.filter((r) => r.role !== 'cc')
  const whoR = people.find((r) => r.id === who)
  const linked = d.kind === 'candidate' && !!d.offer_form_id
  const formTags = useOfferFormTags(linked ? d.offer_form_id : null)
  const forms = useOfferForms()
  const formName = forms.data?.find((f) => f.id === d.offer_form_id)?.name ?? 'offer'
  const form = useMemo(() => formTags.data ?? [], [formTags.data])
  const uses = fieldUses(d)
  const cov = linked && formTags.data ? draftCoverage(d, form) : null
  const needle = q.trim().toLowerCase()
  const match = (label: string) => !needle || label.toLowerCase().includes(needle)

  const formKeys = new Set(form.map((t) => t.key))
  const always = (d.kind === 'candidate' ? [...DATA_TAGS.candidate, ...COMMON_TAGS] : COMMON_TAGS).filter(([k]) => !formKeys.has(k))
  const record = d.kind === 'candidate' ? [] : DATA_TAGS[d.kind]
  const groups = OFFER_CATEGORIES.map((c) => ({ c, tags: form.filter((t) => offerCategory(t) === c && match(t.label)) })).filter((g) => g.tags.length)
  const setNotNeeded = (key: string, on: boolean) =>
    set((x) => ({ ...x, not_needed: on ? [...new Set([...x.not_needed, key])] : x.not_needed.filter((k) => k !== key) }))

  const tileProps = (type: FieldType, key?: string) => ({
    onPointerDown: onTilePointer ? (e: RPointerEvent) => onTilePointer(e, type, key) : undefined,
    // With drag-to-place the pointer handles clicks; keyboard clicks (detail 0) land here.
    onClick: (e: React.MouseEvent) => (!onTilePointer || e.detail === 0) && onTile(type, key),
  })

  const dataTile = (key: string, label: string, tag?: OfferFormTag) => {
    const n = uses.get(key) ?? 0
    const skipped = !!tag && !n && d.not_needed.includes(key)
    const missing = !!tag && !n && !skipped
    return (
      <div key={key} className="gio-ftile-row" data-missing={missing || undefined} data-skipped={skipped || undefined}>
        <button
          type="button"
          className="gio-ftile"
          aria-label={`Add ${label}${n ? `, in the document${n > 1 ? ` ${n} times` : ''}` : missing ? ', not in the document' : skipped ? ', marked not needed' : ''}`}
          {...tileProps('data', key)}
        >
          <Database className="h-3.5 w-3.5 shrink-0 text-[#6F3FF5]" strokeWidth={2} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {n > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] tabular-nums text-[#16704A]" aria-hidden>
              <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
              {n > 1 ? n : ''}
            </span>
          )}
          {missing && <span className="gio-ftile-dot" aria-hidden />}
        </button>
        {missing && (
          <button type="button" className="gio-ftile-skip" aria-label={`Mark ${label} not needed`} onClick={() => setNotNeeded(key, true)}>
            Not needed
          </button>
        )}
        {skipped && (
          <button type="button" className="gio-ftile-undo" aria-label={`${label} is marked not needed. Undo`} onClick={() => setNotNeeded(key, false)}>
            Not needed · <span className="font-medium text-virgilio-purple">Undo</span>
          </button>
        )}
      </div>
    )
  }

  const shownAlways = always.filter(([, l]) => match(l))
  const shownRecord = record.filter(([, l]) => match(l))
  const nothing = needle && !groups.length && !shownAlways.length && !shownRecord.length

  return (
    <aside aria-label="Fields" className="flex min-h-0 flex-col gap-3.5 overflow-y-auto border-r border-virgilio-border bg-white p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" strokeWidth={2} aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && q && (e.stopPropagation(), setQ(''))}
          placeholder="Find a field"
          aria-label="Find a field"
          data-escape-local
          className="gio-field h-8 w-full rounded-lg border border-[#E7E8EE] bg-[#FAFAF7] pl-8 pr-7 font-inter text-[12.5px] text-text-primary placeholder:text-text-tertiary [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="button"
          aria-label="Clear search"
          data-visible={q ? true : undefined}
          aria-hidden={!q || undefined}
          tabIndex={q ? 0 : -1}
          onClick={() => setQ('')}
          className="gio-search-clear absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-text-tertiary hover:text-text-primary"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {!needle && (
        <>
          <section className="flex flex-col gap-1">
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
                    'gio-pressable flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left font-inter text-[12.5px] transition-colors duration-hover',
                    who === r.id ? 'border-[#E7E8EE] bg-[#F4F3EF]' : 'border-transparent hover:bg-[#FAFAF7]',
                  )}
                >
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: r.color }} />
                  <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{r.label || 'Unnamed role'}</span>
                  <span className="text-[11px] tabular-nums text-text-tertiary">{n}</span>
                </button>
              )
            })}
          </section>

          <section className="flex flex-col gap-1.5">
            <h5 className={sideH}>Signer fields</h5>
            {SIGNER_TILES.map((t) => {
              const Icon = FIELD_ICON[t]
              const has = t === 'signature' && !!who && d.fields.some((f) => f.rid === who && f.type === 'signature')
              return (
                <div key={t} className="gio-ftile-row">
                  <button
                    type="button"
                    className="gio-ftile"
                    disabled={!who}
                    style={{ borderLeft: `4px solid ${whoR?.color ?? '#E7E8EE'}` }}
                    aria-label={`Add ${FIELD_LABEL[t]} for ${whoR?.label || 'the selected role'}${has ? ', already placed' : ''}`}
                    {...tileProps(t)}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-text-secondary" strokeWidth={2} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{FIELD_LABEL[t]}</span>
                    {has && <Check className="h-3.5 w-3.5 shrink-0 text-[#16704A]" strokeWidth={2.2} aria-hidden />}
                  </button>
                </div>
              )
            })}
          </section>
        </>
      )}

      {linked ? (
        (groups.length > 0 || !needle) && (
          <section className="flex flex-col gap-1.5">
            <h5 className={cn(sideH, 'truncate')}>Offer fields · {formName}</h5>
            {cov && !needle && <CoverageCard placed={cov.mapped.length} total={cov.total} missing={cov.missing.length} />}
            {cov && cov.blocking.length > 0 && !needle && (
              <p className="gio-send-note" data-tone="bad">
                <TriangleAlert className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                <span>
                  {listLabels(cov.blocking.map((k) => tagLabel(d.kind, k)), 3)} {cov.blocking.length === 1 ? 'isn’t' : 'aren’t'} in the {formName} form. Remove {cov.blocking.length === 1 ? 'it' : 'them'}, or link a different form.
                </span>
              </p>
            )}
            {formTags.isLoading && <p className="font-inter text-[12px] text-text-tertiary">Loading the form’s fields…</p>}
            {groups.map((g) => (
              <div key={g.c} className="flex flex-col gap-1.5">
                <p className="mt-1 font-inter text-[11px] font-medium text-text-secondary">{g.c}</p>
                {g.tags.map((t) => dataTile(t.key, t.label, t))}
              </div>
            ))}
          </section>
        )
      ) : (
        d.kind === 'candidate' &&
        !needle && (
          <p className="gio-send-note" data-tone="info">
            <Info className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            <span>No offer form linked. Link one in Template info to use offer fields.</span>
          </p>
        )
      )}

      {shownRecord.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h5 className={sideH}>From the record</h5>
          {shownRecord.map(([k, l]) => dataTile(k, l))}
        </section>
      )}

      {shownAlways.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h5 className={sideH}>Always available</h5>
          {shownAlways.map(([k, l]) => dataTile(k, l))}
        </section>
      )}

      {mode === 'written' && !needle && onBlock && (
        <section className="flex flex-col gap-1.5">
          <h5 className={sideH}>Blocks</h5>
          <div className="gio-ftile-row">
            <button type="button" className="gio-ftile" onClick={() => onBlock('conditional')}>
              <Brackets className="h-3.5 w-3.5 shrink-0 text-text-secondary" strokeWidth={2} aria-hidden />
              <span className="min-w-0 flex-1 truncate">Conditional section</span>
            </button>
          </div>
        </section>
      )}

      {nothing && <p className="font-inter text-[12px] text-text-tertiary">No field matches “{q.trim()}”.</p>}

      <div className="mt-auto flex flex-col gap-1.5 pt-1 font-inter text-[11.5px] leading-snug text-text-tertiary">
        <p>{mode === 'written' ? 'Click a field to insert it at the cursor, or type / in the document.' : 'Drag a field onto the page, or click it to drop it on the page in view.'}</p>
        {cov && cov.missing.length > 0 && (
          <p className="flex gap-1.5">
            <span className="gio-ftile-dot mt-[3px]" aria-hidden />
            <span>Not mapping to the document. Click to insert, or mark it not needed. Flags are a heads-up for recruiters, not a blocker.</span>
          </p>
        )}
      </div>
    </aside>
  )
}

/** "X of Y mapped" with a 36px ring: amber while anything is missing, green when it's all there. */
function CoverageCard({ placed, total, missing }: { placed: number; total: number; missing: number }) {
  const C = 2 * Math.PI * 15
  const p = total ? placed / total : 1
  const done = missing === 0
  return (
    <div className="gio-cov-card" data-done={done || undefined} role="status">
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden className="shrink-0 -rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke="#EFEDE6" strokeWidth="4" />
        <circle className="gio-cov-ring" cx="18" cy="18" r="15" fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} style={{ strokeDashoffset: C * (1 - p) }} />
      </svg>
      <div className="min-w-0 font-inter leading-snug">
        {done ? (
          <p className="text-[12.5px] font-medium text-text-primary">Every offer field is in the document</p>
        ) : (
          <>
            <p className="text-[12.5px] font-medium text-text-primary">
              <span key={placed} className="inline-block tabular-nums gio-swap-in">{placed}</span> of <span className="tabular-nums">{total}</span> mapped
            </p>
            <p className="text-[11.5px] text-[#7A4A06]">
              <span key={missing} className="inline-block tabular-nums gio-swap-in">{missing}</span> not mapping to the document
            </p>
          </>
        )}
      </div>
    </div>
  )
}
