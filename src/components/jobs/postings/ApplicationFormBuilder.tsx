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
  Check, X, Settings2, Star, ListChecks, ArrowUp, ArrowDown, AudioLines, Clapperboard,
} from 'lucide-react'
import { MEDIA_RULES, isMediaKind } from '@/lib/applicationMedia'
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
import { IconTip, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/* ---------------- shared types & constants ---------------- */

export type FieldType =
  | 'text' | 'email' | 'phone' | 'file' | 'url' | 'yesno' | 'select' | 'multiselect' | 'number' | 'longtext' | 'date'
  | 'salary' | 'location' | 'linkedin' | 'recruiter' | 'employment_type' | 'work_location' | 'score'
  | 'audio' | 'video'

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
  /** Choices for 'select' and 'multiselect'. `value` never changes once made,
   *  so renaming an option keeps answers already submitted attached to it. */
  options?: ChoiceOption[]
}

export interface ChoiceOption {
  value: string
  label: string
}

/** Question types whose answers are picked from a list of options. */
export const CHOICE_TYPES = new Set<FieldType>(['select', 'multiselect'])

/** A stable value for a new option: slug of its first label + a short suffix. */
export function newOptionValue(label: string): string {
  const base = label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'option'
  return `${base}_${Math.random().toString(36).slice(2, 7)}`
}

export const defaultChoiceOptions = (): ChoiceOption[] =>
  ['Option 1', 'Option 2'].map((label) => ({ label, value: newOptionValue(label) }))

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
  { type: 'multiselect', label: 'Multiple choice', icon: ListChecks },
  { type: 'yesno',    label: 'Yes / No',      icon: ToggleLeft },
  { type: 'score',    label: 'Score (stars)', icon: Star },
  { type: 'file',     label: 'File upload',   icon: FileText },
  { type: 'audio',    label: 'Audio',         icon: AudioLines },
  { type: 'video',    label: 'Video',         icon: Clapperboard },
]

/** Coloured types: the same tints as the candidate's file tiles (Audio purple, Video pink). */
export const TYPE_TINT: Record<string, { icon: string; chip: string }> = {
  audio: { icon: '[color:#6F3FF5]', chip: 'bg-[#F1ECFE]' },
  video: { icon: '[color:#BE185D]', chip: 'bg-[#FCE7F3]' },
}

/** What a candidate may upload, under an upload question's label. */
export const uploadHint = (t: string): string | null => (isMediaKind(t) ? MEDIA_RULES[t].hint : null)

export const SMART_FIELD_TYPES_SET = new Set<FieldType>(SMART_FIELDS.map((s) => s.type))

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Type, longtext: AlignLeft, textarea: AlignLeft, number: Hash, email: Mail, url: Link2,
  date: CalendarIcon, select: List, multiselect: ListChecks, checkbox_group: ListChecks, yesno: ToggleLeft, checkbox: ToggleLeft, file: FileText, phone: Phone,
  linkedin: Linkedin, location: MapPin, salary: DollarSign, employment_type: Briefcase,
  work_location: Building2, recruiter: Users, score: Star, audio: AudioLines, video: Clapperboard,
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
  /* ---------- Optional granular handlers ----------
   * When provided, used instead of full-array onChange diffing.
   * Lets persisted adapters target a single mutation per user action,
   * eliminating diff/race issues (e.g., toggling Required clobbering a typed label).
   */
  onAddSmart?: (sf: SmartFieldDef) => void
  onAddBasic?: (bt: { type: FieldType; label: string; icon: React.ComponentType<{ className?: string }> }) => void
  onAddFromLibrary?: (lf: { id: string; field_label: string; field_type: string; is_required: boolean; help_text?: string | null }) => void
  onRenameField?: (id: string, label: string) => void
  onToggleRequired?: (id: string, next: boolean) => void
  onRemoveField?: (id: string) => void
  onUpdateFieldConfig?: (id: string, patch: Record<string, any>) => void
  onUpdateOptions?: (id: string, options: ChoiceOption[]) => void
  onReorderFields?: (orderedIds: string[]) => void
}

export function ApplicationFormBuilder({
  fields,
  onChange,
  eeoEnabled,
  onEeoChange,
  readOnly,
  extraTrailing,
  description = 'What candidates fill in to apply. Drag to reorder. Keep it short — every extra field drops completion by ~6%.',
  onAddSmart,
  onAddBasic,
  onAddFromLibrary,
  onRenameField,
  onToggleRequired,
  onRemoveField,
  onUpdateFieldConfig,
  onUpdateOptions,
  onReorderFields,
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
    if (onReorderFields) {
      onReorderFields(next.filter((f) => !f.locked).map((f) => f.id))
    } else {
      onChange(next)
    }
  }

  /* --- ops --- */
  const addSmart = (sf: SmartFieldDef) => {
    if (onAddSmart) { onAddSmart(sf); return }
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
    if (onAddBasic) { onAddBasic(bt); return }
    onChange([...fields, {
      id: `q_${Date.now()}`,
      label: `New ${bt.label.toLowerCase()} question`,
      type: bt.type,
      required: false,
      icon: bt.icon,
      fieldConfig: bt.type === 'score' ? { max: 5 } : undefined,
      options: CHOICE_TYPES.has(bt.type) ? defaultChoiceOptions() : undefined,
    }])
  }
  const addFromLibrary = (lf: { id: string; field_label: string; field_type: string; is_required: boolean; help_text?: string | null }) => {
    if (onAddFromLibrary) { onAddFromLibrary(lf); return }
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
  const toggleRequired = (id: string) => {
    if (onToggleRequired) {
      const cur = fields.find((x) => x.id === id)
      onToggleRequired(id, !(cur?.required ?? false))
      return
    }
    onChange(fields.map((x) => (x.id === id ? { ...x, required: !x.required } : x)))
  }
  const removeField = (id: string) => {
    if (onRemoveField) { onRemoveField(id); return }
    onChange(fields.filter((x) => x.id !== id))
  }
  const renameField = (id: string, label: string) => {
    if (onRenameField) { onRenameField(id, label); return }
    onChange(fields.map((x) => (x.id === id ? { ...x, label } : x)))
  }
  const updateConfig = (id: string, patch: Record<string, any>) => {
    if (onUpdateFieldConfig) { onUpdateFieldConfig(id, patch); return }
    onChange(fields.map((x) => (x.id === id ? { ...x, fieldConfig: { ...(x.fieldConfig || {}), ...patch } } : x)))
  }
  const updateOptions = (id: string, options: ChoiceOption[]) => {
    if (onUpdateOptions) { onUpdateOptions(id, options); return }
    onChange(fields.map((x) => (x.id === id ? { ...x, options } : x)))
  }


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
                <Icon className={cn('h-3.5 w-3.5', TYPE_TINT[bt.type]?.icon ?? 'text-text-tertiary')} />
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
              onConfigChange={(patch) => updateConfig(f.id, patch)}
              onOptionsChange={(opts) => updateOptions(f.id, opts)}
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
  onConfigChange,
  onOptionsChange,
  readOnly,
}: {
  field: AppField
  draggable: boolean
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onToggleRequired: () => void
  onRemove: () => void
  onRename: (label: string) => void
  onConfigChange?: (patch: Record<string, any>) => void
  onOptionsChange?: (options: ChoiceOption[]) => void
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
      <div className={cn('h-8 w-8 shrink-0 rounded-lg inline-flex items-center justify-center', TYPE_TINT[f.type]?.chip ?? 'bg-[#FAFAF7]')}>
        <Icon className={cn('h-4 w-4', TYPE_TINT[f.type]?.icon ?? 'text-text-secondary')} />
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
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className="text-[10.5px] uppercase tracking-[0.08em] font-poppins font-semibold text-virgilio-purple bg-[#EDE4FF] rounded-full px-2 py-0.5"
                >
                  Built in
                </span>
              </TooltipTrigger>
              <TooltipContent>Every application includes this field. It can't be removed.</TooltipContent>
            </Tooltip>
          )}
        </div>
        {CHOICE_TYPES.has(f.type) ? (
          <p className="truncate text-[11.5px] text-text-tertiary">
            {f.type === 'multiselect' ? 'Multiple choice' : 'Single select'}
            {' · '}
            {(f.options ?? []).length
              ? (f.options ?? []).map((o) => o.label).join(', ')
              : 'No options yet'}
          </p>
        ) : (
          (f.hint || uploadHint(f.type)) && <p className="text-[11.5px] text-text-tertiary">{f.hint || uploadHint(f.type)}</p>
        )}
      </div>
      {CHOICE_TYPES.has(f.type) && onOptionsChange && (
        <OptionsButton options={f.options ?? []} onSave={onOptionsChange} readOnly={readOnly} />
      )}
      {f.type === 'score' && !readOnly && onConfigChange && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-full bg-[#F1F0EC] px-2.5 text-[11px] font-poppins font-medium uppercase tracking-[0.06em] text-text-secondary hover:bg-[#E8E6DE]"
              title="Configure the score range and end labels"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>1–{(f.fieldConfig?.max as number) === 10 ? 10 : 5}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3 p-3">
            <div className="space-y-1">
              <label className="text-[11px] font-poppins font-medium uppercase tracking-[0.06em] text-text-tertiary">Range</label>
              <Select
                value={String((f.fieldConfig?.max as number) === 10 ? 10 : 5)}
                onValueChange={(v) => onConfigChange({ max: Number(v) })}
              >
                <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">1 – 5 stars</SelectItem>
                  <SelectItem value="10">1 – 10 stars</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-poppins font-medium uppercase tracking-[0.06em] text-text-tertiary">Lowest label</label>
              <input
                defaultValue={(f.fieldConfig?.min_label as string) || ''}
                placeholder="e.g. Basic"
                onBlur={(e) => onConfigChange({ min_label: e.target.value.trim() || null })}
                className="w-full h-9 rounded-lg border border-virgilio-border px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-virgilio-purple/30"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-poppins font-medium uppercase tracking-[0.06em] text-text-tertiary">Highest label</label>
              <input
                defaultValue={(f.fieldConfig?.max_label as string) || ''}
                placeholder="e.g. Fluent"
                onBlur={(e) => onConfigChange({ max_label: e.target.value.trim() || null })}
                className="w-full h-9 rounded-lg border border-virgilio-border px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-virgilio-purple/30"
              />
            </div>
          </PopoverContent>
        </Popover>
      )}
      {f.type === 'salary' && !readOnly && onConfigChange && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-full bg-[#F1F0EC] px-2.5 text-[11px] font-poppins font-medium uppercase tracking-[0.06em] text-text-secondary hover:bg-[#E8E6DE]"
              title="Configure currency and period"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>{(f.fieldConfig?.currency as string) || 'USD'} · {(f.fieldConfig?.period as string) || 'annually'}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3 p-3">
            <div className="space-y-1">
              <label className="text-[11px] font-poppins font-medium uppercase tracking-[0.06em] text-text-tertiary">Currency</label>
              <Select
                value={(f.fieldConfig?.currency as string) || 'USD'}
                onValueChange={(v) => onConfigChange({ currency: v })}
              >
                <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-poppins font-medium uppercase tracking-[0.06em] text-text-tertiary">Period</label>
              <Select
                value={(f.fieldConfig?.period as string) || 'annually'}
                onValueChange={(v) => onConfigChange({ period: v })}
              >
                <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>
      )}
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

/* ---------------- choice options ---------------- */

const pillClass =
  'h-7 gap-1.5 rounded-full px-2.5 text-[11px] font-poppins font-medium uppercase tracking-[0.06em]'

function OptionsButton({
  options,
  onSave,
  readOnly,
}: {
  options: ChoiceOption[]
  onSave: (next: ChoiceOption[]) => void
  readOnly?: boolean
}) {
  const tooFew = options.length < 2
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={readOnly}
          className={cn(
            pillClass,
            tooFew ? 'bg-[#FFF4C7] text-[#856404] hover:bg-[#FCEBA8]' : 'bg-[#F1F0EC] text-text-secondary hover:bg-[#E8E6DE]',
          )}
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span>{options.length === 0 ? 'Add options' : `${options.length} option${options.length === 1 ? '' : 's'}`}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <OptionsEditor options={options} onSave={onSave} />
      </PopoverContent>
    </Popover>
  )
}

/** Edits a question's options. Saves on blur, Enter, add, remove and move;
 *  empty rows are dropped when saved. */
function OptionsEditor({ options, onSave }: { options: ChoiceOption[]; onSave: (next: ChoiceOption[]) => void }) {
  const [rows, setRows] = useState<ChoiceOption[]>(() => (options.length ? options : [{ value: newOptionValue(''), label: '' }]))
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const lastSaved = useRef(JSON.stringify(options))
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  React.useEffect(() => {
    if (focusIdx != null) inputs.current[focusIdx]?.focus()
  }, [focusIdx, rows.length])

  // Closing the popover (Esc, click outside) unmounts the editor without a
  // blur, so save whatever is typed on the way out.
  const saveRef = useRef<(next: ChoiceOption[]) => void>(() => {})
  React.useEffect(() => () => saveRef.current(rowsRef.current), [])

  const save = (next: ChoiceOption[]) => {
    const clean = next
      .map((o) => ({ ...o, label: o.label.trim() }))
      .filter((o) => o.label)
    const key = JSON.stringify(clean)
    if (key === lastSaved.current) return
    lastSaved.current = key
    onSave(clean)
  }
  saveRef.current = save
  const setLabel = (i: number, label: string) =>
    setRows((r) => r.map((o, j) => (j === i ? { ...o, label } : o)))
  const add = (at: number) => {
    const next = [...rows.slice(0, at), { value: newOptionValue(''), label: '' }, ...rows.slice(at)]
    setRows(next)
    setFocusIdx(at)
  }
  const remove = (i: number) => {
    const next = rows.filter((_, j) => j !== i)
    setRows(next.length ? next : [{ value: newOptionValue(''), label: '' }])
    save(next)
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    setRows(next)
    save(next)
  }
  const filled = rows.filter((o) => o.label.trim()).length

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-poppins font-medium uppercase tracking-[0.06em] text-text-tertiary">Options</p>
      <div className="max-h-64 space-y-1.5 overflow-y-auto pr-0.5">
        {rows.map((o, i) => (
          <div key={o.value} className="flex items-center gap-1">
            <input
              ref={(el) => { inputs.current[i] = el }}
              value={o.label}
              placeholder={`Option ${i + 1}`}
              aria-label={`Option ${i + 1}`}
              onChange={(e) => setLabel(i, e.target.value)}
              onBlur={() => save(rows)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); save(rows); add(i + 1) }
              }}
              className="gio-field h-8 min-w-0 flex-1 rounded-lg border border-virgilio-border px-2.5 text-[13px] outline-none"
            />
            <IconTip label="Move up">
              <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}
                className="rounded-md p-1 text-text-tertiary hover:bg-[#F1F0EC] disabled:opacity-30">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            </IconTip>
            <IconTip label="Move down">
              <button type="button" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}
                className="rounded-md p-1 text-text-tertiary hover:bg-[#F1F0EC] disabled:opacity-30">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </IconTip>
            <IconTip label="Remove option">
              <button type="button" aria-label="Remove option" onClick={() => remove(i)}
                className="rounded-md p-1 text-text-tertiary hover:bg-[#F1F0EC] hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </IconTip>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={() => add(rows.length)}>
          Add option
        </Button>
        <p className="min-h-[18px] text-[11.5px] text-text-tertiary">
          {filled < 2 ? 'Add at least 2 options.' : ''}
        </p>
      </div>
    </div>
  )
}
