import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Loadable } from '@/components/ui/loadable'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadError } from '@/components/empty/LoadError'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { DEFAULT_SECTIONS, formSections } from '@/lib/offerSections'
import { cn } from '@/lib/utils'
import { FormSections } from './FormSections'
import { FormPreview } from './FormPreview'
import { useOfferFormEditor, type SaveState } from './useOfferFormEditor'

/**
 * Create / edit an offer form (Allan, 2026-10-19), in the template sheet's
 * frame: the name as the title with its purple period, a description, Active,
 * then the form's sections (FormSections) or a Preview of what recruiters
 * fill in. Everything saves as you go; the header shows one status for it.
 * A new form is created once it has a name, and starts with DEFAULT_SECTIONS.
 */
export function OfferFormSheet({
  open,
  onOpenChange,
  formId,
  createForm,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId?: string
  createForm: (data: { name: string; description?: string }) => Promise<{ id: string } | null | undefined>
  /** The form list refreshes when the sheet closes. */
  onChanged?: () => void
}) {
  const [createdId, setCreatedId] = useState<string>()
  const id = formId ?? createdId
  const editor = useOfferFormEditor(open ? id : undefined)
  const qc = useQueryClient()
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [draft, setDraft] = useState({ name: '', description: '' })
  const [creating, setCreating] = useState(false)
  const timedOut = useLoadTimeout(editor.isLoading, id)
  const scroller = useRef<HTMLElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [tab])

  useEffect(() => {
    if (!open) {
      setCreatedId(undefined)
      setTab('edit')
      setDraft({ name: '', description: '' })
    }
  }, [open])

  const form = editor.doc?.form
  const name = id ? form?.name ?? '' : draft.name
  const description = id ? form?.description ?? '' : draft.description
  const fields = editor.doc?.fields ?? []
  const sections = id ? editor.sections : DEFAULT_SECTIONS

  const close = async () => {
    if (id) await editor.flush()
    onOpenChange(false)
    if (id) {
      onChanged?.()
      void qc.invalidateQueries({ queryKey: ['offer-form-doc', id] })
    }
  }

  const create = async () => {
    if (!draft.name.trim() || creating) return
    setCreating(true)
    try {
      const row = await createForm({ name: draft.name.trim(), description: draft.description.trim() || undefined })
      if (row?.id) setCreatedId(row.id)
    } catch {
      // createForm shows the error
    } finally {
      setCreating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && void close()}>
      <SheetContent
        side="right"
        aria-modal="true"
        className="w-full border-l border-virgilio-border bg-virgilio-cream p-0 sm:max-w-[920px]"
        onEscapeKeyDown={(e) => {
          // A field or section being edited takes Esc for itself.
          const local = document.activeElement instanceof Element && document.activeElement.closest('[data-escape-local]')
          if (local) e.preventDefault()
        }}
      >
        <div className="flex h-full flex-col">
          <header className="px-6 pb-4 pt-1 sm:px-10">
            <p className="font-poppins text-[11px] font-semibold uppercase tracking-[0.14em] text-virgilio-purple">{id ? 'Offer form' : 'New offer form'}</p>
            <SheetTitle className="sr-only">{name || 'New offer form'}</SheetTitle>
            <SheetDescription className="sr-only">The fields recruiters fill in when they write an offer, in sections.</SheetDescription>
            <TitleInput
              value={name}
              autoFocus={!id}
              onChange={(v) => (id ? editor.setMeta({ name: v }) : setDraft((d) => ({ ...d, name: v })))}
              onEnter={() => !id && void create()}
              invalid={!!id && !!form && !name.trim()}
            />
            <input
              value={description}
              maxLength={240}
              aria-label="Description"
              placeholder="When to use it, e.g. Sales roles with commission"
              onChange={(e) => (id ? editor.setMeta({ description: e.target.value }) : setDraft((d) => ({ ...d, description: e.target.value })))}
              className="mt-1.5 w-full max-w-xl rounded-md bg-transparent px-0 font-inter text-[13.5px] leading-snug text-text-secondary placeholder:text-text-tertiary focus:outline-none focus-visible:bg-white/70"
            />
            {id && form && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex items-center gap-2 font-inter text-[12.5px] text-text-secondary">
                  <Switch checked={form.is_active} onCheckedChange={(on) => editor.setMeta({ is_active: on }, { now: true })} />
                  {form.is_active ? 'Active: recruiters can pick it' : 'Inactive: hidden from new offers'}
                </label>
                <span className="font-inter text-[12px] tabular-nums text-text-tertiary">
                  {formSections(form).length} {formSections(form).length === 1 ? 'section' : 'sections'} · {fields.length} {fields.length === 1 ? 'field' : 'fields'}
                </span>
                <SaveStatus state={editor.state} savedAt={editor.savedAt} onRetry={editor.retry} />
              </div>
            )}
          </header>

          {id && (
            <div className="flex items-center border-b border-virgilio-border px-6 sm:px-10">
              <Tabs value={tab} onValueChange={(v) => setTab(v as 'edit' | 'preview')}>
                <TabsList indicator="underline" className="h-auto justify-start gap-6 rounded-none border-0 bg-transparent p-0 shadow-none">
                  <TabsTrigger value="edit">Sections & fields</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          <main ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10">
            {!id ? (
              <NewFormNote />
            ) : editor.error || timedOut ? (
              <div className="py-12">
                <LoadError what="this offer form" timedOut={timedOut && !editor.error} onRetry={() => void editor.refetch()} />
              </div>
            ) : (
              <Loadable loading={editor.isLoading} skeleton={<SectionsSkeleton />}>
                {tab === 'edit' ? <FormSections editor={editor} /> : <FormPreview sections={sections} fields={fields} />}
              </Loadable>
            )}
          </main>

          <footer className="flex items-center justify-between gap-4 border-t border-virgilio-border bg-virgilio-cream/95 px-6 py-4 backdrop-blur sm:px-10">
            <p className="min-w-0 truncate font-inter text-[12px] text-text-tertiary">
              {id ? 'Changes save as you go. Offers already made keep their answers.' : 'Name the form to start adding fields.'}
            </p>
            {id ? (
              <Button onClick={() => void close()}>Done</Button>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button onClick={() => void create()} loading={creating} disabled={!draft.name.trim()}>
                  Create form
                </Button>
              </div>
            )}
          </footer>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * The form's name as the sheet title, with its purple period: it wraps (up to
 * three lines) and turns into a text box when clicked. A new form starts in
 * the text box.
 */
function TitleInput({
  value,
  onChange,
  onEnter,
  autoFocus,
  invalid,
}: {
  value: string
  onChange: (v: string) => void
  onEnter: () => void
  autoFocus?: boolean
  invalid?: boolean
}) {
  const [editing, setEditing] = useState(!!autoFocus)
  const type = 'font-poppins text-[28px] font-semibold leading-tight tracking-[-0.04em] sm:text-[34px]'
  if (!editing)
    return (
      <h2 className="mt-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Rename ${value || 'form'}`}
          className={cn(type, 'line-clamp-3 max-w-full rounded-md text-left text-text-primary [overflow-wrap:anywhere] hover:text-text-secondary')}
        >
          {value || <span className="text-text-tertiary">Untitled offer form</span>}
          <span className="text-virgilio-purple">.</span>
        </button>
      </h2>
    )
  return (
    <input
      value={value}
      autoFocus
      maxLength={120}
      data-text-large=""
      data-escape-local=""
      aria-label="Form name"
      aria-invalid={invalid || undefined}
      placeholder="Untitled offer form"
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => value.trim() && !autoFocus && setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onEnter()
          if (value.trim() && !autoFocus) setEditing(false)
        }
        if (e.key === 'Escape' && value.trim() && !autoFocus) {
          e.stopPropagation()
          setEditing(false)
        }
      }}
      className={cn(type, 'mt-2 w-full min-w-0 rounded-md bg-transparent p-0 text-text-primary placeholder:text-text-tertiary focus:outline-none', invalid && 'text-[#C2372B]')}
    />
  )
}

/** "Saving…" → "Saved" → "Saved just now", each step crossfading; a failed save stays with Retry. */
function SaveStatus({ state, savedAt, onRetry }: { state: SaveState; savedAt: number | null; onRetry: () => void }) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (state !== 'saved' || !savedAt) return
    const t = window.setTimeout(() => tick((n) => n + 1), 2000)
    return () => window.clearTimeout(t)
  }, [state, savedAt])
  if (state === 'idle') return null
  if (state === 'error')
    return (
      <span role="status" className="gio-autosave-label flex items-center gap-1.5 font-inter text-[12px] text-[#C2372B]">
        Couldn’t save the last change ·
        <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
          Retry
        </button>
      </span>
    )
  const text = state === 'saving' ? 'Saving…' : savedAt && Date.now() - savedAt < 2000 ? 'Saved' : 'Saved just now'
  return (
    <span role="status" key={text} className="gio-autosave-label font-inter text-[12px] text-text-tertiary">
      {text}
    </span>
  )
}

function NewFormNote() {
  return (
    <div className="max-w-[640px] rounded-[12px] border border-[#E7E8EE] bg-white p-5">
      <p className="font-poppins text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[#1F2230]">How it starts</p>
      <p className="mt-2 font-inter text-[13px] leading-relaxed text-text-secondary">
        A new form has four sections: {DEFAULT_SECTIONS.map((s) => s.title).join(', ').replace(/, ([^,]*)$/, ' and $1')}. Rename, reorder or remove any of them, add your
        own, and put each field where it belongs. Every offer also asks for the Req ID, at the top of the first section.
      </p>
    </div>
  )
}

function SectionsSkeleton() {
  return (
    <div className="flex flex-col gap-[18px]">
      {[3, 2, 1].map((rows, i) => (
        <div key={i}>
          <Skeleton className="mb-2.5 h-[18px] w-40" />
          <div className="rounded-[12px] border border-[#E7E8EE] bg-white">
            {Array.from({ length: rows }).map((_, r) => (
              <div key={r} className="flex items-center gap-3 border-t border-[#F1F0EC] px-3 py-3 first:border-t-0">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 flex-1 max-w-[260px]" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
