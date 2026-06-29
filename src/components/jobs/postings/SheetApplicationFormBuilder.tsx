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
  type AppField,
  type FieldType as SharedFieldType,
} from './ApplicationFormBuilder'

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
  if (t === 'checkbox_group') return 'select'
  return t as SharedFieldType
}

/** Map shared AppField.type → persisted DB field_type. */
function sharedTypeToDb(t: SharedFieldType): DbFieldType {
  if (t === 'longtext') return 'textarea'
  if (t === 'yesno') return 'checkbox'
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
  }
}

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
      onRemoveField={(id) => {
        void deleteField(id)
      }}
      onReorderFields={(orderedIds) => {
        // orderedIds excludes locked core rows; only persisted custom fields.
        void reorderFields(orderedIds)
      }}
    />
  )
}
