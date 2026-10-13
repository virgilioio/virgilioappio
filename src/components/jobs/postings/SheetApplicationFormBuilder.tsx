/**
 * SheetApplicationFormBuilder
 *
 * Adapter that wires the shared ApplicationFormBuilder UI to the persisted
 * job_posting_application_fields table via useJobPostingFields. Used inside
 * PostingSheet so the New/Edit posting flow uses the EXACT same design as
 * Wizard Step 4 (Job Posting).
 *
 * Persistence model: per-action granular handlers (no diff). Each user action
 * (add / rename / toggle required / config / delete / reorder) calls exactly
 * one mutation on the hook. This avoids the race where a toggle-Required
 * click could clobber a user-typed label.
 */

import { useMemo } from 'react'
import { User, Mail, Phone, FileText, Linkedin } from 'lucide-react'
import { useJobPostingFields, type PostingField, type FieldType as DbFieldType } from '@/hooks/useJobPostingFields'
import { useCoreFields } from '@/hooks/useCoreFields'
import {
  ApplicationFormBuilder,
  iconForType,
  SMART_FIELD_TYPES_SET,
  CHOICE_TYPES,
  defaultChoiceOptions,
  type AppField,
  type ChoiceOption,
  type FieldType as SharedFieldType,
} from './ApplicationFormBuilder'
import { confirmDestructive } from '@/components/ui/confirm-dialog'

const CORE_FIELD_ICONS: Record<string, any> = {
  resume: FileText,
  candidate_name: User,
  email: Mail,
  phone: Phone,
  linkedin_url: Linkedin,
}

/** Map persisted DB field_type → shared AppField.type. */
function dbTypeToShared(t: DbFieldType): SharedFieldType {
  if (t === 'textarea') return 'longtext'
  if (t === 'checkbox') return 'yesno'
  if (t === 'checkbox_group') return 'multiselect'
  return t as SharedFieldType
}

/** Map shared AppField.type → persisted DB field_type. */
function sharedTypeToDb(t: SharedFieldType): DbFieldType {
  if (t === 'longtext') return 'textarea'
  if (t === 'yesno') return 'checkbox'
  if (t === 'multiselect') return 'checkbox_group'
  return t as DbFieldType
}

function postingToAppField(pf: PostingField): AppField {
  const sharedType = dbTypeToShared(pf.field_type)
  return {
    id: pf.id,
    label: pf.field_label,
    type: sharedType,
    required: pf.is_required,
    locked: false,
    isSmart: SMART_FIELD_TYPES_SET.has(sharedType),
    icon: iconForType(pf.field_type),
    hint: pf.help_text || undefined,
    fieldConfig: (pf.field_config as Record<string, any> | null) || undefined,
    options: (pf.select_options ?? []).map((o) => ({ value: o.option_value, label: o.option_label })),
  }
}

const toDbOptions = (opts: ChoiceOption[]) =>
  opts.map((o, i) => ({ option_value: o.value, option_label: o.label, display_order: i }))

interface Props {
  postingId: string
  readOnly?: boolean
  eeoEnabled: boolean
  onEeoChange: (v: boolean) => void
}

export function SheetApplicationFormBuilder({ postingId, readOnly, eeoEnabled, onEeoChange }: Props) {
  const { fields: posting, addCustomField, addFieldFromLibrary, updateField, deleteField, reorderFields } = useJobPostingFields(postingId)
  const { coreFields } = useCoreFields()

  // Synthesize locked core-field rows that always appear at the top.
  const coreAppFields = useMemo<AppField[]>(
    () =>
      coreFields.map((cf) => ({
        id: `core:${cf.field_name}`,
        label: cf.field_label,
        type: dbTypeToShared(cf.field_type as DbFieldType),
        required: cf.is_required,
        locked: true,
        isSmart: !!cf.is_smart,
        icon: CORE_FIELD_ICONS[cf.field_name] || iconForType(cf.field_type),
        hint: cf.help_text || undefined,
      })),
    [coreFields]
  )

  const customAppFields = useMemo<AppField[]>(
    () => posting.map(postingToAppField),
    [posting]
  )

  const combined = useMemo<AppField[]>(() => [...coreAppFields, ...customAppFields], [coreAppFields, customAppFields])

  return (
    <ApplicationFormBuilder
      fields={combined}
      // Required by the props contract, but never used because we provide all
      // granular handlers below.
      onChange={() => { /* no-op: granular handlers handle every mutation */ }}
      eeoEnabled={eeoEnabled}
      onEeoChange={onEeoChange}
      readOnly={readOnly}
      onAddSmart={(sf) => {
        void addCustomField({
          field_label: sf.label,
          field_type: sharedTypeToDb(sf.type),
          is_required: false,
          help_text: sf.hint,
          field_config: sf.type === 'salary' ? ({ currency: 'USD', period: 'annually' } as any) : undefined,
        })
      }}
      onAddBasic={(bt) => {
        void addCustomField({
          field_label: `New ${bt.label.toLowerCase()} question`,
          field_type: sharedTypeToDb(bt.type),
          is_required: false,
          field_config: bt.type === 'score' ? ({ max: 5 } as any) : undefined,
          select_options: CHOICE_TYPES.has(bt.type) ? toDbOptions(defaultChoiceOptions()) : undefined,
        })
      }}
      onAddFromLibrary={(lf) => {
        void addFieldFromLibrary(lf as any)
      }}
      onRenameField={(id, label) => {
        void updateField(id, { field_label: label } as any)
      }}
      onToggleRequired={(id, next) => {
        void updateField(id, { is_required: next } as any)
      }}
      onUpdateFieldConfig={(id, patch) => {
        const current = posting.find((p) => p.id === id)
        const merged = { ...(current?.field_config as any || {}), ...patch }
        void updateField(id, { field_config: merged } as any)
      }}
      onUpdateOptions={(id, opts) => {
        void updateField(id, { select_options: toDbOptions(opts) } as any)
      }}
      onRemoveField={async (id) => {
        const field = posting.find((p) => p.id === id) as { label?: string } | undefined
        // J25 (Block B §16, Pattern 1): answers live apart from the field, so they stay.
        if (!(await confirmDestructive({
          title: field?.label ? `Remove “${field.label}” from the form?` : 'Remove this question from the form?',
          description: 'New applicants won’t see it on this posting. Answers already submitted are kept.',
          confirmLabel: 'Remove question',
        }))) return
        void deleteField(id)
      }}
      onReorderFields={(orderedIds) => {
        // orderedIds excludes locked core rows; only persisted custom fields.
        void reorderFields(orderedIds)
      }}
    />
  )
}
