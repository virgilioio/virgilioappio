/**
 * ApplicationFormBuilder
 *
 * Shared "Application form" section UI used by:
 *  - Wizard Step 4 (JobPostingStep) — in-memory AppField[] state
 *  - PostingSheet (New/Edit posting) — persisted via useJobPostingFields adapter
 *
 * Single source of truth for the visual design: section chrome, "+ Add question"
 * dropdown (smart fields / basic types / library), DnD-sortable rows with
 * lock + required toggle + inline label edit + delete, and the EEO survey toggle.
 */

import * as React from 'react'
import { useRef, useState } from 'react'
import {
  Sparkles, GripVertical, Lock, Trash2, Plus, Puzzle,
  User, Mail, Phone, FileText, Link2, Globe2, Briefcase, DollarSign, MessageSquare,
  Calendar as CalendarIcon, Hash, AlignLeft, ToggleLeft, List, Type, MapPin, Linkedin, Users, Building2,
  Check, X, Settings2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CURRENCIES } from '@/constants/currencies'
import { SectionCard, ToggleRow } from '@/components/jobs/wizard/_parts'
import { useApplicationFields } from '@/hooks/useApplicationFields'
import { cn } from '@/lib/utils'
import { InlineEmpty } from '@/components/ui/empty-state'

/* ---------------- shared types & constants ---------------- */

export type FieldType =
  | 'text' | 'email' | 'phone' | 'file' | 'url' | 'yesno' | 'select' | 'number' | 'longtext' | 'date'
  | 'salary' | 'location' | 'linkedin' | 'recruiter' | 'employment_type' | 'work_location'

export interface AppField {
  id: string
  label: string
  type: FieldType
  hint?: string
  required: boolean
  locked?: boolean
  isSmart?: boolean
  icon: React.ComponentType<{ className?: string }>
  fieldConfig?: Record<string, any> | null
}

interface SmartFieldDef {
  id: string
  label: string
  type: FieldType
  icon: React.ComponentType<{ className?: string }>
  hint: string
  description: string
}

export const SMART_FIELDS: SmartFieldDef[] = [
  { id: 'sf_salary',          label: 'Salary expectations', type: 'salary',          icon: DollarSign, hint: 'Currency-aware',                    description: 'Expected compensation' },
  { id: 'sf_location',        label: 'Location',            type: 'location',        icon: MapPin,     hint: 'City · state · country',            description: 'Where the candidate is based' },
  { id: 'sf_phone',           label: 'Phone',               type: 'phone',           icon: Phone,      hint: 'International format',              description: 'Contact phone number' },
  { id: 'sf_linkedin',        label: 'LinkedIn',            type: 'linkedin',        icon: Linkedin,   hint: 'Profile URL',                       description: 'LinkedIn profile' },
  { id: 'sf_employment_type', label: 'Employment type',     type: 'employment_type', icon: Briefcase,  hint: 'Full-time · part-time · contract',  description: 'Preferred employment type' },
  { id: 'sf_work_location',   label: 'Work location',       type: 'work_location',   icon: Building2,  hint: 'Remote · hybrid · on-site',         description: 'Preferred work arrangement' },
  { id: 'sf_recruiter',       label: 'Preferred recruiter', type: 'recruiter',       icon: Users,      hint: 'Team member assignment',            description: 'Routes the application to a recruiter' },
]

export const BASIC_TYPES: { type: FieldType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'text',     label: 'Short text',    icon: Type },
  { type: 'longtext', label: 'Long text',     icon: AlignLeft },
  { type: 'number',   label: 'Number',        icon: Hash },
  { type: 'email',    label: 'Email',         icon: Mail },
  { type: 'url',      label: 'URL',           icon: Link2 },
  { type: 'date',     label: 'Date',          icon: CalendarIcon },
  { type: 'select',   label: 'Single select', icon: List },
  { type: 'yesno',    label: 'Yes / No',      icon: ToggleLeft },
  { type: 'file',     label: 'File upload',   icon: FileText },
]

export const SMART_FIELD_TYPES_SET = new Set<FieldType>(SMART_FIELDS.map((s) => s.type))

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Type, longtext: AlignLeft, textarea: AlignLeft, number: Hash, email: Mail, url: Link2,
  date: CalendarIcon, select: List, yesno: ToggleLeft, checkbox: ToggleLeft, file: FileText, phone: Phone,
  linkedin: Linkedin, location: MapPin, salary: DollarSign, employment_type: Briefcase,
  work_location: Building2, recruiter: Users,
}
export const iconForType = (t: string): React.ComponentType<{ className?: string }> =>
  TYPE_ICON[t] || MessageSquare

/** Map any persisted `application_fields` array (from posting details JSON) → AppField[]. */
export function fieldsFromPostingDetails(details: any): AppField[] {
  const raw = (details?.application_fields ?? details?.fields ?? []) as any[]
  return raw.map((f, i) => ({
    id: f.id ?? `copied_${i}_${Date.now()}`,
    label: f.label ?? 'Untitled',
    type: (f.type ?? 'text') as FieldType,
    hint: f.hint,
    required: !!f.required,
    locked: !!f.locked,
    isSmart: !!f.isSmart || SMART_FIELD_TYPES_SET.has(f.type),
    icon: iconForType(f.type),
  }))
}

/* ---------------- component ---------------- */

interface ApplicationFormBuilderProps {
  fields: AppField[]
  onChange: (next: AppField[]) => void
  eeoEnabled: boolean
  onEeoChange: (v: boolean) => void
  readOnly?: boolean
  /** Optional slot for extra trailing controls (e.g., "Copy from another job") */
  extraTrailing?: React.ReactNode
  /** Helper subtitle displayed under the section header */
  description?: string
}

export function ApplicationFormBuilder({
  fields,
  onChange,
  eeoEnabled,
  onEeoChange,
  readOnly,
  extraTrailing,
  description = 'What candidates fill in to apply. Drag to reorder. Keep it short — every extra field drops completion by ~6%.',
}: ApplicationFormBuilderProps) {
  const { fields: smartFieldsLibrary } = useApplicationFields()

  /* --- drag/drop --- */
  const dragIdx = useRef<number | null>(null)
  const onDragStart = (i: number) => () => { dragIdx.current = i }
  const onDragOver = (i: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const from = dragIdx.current
    if (from == null || from === i) return
    if (fields[i]?.locked || fields[from]?.locked) return
    const next = [...fields]
    const [moved] = next.splice(from, 1)
    next.splice(i, 0, moved)
    dragIdx.current = i
    onChange(next)
  }

  /* --- ops --- */
  const addSmart = (sf: SmartFieldDef) => {
    onChange([...fields, {
      id: `${sf.id}_${Date.now()}`,
      label: sf.label,
      type: sf.type,
      required: false,
      icon: sf.icon,
      hint: sf.hint,
      isSmart: true,
      fieldConfig: sf.type === 'salary' ? { currency: 'USD', period: 'annually' } : undefined,
    }])
  }
  const addBasic = (bt: { type: FieldType; label: string; icon: React.ComponentType<{ className?: string }> }) => {
    onChange([...fields, {
      id: `q_${Date.now()}`,
      label: `New ${bt.label.toLowerCase()} question`,
      type: bt.type,
      required: false,
      icon: bt.icon,
    }])
  }
  const addFromLibrary = (lf: { id: string; field_label: string; field_type: string; is_required: boolean; help_text?: string | null }) => {
    const mappedType: FieldType = (lf.field_type as any) === 'textarea' ? 'longtext' : (lf.field_type as any)
    onChange([...fields, {
      id: `lib_${lf.id}_${Date.now()}`,
      label: lf.field_label,
      type: mappedType,
      required: lf.is_required,
      icon: iconForType(lf.field_type),
      hint: lf.help_text || undefined,
    }])
  }
  const toggleRequired = (id: string) =>
    onChange(fields.map((x) => (x.id === id ? { ...x, required: !x.required } : x)))
  const removeField = (id: string) =>
    onChange(fields.filter((x) => x.id !== id))
  const renameField = (id: string, label: string) =>
    onChange(fields.map((x) => (x.id === id ? { ...x, label } : x)))
  const updateConfig = (id: string, patch: Record<string, any>) =>
    onChange(fields.map((x) => (x.id === id ? { ...x, fieldConfig: { ...(x.fieldConfig || {}), ...patch } } : x)))

  /* --- trailing menu --- */
  const trailing = (
    <div className="flex items-center gap-2">
      {extraTrailing}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" icon={Plus} dropdown disabled={readOnly}>
            Add question
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-[320px]">
          <DropdownMenuLabel className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-virgilio-purple" />
            Smart fields
          </DropdownMenuLabel>
          {SMART_FIELDS.map((sf) => {
            const already = fields.some((f) => f.type === sf.type)
            const Icon = sf.icon
            return (
              <DropdownMenuItem
                key={sf.id}
                disabled={already}
                onSelect={() => addSmart(sf)}
              >
                <Icon className="h-3.5 w-3.5 text-text-tertiary" />
                <span className="flex-1 truncate">{sf.label}</span>
                <Badge tone="lilac" size="xs">Smart</Badge>
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Basic question types</DropdownMenuLabel>
          {BASIC_TYPES.map((bt) => {
            const Icon = bt.icon
            return (
              <DropdownMenuItem key={bt.type} onSelect={() => addBasic(bt)}>
                <Icon className="h-3.5 w-3.5 text-text-tertiary" />
                <span className="flex-1 truncate">{bt.label}</span>
              </DropdownMenuItem>
            )
          })}
          {smartFieldsLibrary.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>From your library</DropdownMenuLabel>
              {smartFieldsLibrary.map((lf) => {
                const Icon = iconForType(lf.field_type)
                return (
                  <DropdownMenuItem key={lf.id} onSelect={() => addFromLibrary(lf as any)}>
                    <Icon className="h-3.5 w-3.5 text-text-tertiary" />
                    <span className="flex-1 truncate">{lf.field_label}</span>
                    <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-tertiary">{lf.field_type}</span>
                  </DropdownMenuItem>
                )
              })}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <SectionCard title="Application form" trailing={trailing}>
      <p className="text-[12.5px] text-text-secondary -mt-1">{description}</p>

      <div className="space-y-2">
        {fields.length === 0 ? (
          <InlineEmpty text={'No questions yet — use "Add question" to start with a smart field or a basic type.'} />
        ) : (
          fields.map((f, i) => (
            <FieldRow
              key={f.id}
              field={f}
              draggable={!f.locked && !readOnly}
              onDragStart={onDragStart(i)}
              onDragOver={onDragOver(i)}
              onToggleRequired={() => toggleRequired(f.id)}
              onRemove={() => removeField(f.id)}
              onRename={(label) => renameField(f.id, label)}
              readOnly={readOnly}
            />
          ))
        )}
      </div>

      <div className="border-t border-virgilio-border pt-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#F1F0EC] inline-flex items-center justify-center">
            <Puzzle className="h-4 w-4 text-text-secondary" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-poppins font-medium text-text-primary">Demographic survey (EEO)</p>
            <p className="text-[12px] text-text-tertiary">Anonymized, optional. Appended after submit. Compliant in US, UK, EU.</p>
          </div>
          <ToggleRow label="" checked={eeoEnabled} onChange={onEeoChange} disabled={readOnly} />
        </div>
      </div>
    </SectionCard>
  )
}

/* ---------------- row ---------------- */

function FieldRow({
  field: f,
  draggable,
  onDragStart,
  onDragOver,
  onToggleRequired,
  onRemove,
  onRename,
  readOnly,
}: {
  field: AppField
  draggable: boolean
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onToggleRequired: () => void
  onRemove: () => void
  onRename: (label: string) => void
  readOnly?: boolean
}) {
  const Icon = f.icon || iconForType(f.type)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(f.label)
  React.useEffect(() => { setDraft(f.label) }, [f.label])

  const commit = () => {
    const next = draft.trim()
    if (next && next !== f.label) onRename(next)
    setEditing(false)
  }

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      className={cn(
        'flex items-center gap-3 rounded-xl border border-virgilio-border bg-white px-3 py-2.5',
        draggable && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <GripVertical className={cn('h-4 w-4 text-text-tertiary shrink-0', !draggable && 'opacity-30')} />
      <div className="h-8 w-8 shrink-0 rounded-lg bg-[#FAFAF7] inline-flex items-center justify-center">
        <Icon className="h-4 w-4 text-text-secondary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit() }
                if (e.key === 'Escape') { setDraft(f.label); setEditing(false) }
              }}
              className="flex-1 min-w-0 bg-transparent border-b border-virgilio-purple/40 px-0 py-0.5 text-[13px] font-poppins font-medium text-text-primary outline-none"
            />
          ) : (
            <button
              type="button"
              className="truncate text-left text-[13px] font-poppins font-medium text-text-primary hover:text-virgilio-purple disabled:hover:text-text-primary"
              disabled={f.locked || readOnly}
              onClick={() => setEditing(true)}
              title={f.locked ? 'Locked field' : 'Click to rename'}
            >
              {f.label}
            </button>
          )}
          {(f.isSmart || SMART_FIELD_TYPES_SET.has(f.type)) && (
            <Badge tone="lilac" size="xs" icon={Sparkles}>Syncs to profile</Badge>
          )}
          {f.locked && (
            <span className="text-[10.5px] uppercase tracking-[0.08em] font-poppins font-semibold text-virgilio-purple bg-[#EDE4FF] rounded-full px-2 py-0.5">
              Required by Gio
            </span>
          )}
        </div>
        {f.hint && <p className="text-[11.5px] text-text-tertiary">{f.hint}</p>}
      </div>
      <button
        type="button"
        onClick={onToggleRequired}
        disabled={f.locked || readOnly}
        className={cn(
          'text-[11px] font-poppins font-medium uppercase tracking-[0.06em] rounded-full px-2.5 py-1',
          f.required ? 'bg-[#FFF4C7] text-[#856404]' : 'bg-[#F1F0EC] text-text-secondary',
          (f.locked || readOnly) && 'opacity-70 cursor-not-allowed'
        )}
      >
        {f.required ? 'Required' : 'Optional'}
      </button>
      {f.locked ? (
        <Lock className="h-4 w-4 text-text-tertiary shrink-0" />
      ) : (
        <button
          type="button"
          onClick={onRemove}
          disabled={readOnly}
          aria-label={`Remove ${f.label}`}
          className="rounded-md p-1.5 text-text-tertiary hover:bg-[#F1F0EC] hover:text-destructive disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
