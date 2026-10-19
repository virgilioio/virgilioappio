import { useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, ChevronDown, Columns2, GripVertical, Lock, MoreHorizontal, Pencil, Plus, RefreshCcw, Rows3, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconTip } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { BoardLift, boardDropAnimation } from '@/lib/boardMotion'
import { collapseRows, rowsById } from '@/lib/motion'
import { undoToast } from '@/lib/undoToast'
import { cn } from '@/lib/utils'
import type { OfferFormField } from '@/hooks/useOfferFormFields'
import { groupBySection, newSectionId, type OfferSection } from '@/lib/offerSections'
import { FieldEditor } from './FieldEditor'
import { OFFER_FIELD_TYPES, SMART_DEFAULT_LABEL, fieldTypeInfo, type OfferFieldType } from './fieldTypes'
import type { FieldPatch, OfferFormEditor } from './useOfferFormEditor'

/** The container of a form with no sections. */
const NONE = '__none'
const box = (key: string) => `sec:${key}`
const keyOfBox = (id: string) => (id.startsWith('sec:') ? id.slice(4) : null)

/**
 * The form as recruiters will meet it (2026-10-19): its sections in order,
 * each a card of fields. Fields drag within and between sections (§4 board
 * motion; on touch, a long press), or move through their ⋯ menu. Sections are
 * renamed in place and get one or two columns, a place in the order, or are
 * taken out (Undo brings them back with their fields) from their ⋯ menu.
 * The Req ID is always asked, at the top of the first section.
 */
export function FormSections({ editor }: { editor: OfferFormEditor }) {
  const { doc, sections } = editor
  const fields = useMemo(() => doc?.fields ?? [], [doc])
  const groups = useMemo(() => groupBySection(sections, fields), [sections, fields])
  const keys = groups.map((g) => g.section?.id ?? NONE)

  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)

  // ---- dragging ----
  const [activeId, setActiveId] = useState<string | null>(null)
  const [layout, setLayout] = useState<Record<string, string[]> | null>(null)
  const settled = useMemo(() => Object.fromEntries(groups.map((g) => [g.section?.id ?? NONE, g.fields.map((f) => f.id)])), [groups])
  const view = layout ?? settled
  const byId = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields])
  const active = activeId ? byId.get(activeId) : undefined

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const containerOf = (id: string, l: Record<string, string[]>) => keyOfBox(id) ?? Object.keys(l).find((k) => l[k].includes(id)) ?? null

  const onDragStart = (e: DragStartEvent) => {
    setOpen(null)
    setActiveId(String(e.active.id))
    setLayout(settled)
  }
  const onDragOver = ({ active: a, over }: DragOverEvent) => {
    if (!over || !layout) return
    const from = containerOf(String(a.id), layout)
    const to = containerOf(String(over.id), layout)
    if (!from || !to || from === to) return
    setLayout((l) => {
      if (!l) return l
      const source = l[from].filter((x) => x !== a.id)
      const target = [...l[to]]
      const at = target.indexOf(String(over.id))
      target.splice(at < 0 ? target.length : at, 0, String(a.id))
      return { ...l, [from]: source, [to]: target }
    })
  }
  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    let l = layout ?? settled
    if (over) {
      const c = containerOf(String(a.id), l)
      if (c && c === containerOf(String(over.id), l)) {
        const list = l[c]
        const from = list.indexOf(String(a.id))
        const to = list.indexOf(String(over.id))
        if (from >= 0 && to >= 0 && from !== to) l = { ...l, [c]: arrayMove(list, from, to) }
      }
    }
    commit(l)
    setActiveId(null)
    setLayout(null)
  }
  const onDragCancel = () => {
    setActiveId(null)
    setLayout(null)
  }

  /** Writes where every field sits, numbered in the order they appear. */
  const commit = (l: Record<string, string[]>) => {
    let n = 0
    const next = keys.flatMap((k) => (l[k] ?? []).map((id) => ({ id, section_key: k === NONE ? null : k, display_order: n++ })))
    editor.placeAll(next)
  }

  const moveField = (id: string, to: string) => {
    const l = Object.fromEntries(Object.entries(settled).map(([k, ids]) => [k, ids.filter((x) => x !== id)]))
    l[to] = [...(l[to] ?? []), id]
    commit(l)
  }

  // ---- sections ----
  const sectionTitle = (key: string) => sections.find((s) => s.id === key)?.title ?? ''

  const moveSection = (key: string, by: -1 | 1) => {
    const i = sections.findIndex((s) => s.id === key)
    const j = i + by
    if (i < 0 || j < 0 || j >= sections.length) return
    void editor.setSections(arrayMove(sections, i, j))
  }

  const addSection = () => {
    const s: OfferSection = { id: newSectionId(), title: 'New section', columns: 2 }
    void editor.setSections([...sections, s])
    setRenaming(s.id)
  }

  const removeSection = (key: string) => {
    const before = sections
    const title = sectionTitle(key)
    const inside = fields.filter((f) => (groups.find((g) => g.section?.id === key)?.fields ?? []).includes(f))
    const places = fields.map((f) => ({ id: f.id, section_key: f.section_key ?? null, display_order: f.display_order }))
    const next = sections.filter((s) => s.id !== key)
    const heir = next.length ? next[next.length - 1].title : null
    void editor.setSections(next)
    undoToast(
      `${title} removed`,
      async () => {
        await editor.setSections(before)
        editor.placeAll(places)
      },
      inside.length === 0
        ? undefined
        : heir
          ? `Its ${inside.length === 1 ? 'field moved' : `${inside.length} fields moved`} to ${heir}.`
          : `Its ${inside.length === 1 ? 'field stays' : `${inside.length} fields stay`} on the form.`,
    )
  }

  const setColumns = (key: string, columns: 1 | 2) => void editor.setSections(sections.map((s) => (s.id === key ? { ...s, columns } : s)))
  const rename = (key: string, title: string) => {
    setRenaming(null)
    const t = title.trim().slice(0, 80)
    if (t && t !== sectionTitle(key)) void editor.setSections(sections.map((s) => (s.id === key ? { ...s, title: t } : s)))
  }

  // ---- fields ----
  const removeField = async (f: OfferFormField) => {
    const ok = await confirmDestructive({
      title: `Delete the “${f.field_label}” field?`,
      description: 'It’s removed from this offer form, so new offers won’t ask for it. Offers already made keep the answers they have. This can’t be undone.',
      confirmLabel: 'Delete field',
    })
    if (!ok) return
    setOpen(null)
    const exit = collapseRows(rowsById([f.id]))
    await exit.done
    if (!(await editor.removeField(f.id))) exit.revert()
  }

  const addField = async (key: string, label: string, type: OfferFieldType) => {
    const row = await editor.addField({ label, type, section_key: key === NONE ? null : key })
    return !!row
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="flex flex-col gap-[18px]">
        {groups.map((group, index) => {
          const key = group.section?.id ?? NONE
          const ids = view[key] ?? []
          return (
            <section key={key} aria-label={group.section?.title ?? 'Fields'}>
              {group.section && (
                <SectionHeader
                  section={group.section}
                  first={index === 0}
                  last={index === groups.length - 1}
                  count={ids.length}
                  renaming={renaming === key}
                  onRename={() => setRenaming(key)}
                  onRenamed={(t) => rename(key, t)}
                  onColumns={(c) => setColumns(key, c)}
                  onMove={(by) => moveSection(key, by)}
                  onRemove={() => removeSection(key)}
                />
              )}
              <SectionCard id={box(key)} empty={ids.length === 0 && index !== 0} dragging={!!activeId}>
                {index === 0 && <ReqIdRow />}
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  {ids.map((id) => {
                    const f = byId.get(id)
                    if (!f) return null
                    return (
                      <FieldRow
                        key={id}
                        field={f}
                        open={open === id}
                        onToggle={() => setOpen((o) => (o === id ? null : id))}
                        onSave={(patch) => editor.updateField(id, patch)}
                        onRemove={() => void removeField(f)}
                        sections={sections}
                        here={key}
                        onMoveTo={(to) => moveField(id, to)}
                      />
                    )
                  })}
                </SortableContext>
                {adding === key ? (
                  <AddField onAdd={(label, type) => addField(key, label, type)} onClose={() => setAdding(null)} />
                ) : (
                  <div className={cn('px-2 py-1.5', (ids.length > 0 || index === 0) && 'border-t border-[#F1F0EC]')}>
                    <Button variant="ghost" size="sm" icon={Plus} onClick={() => setAdding(key)} className="text-text-secondary">
                      Add field
                    </Button>
                  </div>
                )}
              </SectionCard>
            </section>
          )
        })}

        <div>
          <Button variant="outline" size="sm" icon={Plus} onClick={addSection}>
            Add section
          </Button>
        </div>
      </div>

      {/* The sheet is transformed, which would offset a fixed overlay inside it; the lifted copy is only a picture, so it sits on the page. */}
      {createPortal(
        <DragOverlay dropAnimation={boardDropAnimation()}>
          {active ? (
            <BoardLift className="rounded-[10px] border border-[#E7E8EE] bg-white">
              <RowFace field={active} />
            </BoardLift>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}

function SectionHeader({
  section,
  first,
  last,
  count,
  renaming,
  onRename,
  onRenamed,
  onColumns,
  onMove,
  onRemove,
}: {
  section: OfferSection
  first: boolean
  last: boolean
  count: number
  renaming: boolean
  onRename: () => void
  onRenamed: (title: string) => void
  onColumns: (c: 1 | 2) => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="mb-2.5 flex min-h-[28px] items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {renaming ? (
          <Input
            ref={input}
            defaultValue={section.title}
            maxLength={80}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Section name"
            className="h-8 w-[min(320px,60vw)] font-poppins text-[13px] font-semibold"
            data-escape-local=""
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenamed(e.currentTarget.value)
              if (e.key === 'Escape') {
                e.stopPropagation()
                onRenamed(section.title)
              }
            }}
            onBlur={(e) => onRenamed(e.currentTarget.value)}
          />
        ) : (
          <button
            type="button"
            onClick={onRename}
            className="min-w-0 truncate rounded font-poppins text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[#1F2230] hover:text-virgilio-purple"
          >
            {section.title}
          </button>
        )}
        <span className="shrink-0 font-inter text-[11.5px] tabular-nums text-text-tertiary">
          {count} {count === 1 ? 'field' : 'fields'} · {section.columns === 2 ? 'two columns' : 'one column'}
        </span>
      </div>
      <DropdownMenu>
        <IconTip label={`${section.title} options`}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`${section.title} options`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </IconTip>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuItem onSelect={onRename}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={String(section.columns)} onValueChange={(v) => onColumns(v === '1' ? 1 : 2)}>
            <DropdownMenuRadioItem value="1">
              <Rows3 className="mr-2 h-3.5 w-3.5" /> One column
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="2">
              <Columns2 className="mr-2 h-3.5 w-3.5" /> Two columns
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onMove(-1)} disabled={first}>
            <ArrowUp className="mr-2 h-3.5 w-3.5" /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMove(1)} disabled={last}>
            <ArrowDown className="mr-2 h-3.5 w-3.5" /> Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onRemove} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove section
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** A section's card; it takes drops even when it's empty. */
function SectionCard({ id, empty, dragging, children }: { id: string; empty: boolean; dragging: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'overflow-clip rounded-[12px] border bg-white transition-colors duration-hover',
        isOver && dragging ? 'border-virgilio-purple/40' : 'border-[#E7E8EE]',
      )}
    >
      {empty && (
        <p className={cn('px-4 pb-1 pt-3.5 font-inter text-[12px] text-text-tertiary', dragging && 'text-text-secondary')}>
          No fields here yet. Drag one in, or add one.
        </p>
      )}
      {children}
    </div>
  )
}

/** The Req ID: always asked, so it can't move or go. */
function ReqIdRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center text-text-tertiary">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-inter text-[13px] font-medium text-text-primary">Req ID</p>
        <p className="truncate font-inter text-[11.5px] text-text-tertiary">The opening this offer fills. Every offer asks for it.</p>
      </div>
      <span className="shrink-0 rounded-full bg-[#F1F0EC] px-2 py-0.5 font-inter text-[11px] text-text-secondary">Always asked</span>
    </div>
  )
}

/** A field's one-line face: used by the row and by the lifted copy while dragging. */
function RowFace({ field, handle, aside }: { field: OfferFormField; handle?: ReactNode; aside?: ReactNode }) {
  const info = fieldTypeInfo(field.field_type)
  return (
    <div className="flex items-center gap-2 px-2 py-2 sm:gap-3">
      {handle ?? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-text-tertiary">
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      <info.icon className="hidden h-3.5 w-3.5 shrink-0 text-text-tertiary sm:block" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-inter text-[13px] font-medium text-text-primary">{field.field_label}</p>
        {field.help_text && <p className="truncate font-inter text-[11.5px] text-text-tertiary">{field.help_text}</p>}
      </div>
      <span className="hidden shrink-0 font-inter text-[11.5px] text-text-tertiary sm:inline">{info.label}</span>
      {field.is_required ? (
        <span className="shrink-0 rounded-full bg-[#F2EBFF] px-2 py-0.5 font-inter text-[11px] font-medium text-virgilio-purple">Required</span>
      ) : (
        <span className="hidden shrink-0 rounded-full bg-[#F1F0EC] px-2 py-0.5 font-inter text-[11px] text-text-secondary sm:inline">Optional</span>
      )}
      {aside}
    </div>
  )
}

function FieldRow({
  field,
  open,
  onToggle,
  onSave,
  onRemove,
  sections,
  here,
  onMoveTo,
}: {
  field: OfferFormField
  open: boolean
  onToggle: () => void
  onSave: (patch: FieldPatch) => Promise<boolean>
  onRemove: () => void
  sections: OfferSection[]
  here: string
  onMoveTo: (key: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const others = sections.filter((s) => s.id !== here)
  return (
    <div
      ref={setNodeRef}
      data-row-id={field.id}
      data-board-card={field.id}
      style={{ transform: CSS.Translate.toString(transform), transition, touchAction: 'pan-y', ['--board-slot-radius' as string]: '8px' }}
      className={cn('border-t border-[#F1F0EC] bg-white first:border-t-0', isDragging && 'gio-board-slot')}
    >
      <div>
        <RowFace
          field={field}
          handle={
            <IconTip label="Drag to move">
              <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label={`Move ${field.field_label}`}
                className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-text-tertiary hover:bg-[#F1F0EC] hover:text-text-secondary active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4" />
              </button>
            </IconTip>
          }
          aside={
            <div className="flex shrink-0 items-center">
              {field.triggers_approval_restart && (
                <IconTip label="Changing it restarts approval">
                  <span className="flex h-7 w-7 items-center justify-center text-[#B45309]" aria-label="Changing it restarts approval" role="img">
                    <RefreshCcw className="h-3.5 w-3.5" />
                  </span>
                </IconTip>
              )}
              <IconTip label={open ? 'Close' : 'Edit field'}>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={open ? `Close ${field.field_label}` : `Edit ${field.field_label}`} aria-expanded={open} onClick={onToggle}>
                  <ChevronDown className={cn('gio-disclosure-chevron h-4 w-4', open && 'rotate-180')} />
                </Button>
              </IconTip>
              <DropdownMenu>
                <IconTip label={`${field.field_label} options`}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`${field.field_label} options`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </IconTip>
                <DropdownMenuContent align="end" className="min-w-[190px]">
                  <DropdownMenuItem onSelect={onToggle}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Edit field
                  </DropdownMenuItem>
                  {others.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <ArrowDown className="mr-2 h-3.5 w-3.5" /> Move to
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-w-[240px]">
                        {others.map((s) => (
                          <DropdownMenuItem key={s.id} onSelect={() => onMoveTo(s.id)}>
                            <span className="truncate">{s.title}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onRemove} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete field
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />
        {open && <FieldEditor field={field} onSave={onSave} onCancel={onToggle} />}
      </div>
    </div>
  )
}

/** "+ Add field" opened: a label and a type; Enter adds it and keeps the row open for the next. */
function AddField({ onAdd, onClose }: { onAdd: (label: string, type: OfferFieldType) => Promise<boolean>; onClose: () => void }) {
  const [label, setLabel] = useState('')
  const [type, setType] = useState<OfferFieldType>('text')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const add = async () => {
    const l = label.trim() || SMART_DEFAULT_LABEL[type] || ''
    if (!l) return input.current?.focus()
    setBusy(true)
    const ok = await onAdd(l, type)
    setBusy(false)
    if (ok) {
      setLabel('')
      setType('text')
      input.current?.focus()
    }
  }
  return (
    <div
      className="flex flex-col gap-2 border-t border-[#F1F0EC] bg-[#FBFAF7] px-3 py-2.5 sm:flex-row sm:items-center"
      data-escape-local=""
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <Input
        ref={input}
        value={label}
        autoFocus
        maxLength={120}
        placeholder={SMART_DEFAULT_LABEL[type] ?? 'Field label, e.g. Signing bonus'}
        aria-label="New field label"
        className="h-9 flex-1"
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void add()
          }
        }}
      />
      <div className="flex items-center gap-2">
        <Select value={type} onValueChange={(v) => setType(v as OfferFieldType)}>
          <SelectTrigger className="h-9 w-full sm:w-[176px]" aria-label="New field type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OFFER_FIELD_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                <span className="flex items-center gap-2">
                  <t.icon className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
                  {t.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => void add()} loading={busy} disabled={!label.trim() && !SMART_DEFAULT_LABEL[type]}>
          Add
        </Button>
        <IconTip label="Stop adding">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Stop adding" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </IconTip>
      </div>
    </div>
  )
}
