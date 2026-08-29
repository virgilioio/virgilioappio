import { useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import {
  AtSign,
  CalendarDays,
  CalendarRange,
  GripVertical,
  Hash,
  Info,
  Link as LinkIcon,
  List,
  ListChecks,
  Lock,
  Phone,
  Plus,
  Star,
  Text,
  ToggleLeft,
  Type,
  X,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TypeChip } from '@/components/references/TypeChip'
import { RefToggle } from '@/components/references/RefToggle'
import { RowShell, SectionCard, SectionHead } from '../rowKit'
import {
  FIELD_CONFIG,
  REFERENCE_FIELD_GROUPS,
  REFERENCE_FIELD_LABEL,
  REFERENCE_FIELD_TYPES,
  newRefereeField,
  type ReferenceFieldType,
  type RefereeField,
} from '@/lib/references/templateModel'

export const REFERENCE_FIELD_ICON: Record<ReferenceFieldType, LucideIcon> = {
  short_text: Type,
  long_text: Text,
  email: AtSign,
  phone: Phone,
  link: LinkIcon,
  select: List,
  multi_select: ListChecks,
  yes_no: ToggleLeft,
  date: CalendarDays,
  date_range: CalendarRange,
  number: Hash,
  rating: Star,
}

const MINI_INPUT: React.CSSProperties = {
  width: '100%',
  height: 32,
  padding: '0 10px',
  background: '#fff',
  border: '1px solid #E0DDD3',
  borderRadius: 8,
  fontSize: 12.5,
  color: '#1F2230',
  outline: 'none',
}

function MiniLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
      <span
        className="font-inter uppercase"
        style={{ fontSize: 10.5, fontWeight: 600, color: '#8B8F9E', letterSpacing: '0.06em' }}
      >
        {label}
      </span>
      {hint && (
        <span className="font-inter" style={{ fontSize: 10.5, color: '#B5B9C4' }}>
          {hint}
        </span>
      )}
    </div>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div
      className="inline-flex"
      style={{ gap: 3, padding: 3, background: '#F1F0EC', borderRadius: 8 }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="font-inter"
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              border: 'none',
              fontSize: 11.5,
              cursor: 'pointer',
              background: active ? '#fff' : 'transparent',
              fontWeight: active ? 600 : 500,
              color: active ? '#1F2230' : '#5A6072',
              boxShadow: active ? '0 1px 2px rgba(13,13,9,0.06)' : 'none',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------- type picker ------------------------------ */

function TypePicker({ onPick }: { onPick: (t: ReferenceFieldType) => void }) {
  return (
    <div
      style={{
        marginBottom: 12,
        padding: 12,
        background: '#FAFAF7',
        border: '1px solid #EDE4FF',
        borderRadius: 10,
      }}
    >
      {REFERENCE_FIELD_GROUPS.map((g, gi) => (
        <div key={g.id} style={{ marginBottom: gi < 2 ? 10 : 0 }}>
          <p
            className="font-inter uppercase"
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#8B8F9E',
              letterSpacing: '0.07em',
              marginBottom: 6,
            }}
          >
            {g.heading}
          </p>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {REFERENCE_FIELD_TYPES.filter((t) => t.group === g.id).map((t) => {
              const Icon = REFERENCE_FIELD_ICON[t.type]
              return (
                <button
                  key={t.type}
                  type="button"
                  title={t.hint}
                  onClick={() => onPick(t.type)}
                  className="inline-flex items-center font-inter"
                  style={{
                    gap: 6,
                    height: 30,
                    padding: '0 11px',
                    borderRadius: 8,
                    border: '1px solid #E0DDD3',
                    background: '#fff',
                    fontSize: 12,
                    color: '#1F2230',
                    cursor: 'pointer',
                  }}
                >
                  <Icon size={13} strokeWidth={2} color="#8B8F9E" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------ inline editor ----------------------------- */

function OptionsControl({
  options,
  onChange,
}: {
  options: string[]
  onChange: (next: string[]) => void
}) {
  const atMin = options.length <= 2
  return (
    <div>
      <MiniLabel label="Options" hint="2 minimum" />
      <div className="flex flex-col" style={{ gap: 5 }}>
        {options.map((o, i) => (
          <div key={i} className="flex items-center" style={{ gap: 6 }}>
            <GripVertical
              size={13}
              color="#D1D0CB"
              style={{ cursor: 'grab', flexShrink: 0 }}
              aria-hidden
            />
            <input
              className="font-inter"
              value={o}
              placeholder="Option label"
              onChange={(e) => onChange(options.map((x, xi) => (xi === i ? e.target.value : x)))}
              style={MINI_INPUT}
            />
            <button
              type="button"
              aria-label="Remove option"
              disabled={atMin}
              onClick={() => !atMin && onChange(options.filter((_, xi) => xi !== i))}
              className="grid place-items-center shrink-0"
              style={{
                width: 26,
                height: 26,
                border: 'none',
                background: 'transparent',
                color: atMin ? '#E0DDD3' : '#B5B9C4',
                cursor: atMin ? 'not-allowed' : 'pointer',
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...options, ''])}
        className="inline-flex items-center font-inter"
        style={{
          marginTop: 7,
          marginLeft: 20,
          gap: 6,
          height: 28,
          padding: '0 10px',
          borderRadius: 7,
          border: '1px dashed #D1D0CB',
          background: 'transparent',
          color: '#5A6072',
          fontSize: 11.5,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        <Plus size={12} />
        Add option
      </button>
    </div>
  )
}

function FieldEditor({
  draft,
  editing,
  onDraft,
  onCancel,
  onCommit,
}: {
  draft: RefereeField
  editing: boolean
  onDraft: (patch: Partial<RefereeField>) => void
  onCancel: () => void
  onCommit: () => void
}) {
  const needs = FIELD_CONFIG[draft.type] ?? []
  const Icon = REFERENCE_FIELD_ICON[draft.type]
  const typeLabel = REFERENCE_FIELD_LABEL[draft.type]
  const filledOptions = (draft.options ?? []).filter((o) => o.trim()).length
  const valid =
    draft.label.trim().length > 0 && (!needs.includes('options') || filledOptions >= 2)

  const status = valid
    ? "Appears on the candidate's page for every referee."
    : needs.includes('options') && filledOptions < 2
      ? 'Give it a label and at least two options.'
      : 'Give the field a label.'

  return (
    <div
      style={{
        margin: '8px 0',
        border: '1px solid #D7C5FB',
        background: '#FAF8FF',
        borderRadius: 12,
        padding: 14,
      }}
    >
      {/* header */}
      <div className="flex items-center" style={{ gap: 9, marginBottom: 13 }}>
        <span
          className="grid place-items-center shrink-0"
          style={{ width: 26, height: 26, borderRadius: 7, background: '#EDE4FF', color: '#6F3FF5' }}
        >
          <Icon size={13} strokeWidth={2} />
        </span>
        <p
          className="font-poppins"
          style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em', color: '#1F2230' }}
        >
          {editing ? 'Edit field' : `New ${typeLabel.toLowerCase()} field`}
        </p>
        <span className="inline-flex items-center" style={{ gap: 7, marginLeft: 'auto' }}>
          <span
            className="font-inter"
            style={{ fontSize: 11, color: draft.required ? '#1F2230' : '#B5B9C4' }}
          >
            Required
          </span>
          <RefToggle
            checked={draft.required}
            onChange={(v) => onDraft({ required: v })}
            ariaLabel="Required"
          />
        </span>
      </div>

      {/* body */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: needs.length
            ? 'minmax(0,1fr) minmax(0,1fr)'
            : 'minmax(0,1fr)',
          gap: 14,
          alignItems: 'start',
        }}
      >
        <div>
          <MiniLabel label="Label" />
          <input
            autoFocus
            className="font-inter"
            value={draft.label}
            placeholder="What the candidate sees"
            onChange={(e) => onDraft({ label: e.target.value })}
            style={MINI_INPUT}
          />
          <div style={{ height: 11 }} />
          <MiniLabel label="Help text" hint="optional" />
          <input
            className="font-inter"
            value={draft.helper ?? ''}
            placeholder="A hint beneath the field"
            onChange={(e) => onDraft({ helper: e.target.value })}
            style={MINI_INPUT}
          />
        </div>

        {needs.length > 0 && (
          <div>
            {needs.includes('options') && (
              <OptionsControl
                options={draft.options ?? ['', '']}
                onChange={(options) => onDraft({ options })}
              />
            )}
            {needs.includes('precision') && (
              <div>
                <MiniLabel label="Precision" />
                <Segmented
                  value={draft.precision ?? 'month_year'}
                  onChange={(precision) => onDraft({ precision })}
                  options={[
                    { value: 'month_year', label: 'Month and year' },
                    { value: 'full_date', label: 'Full date' },
                  ]}
                />
                <p
                  className="font-inter"
                  style={{ fontSize: 10.5, color: '#B5B9C4', marginTop: 6, lineHeight: 1.45 }}
                >
                  Month and year is kinder — few people recall the exact day they started a job.
                </p>
              </div>
            )}
            {needs.includes('scale') && (
              <div>
                <MiniLabel label="Scale" />
                <Segmented
                  value={String(draft.scale ?? 5) as '5' | '10'}
                  onChange={(v) => onDraft({ scale: v === '10' ? 10 : 5 })}
                  options={[
                    { value: '5', label: '1–5' },
                    { value: '10', label: '1–10' },
                  ]}
                />
              </div>
            )}
            {needs.includes('range') && (
              <div>
                <MiniLabel label="Allowed range" hint="optional" />
                <div className="flex items-center" style={{ gap: 8 }}>
                  <input
                    className="font-inter"
                    value={draft.min ?? ''}
                    placeholder="Min"
                    onChange={(e) => onDraft({ min: e.target.value })}
                    style={{ ...MINI_INPUT, width: 78 }}
                  />
                  <span className="font-inter" style={{ fontSize: 11.5, color: '#B5B9C4' }}>
                    to
                  </span>
                  <input
                    className="font-inter"
                    value={draft.max ?? ''}
                    placeholder="Max"
                    onChange={(e) => onDraft({ max: e.target.value })}
                    style={{ ...MINI_INPUT, width: 78 }}
                  />
                </div>
              </div>
            )}
            {needs.includes('maxlen') && (
              <div>
                <MiniLabel label="Character limit" hint="optional" />
                <input
                  className="font-inter"
                  value={draft.maxlen ?? ''}
                  placeholder="e.g. 80"
                  onChange={(e) => onDraft({ maxlen: e.target.value })}
                  style={{ ...MINI_INPUT, width: 110 }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* footer */}
      <div
        className="flex items-center"
        style={{ gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid #EDE4FF' }}
      >
        <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E' }}>
          {status}
        </p>
        <span className="inline-flex items-center" style={{ gap: 7, marginLeft: 'auto' }}>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={!valid} onClick={onCommit}>
            {editing ? 'Save field' : 'Add field'}
          </Button>
        </span>
      </div>
    </div>
  )
}

/* ------------------------------ committed row ----------------------------- */

function FieldRow({
  field,
  last,
  onOpen,
  onChange,
  onDelete,
}: {
  field: RefereeField
  last: boolean
  onOpen: () => void
  onChange: (patch: Partial<RefereeField>) => void
  onDelete: () => void
}) {
  const Icon = REFERENCE_FIELD_ICON[field.type] ?? Type
  const label = REFERENCE_FIELD_LABEL[field.type] ?? 'Short text'

  return (
    <RowShell
      id={field.id}
      last={last}
      locked={field.locked}
      onDelete={onDelete}
      deleteLabel="Delete field"
    >
      <span
        className="grid place-items-center shrink-0"
        style={{ width: 26, height: 26, borderRadius: 7, background: '#F1F0EC', color: '#8B8F9E' }}
      >
        <Icon size={13} strokeWidth={2} />
      </span>

      <div
        className="min-w-0"
        style={{ flex: 1, cursor: 'pointer' }}
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen()
          }
        }}
      >
        <div className="flex items-center" style={{ gap: 7 }}>
          <span
            className="font-inter truncate"
            style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}
          >
            {field.label || 'Untitled field'}
          </span>
          {field.locked && (
            <Badge tone="neutral" size="xs" icon={Lock}>
              Always asked
            </Badge>
          )}
        </div>
        {field.helper && (
          <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E', marginTop: 2 }}>
            {field.helper}
          </p>
        )}
        {field.options && field.options.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: 4, marginTop: 5 }}>
            {field.options.map((o, i) => (
              <span
                key={`${o}-${i}`}
                className="font-inter"
                style={{
                  fontSize: 10.5,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: '#F1F0EC',
                  color: '#5A6072',
                }}
              >
                {o}
              </span>
            ))}
          </div>
        )}
        {field.precision && (
          <p className="font-inter" style={{ fontSize: 10.5, color: '#B5B9C4', marginTop: 4 }}>
            {field.precision === 'full_date' ? 'Full date' : 'Month and year'}
          </p>
        )}
      </div>

      <TypeChip label={label} icon={Icon} />

      <span
        className="inline-flex items-center justify-end shrink-0"
        style={{ gap: 7, width: 84 }}
      >
        <span
          className="font-inter"
          style={{ fontSize: 11, color: field.required ? '#1F2230' : '#B5B9C4' }}
        >
          Required
        </span>
        <RefToggle
          checked={field.required}
          onChange={(v) => onChange({ required: v })}
          ariaLabel="Required"
        />
      </span>
    </RowShell>
  )
}

/* --------------------------------- section -------------------------------- */

type Mode =
  | { kind: 'idle' }
  | { kind: 'picker' }
  | { kind: 'draft'; draft: RefereeField }
  | { kind: 'edit'; id: string; draft: RefereeField }

function commitDraft(draft: RefereeField): RefereeField {
  const next = { ...draft, label: draft.label.trim(), helper: draft.helper?.trim() || undefined }
  if (next.options) next.options = next.options.map((o) => o.trim()).filter(Boolean)
  return next
}

export function RefereeFieldsSection({
  fields,
  onChange,
}: {
  fields: RefereeField[]
  onChange: (fields: RefereeField[]) => void
}) {
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = fields.findIndex((f) => f.id === active.id)
    const to = fields.findIndex((f) => f.id === over.id)
    if (from < 0 || to < 0) return
    if (fields[from].locked || fields[to].locked) return
    onChange(arrayMove(fields, from, to))
  }

  const patchDraft = (patch: Partial<RefereeField>) =>
    setMode((m) =>
      m.kind === 'draft' || m.kind === 'edit' ? { ...m, draft: { ...m.draft, ...patch } } : m,
    )

  const pickerOpen = mode.kind === 'picker'

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionHead
          title="Referee fields"
          subtitle={`What the candidate must provide for each referee they submit. ${fields.length} fields · ${fields.filter((f) => f.required).length} required.`}
          action={
            <Button
              variant="secondary"
              size="sm"
              icon={pickerOpen ? X : Plus}
              onClick={() => setMode(pickerOpen ? { kind: 'idle' } : { kind: 'picker' })}
            >
              {pickerOpen ? 'Close' : 'Add field'}
            </Button>
          }
        />

        {pickerOpen && (
          <TypePicker onPick={(type) => setMode({ kind: 'draft', draft: newRefereeField(type) })} />
        )}

        {mode.kind === 'draft' && (
          <FieldEditor
            draft={mode.draft}
            editing={false}
            onDraft={patchDraft}
            onCancel={() => setMode({ kind: 'idle' })}
            onCommit={() => {
              onChange([...fields, commitDraft(mode.draft)])
              setMode({ kind: 'idle' })
            }}
          />
        )}

        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div>
              {fields.map((field, i) =>
                mode.kind === 'edit' && mode.id === field.id ? (
                  <FieldEditor
                    key={field.id}
                    draft={mode.draft}
                    editing
                    onDraft={patchDraft}
                    onCancel={() => setMode({ kind: 'idle' })}
                    onCommit={() => {
                      onChange(
                        fields.map((f) => (f.id === field.id ? commitDraft(mode.draft) : f)),
                      )
                      setMode({ kind: 'idle' })
                    }}
                  />
                ) : (
                  <FieldRow
                    key={field.id}
                    field={field}
                    last={i === fields.length - 1}
                    onOpen={() => setMode({ kind: 'edit', id: field.id, draft: { ...field } })}
                    onChange={(patch) =>
                      onChange(fields.map((f) => (f.id === field.id ? { ...f, ...patch } : f)))
                    }
                    onDelete={() => onChange(fields.filter((f) => f.id !== field.id))}
                  />
                ),
              )}
            </div>
          </SortableContext>
        </DndContext>
      </SectionCard>

      <div
        className="font-inter"
        style={{
          display: 'flex',
          gap: 9,
          padding: '11px 13px',
          background: '#fff',
          border: '1px solid #E7E8EE',
          borderRadius: 10,
          fontSize: 11.5,
          color: '#5A6072',
          lineHeight: 1.55,
        }}
      >
        <Info size={14} color="#8B8F9E" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Every field here is asked once per referee. The candidate fills these in — so keep it to
          what you need to reach the referee and judge the relationship. Name and work email can't
          be removed.
        </span>
      </div>
    </div>
  )
}
