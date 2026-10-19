import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { OfferForm } from '@/hooks/useOfferForms'
import type { OfferFormField } from '@/hooks/useOfferFormFields'
import { formSections, type OfferSection } from '@/lib/offerSections'
import { offerFieldName } from '@/lib/offerFieldName'
import { motionToken } from '@/lib/motion'

export interface FormDoc {
  form: OfferForm
  fields: OfferFormField[]
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type Meta = Partial<Pick<OfferForm, 'name' | 'description' | 'is_active'>>
export type FieldPatch = Partial<
  Pick<OfferFormField, 'field_label' | 'field_type' | 'is_required' | 'help_text' | 'placeholder_text' | 'field_config' | 'triggers_approval_restart'>
>
export interface NewField {
  label: string
  type: OfferFormField['field_type']
  section_key: string | null
}

function must<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error
  return res.data
}

/** The fields' section keys as the database leaves them after a sections change (offer_forms_z_sections_moved). */
function placeFields(fields: OfferFormField[], sections: OfferSection[]): OfferFormField[] {
  const ids = new Set(sections.map((s) => s.id))
  const last = sections.length ? sections[sections.length - 1].id : null
  return fields.map((f) => (f.section_key && ids.has(f.section_key) ? f : f.section_key === last ? f : { ...f, section_key: last }))
}

/**
 * The offer form sheet's data (2026-10-19): one form and its fields, edited in
 * place. Every change shows at once and saves in the background; the sheet
 * shows one status for all of them (Saving… → Saved → Saved just now), and a
 * save that fails stays on screen as "Couldn't save · Retry". Name and
 * description save --delay-autosave after typing stops.
 */
export function useOfferFormEditor(formId: string | undefined) {
  const query = useQuery({
    queryKey: ['offer-form-doc', formId],
    enabled: !!formId,
    staleTime: 0,
    queryFn: async (): Promise<FormDoc> => {
      const [form, fields] = await Promise.all([
        supabase.from('offer_forms').select('*').eq('id', formId!).single().then(must),
        supabase.from('offer_form_fields').select('*').eq('form_id', formId!).order('display_order').then(must),
      ])
      return { form: form as unknown as OfferForm, fields: (fields ?? []) as OfferFormField[] }
    },
  })

  const [doc, setDoc] = useState<FormDoc | null>(null)
  const docRef = useRef<FormDoc | null>(null)
  docRef.current = doc
  useEffect(() => {
    if (!formId) setDoc(null)
    else if (query.data && docRef.current?.form.id !== query.data.form.id) setDoc(query.data)
  }, [formId, query.data])

  // ---- one status for every save ----
  const pending = useRef(0)
  const failed = useRef<(() => Promise<void>) | null>(null)
  const [state, setState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const settle = useRef<Array<() => void>>([])

  // Saves run one after another, in the order they were made: a field moved
  // into a section that was just added must reach the database after it.
  const chain = useRef<Promise<void>>(Promise.resolve())
  const run = useCallback((op: () => Promise<void>): Promise<void> => {
    pending.current += 1
    setState('saving')
    const next = chain.current.then(async () => {
      try {
        await op()
        if (failed.current === op) failed.current = null
      } catch (e) {
        console.error('Offer form save failed', e)
        failed.current = op
      } finally {
        pending.current -= 1
        if (pending.current === 0) {
          setState(failed.current ? 'error' : 'saved')
          if (!failed.current) setSavedAt(Date.now())
          settle.current.splice(0).forEach((done) => done())
        }
      }
    })
    chain.current = next
    return next
  }, [])

  const retry = useCallback(() => {
    const op = failed.current
    if (op) void run(op)
  }, [run])

  // ---- form name, description, active ----
  const metaTimer = useRef<number | null>(null)
  const metaPatch = useRef<Meta>({})
  const saveMeta = useCallback(() => {
    if (metaTimer.current) window.clearTimeout(metaTimer.current)
    metaTimer.current = null
    const patch = { ...metaPatch.current }
    metaPatch.current = {}
    // A form always keeps a name: an emptied title isn't saved.
    if ('name' in patch && !patch.name?.trim()) delete patch.name
    const id = docRef.current?.form.id
    if (!id || !Object.keys(patch).length) return
    void run(async () => {
      must(await supabase.from('offer_forms').update(patch).eq('id', id))
    })
  }, [run])

  const setMeta = useCallback(
    (patch: Meta, opts: { now?: boolean } = {}) => {
      setDoc((d) => (d ? { ...d, form: { ...d.form, ...patch } } : d))
      metaPatch.current = { ...metaPatch.current, ...patch }
      if (metaTimer.current) window.clearTimeout(metaTimer.current)
      if (opts.now) saveMeta()
      else metaTimer.current = window.setTimeout(saveMeta, motionToken('--delay-autosave', 600))
    },
    [saveMeta],
  )

  // ---- sections ----
  const setSections = useCallback(
    (sections: OfferSection[]): Promise<void> => {
      const d = docRef.current
      if (!d) return Promise.resolve()
      setDoc({ form: { ...d.form, sections }, fields: placeFields(d.fields, sections) })
      return run(async () => {
        must(await supabase.from('offer_forms').update({ sections } as never).eq('id', d.form.id))
      })
    },
    [run],
  )

  // ---- fields ----
  /** Where fields sit and their order; only rows that changed are written. */
  const placeAll = useCallback(
    (next: Array<{ id: string; section_key: string | null; display_order: number }>) => {
      const d = docRef.current
      if (!d) return
      const before = new Map(d.fields.map((f) => [f.id, f]))
      const changed = next.filter((n) => {
        const f = before.get(n.id)
        return f && (f.section_key !== n.section_key || f.display_order !== n.display_order)
      })
      if (!changed.length) return
      const by = new Map(changed.map((n) => [n.id, n]))
      setDoc({ ...d, fields: d.fields.map((f) => (by.has(f.id) ? { ...f, ...by.get(f.id)! } : f)) })
      void run(async () => {
        await Promise.all(
          changed.map(async (n) =>
            must(await supabase.from('offer_form_fields').update({ section_key: n.section_key, display_order: n.display_order } as never).eq('id', n.id)),
          ),
        )
      })
    },
    [run],
  )

  const addField = useCallback(
    async (input: NewField): Promise<OfferFormField | null> => {
      const d = docRef.current
      if (!d) return null
      const { data: auth } = await supabase.auth.getUser()
      let row: OfferFormField | null = null
      await run(async () => {
        const order = d.fields.reduce((m, f) => Math.max(m, f.display_order), -1) + 1
        row = must(
          await supabase
            .from('offer_form_fields')
            .insert({
              form_id: d.form.id,
              organization_id: d.form.organization_id ?? null,
              created_by: auth.user?.id ?? null,
              field_name: offerFieldName(input.label, d.fields.map((f) => f.field_name)),
              field_label: input.label.trim(),
              field_type: input.type,
              is_required: false,
              display_order: order,
              section_key: input.section_key,
              triggers_approval_restart: false,
              ...(input.type === 'salary'
                ? { field_config: { currency: 'USD', period: 'annually' } }
                : input.type === 'location'
                  ? { field_config: { fields: ['city', 'state', 'country'] } }
                  : input.type === 'phone'
                    ? { field_config: { defaultCountryCode: '+1' } }
                    : {}),
            } as never)
            .select()
            .single(),
        ) as OfferFormField
      })
      if (row) {
        const added = row as OfferFormField
        setDoc((x) => (x ? { ...x, fields: [...x.fields, added] } : x))
      }
      return row
    },
    [run],
  )

  const updateField = useCallback(
    async (id: string, patch: FieldPatch): Promise<boolean> => {
      const d = docRef.current
      if (!d) return false
      const prev = d.fields.find((f) => f.id === id)
      setDoc({ ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
      let ok = false
      await run(async () => {
        // The stored name never changes: offers keep their values under it and templates place it by it.
        must(await supabase.from('offer_form_fields').update(patch as never).eq('id', id))
        ok = true
      })
      if (!ok && prev) setDoc((x) => (x ? { ...x, fields: x.fields.map((f) => (f.id === id ? prev : f)) } : x))
      return ok
    },
    [run],
  )

  const removeField = useCallback(
    async (id: string): Promise<boolean> => {
      let ok = false
      await run(async () => {
        must(await supabase.from('offer_form_fields').delete().eq('id', id))
        ok = true
      })
      if (ok) setDoc((x) => (x ? { ...x, fields: x.fields.filter((f) => f.id !== id) } : x))
      return ok
    },
    [run],
  )

  /** Saves a name still being typed and waits for every save in flight. */
  const flush = useCallback(async () => {
    saveMeta()
    if (pending.current === 0) return
    await new Promise<void>((done) => settle.current.push(done))
  }, [saveMeta])

  useEffect(() => () => {
    if (metaTimer.current) window.clearTimeout(metaTimer.current)
  }, [])

  return {
    doc,
    sections: doc ? formSections(doc.form) : [],
    isLoading: !!formId && !doc && query.isLoading,
    error: query.error,
    refetch: query.refetch,
    state,
    savedAt,
    retry,
    setMeta,
    setSections,
    placeAll,
    addField,
    updateField,
    removeField,
    flush,
  }
}

export type OfferFormEditor = ReturnType<typeof useOfferFormEditor>
