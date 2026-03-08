
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { ApplicationFieldWithRelations } from './useApplicationFields'

export type FieldType = 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'checkbox_group' | 'date' | 'file' | 'url' | 'salary' | 'location' | 'phone' | 'recruiter' | 'employment_type' | 'work_location' | 'linkedin'

export interface SalaryFieldConfig {
  currency: string
  period: 'hourly' | 'monthly' | 'annually'
}

export interface LocationFieldConfig {
  fields: ('city' | 'state' | 'country')[]
}

export interface PhoneFieldConfig {
  defaultCountryCode?: string
}

export interface SelectOptionData {
  option_value: string
  option_label: string
  display_order: number
}

export interface PostingField {
  id: string
  posting_id: string
  source: 'library' | 'custom'
  application_field_id?: string | null
  field_name: string
  field_label: string
  field_type: FieldType
  is_required: boolean
  display_order: number
  column_span: number
  placeholder_text?: string | null
  help_text?: string | null
  accepted_file_types?: string | null
  max_file_size_mb?: number | null
  field_config?: SalaryFieldConfig | LocationFieldConfig | null
  created_at: string
  updated_at: string
}

export function useJobPostingFields(postingId: string) {
  const { toast } = useToast()
  const [fields, setFields] = useState<PostingField[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchFields = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('job_posting_application_fields')
      .select('*')
      .eq('posting_id', postingId)
      .order('display_order', { ascending: true })
    if (error) {
      console.error('Error loading posting fields:', error)
      toast({ title: 'Error', description: 'Failed to load form fields', variant: 'destructive' })
      setFields([])
    } else {
      const rows = (data || []).map((row: any) => ({
        ...row,
        column_span: row.column_span ?? 4,
      }))
      setFields(rows as PostingField[])
    }
    setIsLoading(false)
  }, [postingId, toast])

  useEffect(() => {
    fetchFields()
  }, [fetchFields])

  const sanitizeName = (label: string) => {
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    return base || 'field'
  }

  const uniqueFieldName = async (label: string) => {
    const base = sanitizeName(label)
    let candidate = base
    let i = 1
    while (true) {
      const { data } = await supabase
        .from('job_posting_application_fields')
        .select('id')
        .eq('posting_id', postingId)
        .eq('field_name', candidate)
        .maybeSingle()
      if (!data) return candidate
      i += 1
      candidate = `${base}_${i}`
    }
  }

  const addCustomField = useCallback(async ({ field_label, field_type, is_required, placeholder_text, help_text, accepted_file_types, max_file_size_mb, select_options, field_config }: { field_label: string; field_type: FieldType; is_required: boolean; placeholder_text?: string; help_text?: string; accepted_file_types?: string; max_file_size_mb?: number; select_options?: SelectOptionData[]; field_config?: SalaryFieldConfig | LocationFieldConfig }) => {
    const field_name = await uniqueFieldName(field_label)
    const { data: inserted, error } = await supabase
      .from('job_posting_application_fields')
      .insert({
        posting_id: postingId,
        source: 'custom',
        application_field_id: null,
        field_name,
        field_label,
        field_type: field_type as any,
        is_required,
        column_span: 4,
        placeholder_text: placeholder_text || null,
        help_text: help_text || null,
        accepted_file_types: accepted_file_types || null,
        max_file_size_mb: max_file_size_mb ?? null,
        field_config: field_config ? (field_config as any) : null
      })
      .select()
      .maybeSingle()
    if (error || !inserted) {
      console.error('Error adding custom field:', error)
      toast({ title: 'Error', description: 'Could not add custom field', variant: 'destructive' })
    } else {
      // Save select options if provided
      if (select_options?.length && (field_type === 'select' || field_type === 'checkbox_group')) {
        const rows = select_options.map((o, i) => ({
          posting_field_id: inserted.id,
          option_value: o.option_value,
          option_label: o.option_label,
          display_order: i
        }))
        await supabase.from('posting_field_select_options').insert(rows as any)
      }
      await fetchFields()
      toast({ title: 'Added', description: 'Custom field added' })
    }
  }, [postingId, fetchFields, toast])

  const addFieldFromLibrary = useCallback(async (lib: ApplicationFieldWithRelations) => {
    // Insert the field row
    const { data: inserted, error } = await supabase
      .from('job_posting_application_fields')
      .insert({
        posting_id: postingId,
        source: 'library',
        application_field_id: lib.id,
        field_name: lib.field_name,
        field_label: lib.field_label,
        field_type: lib.field_type,
        is_required: false,
        column_span: 4,
        placeholder_text: lib.placeholder_text,
        help_text: lib.help_text,
        accepted_file_types: lib.accepted_file_types || null,
        max_file_size_mb: lib.max_file_size_mb ?? null
      })
      .select()
      .maybeSingle()
    if (error || !inserted) {
      console.error('Error adding library field:', error)
      toast({ title: 'Error', description: 'Could not add library field', variant: 'destructive' })
      return
    }

    // Copy select options (if any)
    if (lib.field_type === 'select' && lib.select_options?.length) {
      const rows = lib.select_options
        .sort((a, b) => a.display_order - b.display_order)
        .map((o) => ({
          posting_field_id: inserted.id,
          option_value: o.option_value,
          option_label: o.option_label,
          display_order: o.display_order
        }))
      const { error: optErr } = await supabase.from('posting_field_select_options').insert(rows as any)
      if (optErr) console.error('Error copying select options:', optErr)
    }

    // Copy validation rules (if any)
    if (lib.validation_rules?.length) {
      const rows = lib.validation_rules.map((r) => ({
        posting_field_id: inserted.id,
        rule_type: r.rule_type,
        rule_value: r.rule_value,
        error_message: r.error_message
      }))
      const { error: vrErr } = await supabase.from('posting_field_validation_rules').insert(rows as any)
      if (vrErr) console.error('Error copying validation rules:', vrErr)
    }

    await fetchFields()
    toast({ title: 'Added', description: 'Field added from library' })
  }, [postingId, fetchFields, toast])

  const updateField = useCallback(async (id: string, updates: Partial<PostingField> & { select_options?: SelectOptionData[] }) => {
    const { select_options, ...dbUpdates } = updates
    const { error } = await supabase
      .from('job_posting_application_fields')
      .update(dbUpdates as any)
      .eq('id', id)
    if (error) {
      console.error('Error updating field:', error)
      toast({ title: 'Error', description: 'Could not update field', variant: 'destructive' })
    } else {
      // Persist select options if provided (delete + re-insert)
      if (select_options !== undefined) {
        await supabase.from('posting_field_select_options').delete().eq('posting_field_id', id)
        if (select_options.length > 0) {
          const rows = select_options.map((o, i) => ({
            posting_field_id: id,
            option_value: o.option_value,
            option_label: o.option_label,
            display_order: i
          }))
          await supabase.from('posting_field_select_options').insert(rows as any)
        }
      }
      setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...dbUpdates } as PostingField : f)))
    }
  }, [toast])

  const deleteField = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('job_posting_application_fields')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('Error deleting field:', error)
      toast({ title: 'Error', description: 'Could not delete field', variant: 'destructive' })
    } else {
      setFields((prev) => prev.filter((f) => f.id !== id))
      toast({ title: 'Deleted', description: 'Field removed' })
    }
  }, [toast])

  const moveField = useCallback(async (id: string, dir: 'up' | 'down') => {
    // Simple swap with neighbor
    const idx = fields.findIndex((f) => f.id === id)
    if (idx < 0) return
    const neighborIdx = dir === 'up' ? idx - 1 : idx + 1
    if (neighborIdx < 0 || neighborIdx >= fields.length) return
    const a = fields[idx]
    const b = fields[neighborIdx]
    // Swap display_order
    const { error: e1 } = await supabase
      .from('job_posting_application_fields')
      .update({ display_order: b.display_order })
      .eq('id', a.id)
    const { error: e2 } = await supabase
      .from('job_posting_application_fields')
      .update({ display_order: a.display_order })
      .eq('id', b.id)
    if (e1 || e2) {
      console.error('Error moving field:', e1 || e2)
      toast({ title: 'Error', description: 'Could not reorder fields', variant: 'destructive' })
    } else {
      // Update local order
      const next = [...fields]
      next[idx] = { ...b }
      next[neighborIdx] = { ...a }
      setFields(next)
    }
  }, [fields, toast])

  const reorderFields = useCallback(async (orderedIds: string[]) => {
    // Persist new display_order based on index
    const updates = orderedIds.map((id, index) => ({ id, display_order: index }))
    for (const u of updates) {
      const { error } = await supabase
        .from('job_posting_application_fields')
        .update({ display_order: u.display_order })
        .eq('id', u.id)
      if (error) {
        console.error('Error updating display_order:', error)
        toast({ title: 'Error', description: 'Could not save new order', variant: 'destructive' })
        return
      }
    }
    // Update local state to reflect new order
    setFields((prev) => orderedIds.map((id) => prev.find((f) => f.id === id)!).filter(Boolean) as PostingField[])
  }, [toast])

  return { fields, isLoading, refetch: fetchFields, addCustomField, addFieldFromLibrary, updateField, deleteField, moveField, reorderFields }
}
