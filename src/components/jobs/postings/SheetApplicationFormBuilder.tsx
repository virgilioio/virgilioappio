/**
 * SheetApplicationFormBuilder
 *
 * Adapter that wires the shared ApplicationFormBuilder UI to the persisted
 * job_posting_application_fields table via useJobPostingFields. Used inside
 * PostingSheet so the New/Edit posting flow uses the EXACT same design as
 * Wizard Step 4 (Job Posting).
 */

import { useEffect, useMemo, useRef } from 'react'
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
  const { fields: posting, addCustomField, updateField, deleteField, reorderFields } = useJobPostingFields(postingId)
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

  // Track the last AppField snapshot we surfaced so onChange diffs are accurate.
  const lastRef = useRef<AppField[]>(combined)
  useEffect(() => {
    lastRef.current = combined
  }, [combined])

  const handleChange = async (next: AppField[]) => {
    const prev = lastRef.current
    lastRef.current = next

    const prevCustom = prev.filter((f) => !f.locked)
    const nextCustom = next.filter((f) => !f.locked)

    const prevIds = new Set(prevCustom.map((f) => f.id))
    const nextIds = new Set(nextCustom.map((f) => f.id))

    // 1. Removed
    for (const f of prevCustom) {
      if (!nextIds.has(f.id)) {
        await deleteField(f.id)
      }
    }

    // 2. Added (locally generated transient ids)
    for (const f of nextCustom) {
      if (!prevIds.has(f.id)) {
        await addCustomField({
          field_label: f.label,
          field_type: sharedTypeToDb(f.type),
          is_required: f.required,
          help_text: f.hint,
          field_config: (f.fieldConfig as any) || undefined,
        })
      }
    }

    // 3. Updates (label / required / field_config) on existing fields
    for (const f of nextCustom) {
      if (!prevIds.has(f.id)) continue
      const before = prevCustom.find((x) => x.id === f.id)
      if (!before) continue
      const updates: { field_label?: string; is_required?: boolean; field_config?: any } = {}
      if (before.label !== f.label) updates.field_label = f.label
      if (before.required !== f.required) updates.is_required = f.required
      if (JSON.stringify(before.fieldConfig || null) !== JSON.stringify(f.fieldConfig || null)) {
        updates.field_config = f.fieldConfig || null
      }
      if (Object.keys(updates).length > 0) {
        await updateField(f.id, updates as any)
      }
    }

    // 4. Reorder (only consider persisted ids, skip just-added transient ones)
    const persistedNextIds = nextCustom.map((f) => f.id).filter((id) => prevIds.has(id))
    const persistedPrevIds = prevCustom.map((f) => f.id).filter((id) => nextIds.has(id))
    if (persistedNextIds.length === persistedPrevIds.length && persistedNextIds.length > 1) {
      const changed = persistedNextIds.some((id, i) => id !== persistedPrevIds[i])
      if (changed) await reorderFields(persistedNextIds)
    }
  }

  return (
    <ApplicationFormBuilder
      fields={combined}
      onChange={handleChange}
      eeoEnabled={eeoEnabled}
      onEeoChange={onEeoChange}
      readOnly={readOnly}
    />
  )
}
