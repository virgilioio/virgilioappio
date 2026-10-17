import { useRef, useState, type ReactNode } from 'react'
import { Building2, FilePen, FileText, IdCard, PenLine, Upload, UserRound, X, type LucideIcon } from 'lucide-react'

import { FormSection } from '@/components/references/FormSection'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { prefersReducedMotion } from '@/lib/motion'
import { inspectPdf, PdfProblem, primePdf, uploadTemplatePdf } from '@/lib/sign/pdf'
import { APP_LABEL, removeDoc, uid, useOfferFormFieldCounts, useOfferForms, withKind, type SignApp, type TplDraft } from '@/lib/sign/templates'
import { emptyContent, nextPosition, removeWritten, signBlocks, writtenKeys, type TplWritten } from '@/lib/sign/written'
import { WrittenEditor } from '@/components/sign/written/WrittenEditor'
import type { SignKind } from '@/lib/sign/api'
import { Field, Seg } from './parts'

const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

/** Shakes a card once (6px, --dur-shake) unless reduced motion is on. */
function shake(el: HTMLElement | null) {
  if (!el || prefersReducedMotion()) return
  el.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(5px)' },
      { transform: 'translateX(-3px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
  )
}

/**
 * Template info (2026-10-17): Basics (name, type, where it's used, the offer
 * form, a description) and Documents: two checkbox cards, Write in Gio and
 * Upload a document, either or both. Unticking keeps that source's content as
 * a draft until the template is saved; at least one stays ticked.
 */
export function InfoStep({
  d,
  set,
  tenantId,
}: {
  d: TplDraft
  set: (fn: (d: TplDraft) => TplDraft) => void
  tenantId: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const cards = useRef<Record<'written' | 'uploads', HTMLButtonElement | null>>({ written: null, uploads: null })
  const forms = useOfferForms()
  const counts = useOfferFormFieldCounts()
  const [over, setOver] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [editing, setEditing] = useState<TplWritten | null>(null)

  const toggle = (which: 'written' | 'uploads') => {
    const on = which === 'written' ? d.use_written : d.use_uploads
    const other = which === 'written' ? d.use_uploads : d.use_written
    // At least one stays ticked: the only ticked card shakes instead.
    if (on && !other) return shake(cards.current[which])
    set((x) => (which === 'written' ? { ...x, use_written: !on } : { ...x, use_uploads: !on }))
  }

  const writeNew = () => {
    const w: TplWritten = { id: uid(), name: d.kind === 'candidate' ? 'Offer letter' : 'Agreement', position: nextPosition(d), content: emptyContent() }
    setEditing(w)
  }

  const addFiles = async (files: FileList | File[]) => {
    setProblem(null)
    for (const file of Array.from(files)) {
      let info: Awaited<ReturnType<typeof inspectPdf>>
      try {
        info = await inspectPdf(file)
      } catch (e) {
        setProblem(e instanceof PdfProblem ? e.message : `${file.name} couldn’t be read as a PDF.`)
        continue
      }
      const id = uid()
      set((x) => ({
        ...x,
        docs: [
          ...x.docs,
          {
            id,
            position: nextPosition(x),
            name: file.name.slice(0, 200),
            storage_path: '',
            page_count: info.page_count,
            page_sizes: info.page_sizes,
            size_bytes: info.size_bytes,
            sha256: info.sha256,
            uploading: 0,
            file,
          },
        ],
      }))
      try {
        const path = await uploadTemplatePdf(tenantId, d.id, file, (pct) =>
          set((x) => ({ ...x, docs: x.docs.map((y) => (y.id === id ? { ...y, uploading: pct } : y)) })),
        )
        primePdf(path, info.pdf)
        set((x) => ({ ...x, docs: x.docs.map((y) => (y.id === id ? { ...y, storage_path: path, uploading: undefined } : y)) }))
      } catch (e) {
        set((x) => ({ ...x, docs: x.docs.filter((y) => y.id !== id) }))
        setProblem(e instanceof PdfProblem ? e.message : `Couldn’t upload ${file.name}. Try again.`)
      }
    }
  }

  const showForm = d.kind === 'candidate' && d.app === 'ats'

  return (
    <div className="max-w-[720px]">
      <FormSection title="Basics" subtitle="The name and type people see when picking a template.">
        <div className="flex flex-col gap-5">
          <Field label="Template name" required htmlFor="tpl-name">
            <Input
              id="tpl-name"
              value={d.name}
              maxLength={120}
              autoFocus
              placeholder="e.g. IC · Sales w/ Commission Agreement"
              onChange={(e) => {
                const v = e.target.value
                set((x) => ({ ...x, name: v }))
              }}
            />
          </Field>
          <Field label="Type" required help="Decides which data fields this template can use. Offer forms are only for candidates.">
            <Seg
              label="Type"
              value={d.kind}
              onChange={(k) => set((x) => withKind(x, k as SignKind))}
              options={[
                { value: 'customer', label: 'Customer', icon: Building2 },
                { value: 'candidate', label: 'Candidate', icon: UserRound },
                { value: 'member', label: 'Member', icon: IdCard },
              ]}
            />
          </Field>
          <Field
            label="Used in"
            required
            help={
              d.app === 'sales'
                ? 'Only Sales reps see it, on a deal in Gio Sales. It never shows in the ATS.'
                : 'Only shows in the ATS, on a candidate or for a member. Sales reps never see it.'
            }
          >
            <Seg
              label="Used in"
              value={d.app}
              onChange={(a) => set((x) => ({ ...x, app: a as SignApp, offer_form_id: a === 'ats' ? x.offer_form_id : null }))}
              options={[
                { value: 'ats', label: APP_LABEL.ats },
                { value: 'sales', label: APP_LABEL.sales },
              ]}
            />
          </Field>
          {/* Only candidate templates link to an offer form; the field opens and closes in place. */}
          <Collapsible open={showForm}>
            <CollapsibleContent>
              <Field label="Offer form" help="When an offer uses this form, this template is listed first, and its fields fill in from the offer.">
                <Select
                  value={d.offer_form_id ?? 'none'}
                  onValueChange={(v) =>
                    set((x) => ({
                      ...x,
                      offer_form_id: v === 'none' ? null : v,
                      // Fields from the old form can't be filled any more.
                      fields: x.fields.filter((f) => f.type !== 'data' || ['name', 'job', 'salary', 'start', 'today', 'sender'].includes(f.data_key ?? '') || v !== 'none'),
                      not_needed: v === x.offer_form_id ? x.not_needed : [],
                    }))
                  }
                >
                  <SelectTrigger className="h-9" aria-label="Offer form">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      None <span className="text-text-tertiary">· works with any candidate (NDAs, policies)</span>
                    </SelectItem>
                    {(forms.data ?? []).map((f) => {
                      const n = counts.data?.[f.id]
                      return (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}{' '}
                          <span className="tabular-nums text-text-tertiary">
                            {n != null ? `· ${n} field${n === 1 ? '' : 's'}` : ''}
                            {!f.is_active ? ' · inactive' : ''}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </Field>
            </CollapsibleContent>
          </Collapsible>
          <Field label="Description" optional htmlFor="tpl-desc">
            <Textarea
              id="tpl-desc"
              rows={2}
              maxLength={500}
              value={d.description}
              placeholder="When to use it, e.g. Independent contractors in sales roles"
              onChange={(e) => {
                const v = e.target.value
                set((x) => ({ ...x, description: v }))
              }}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Documents" subtitle="Pick one or both. With both, the written document comes first and the uploads follow, all in one envelope.">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SourceCard
              cardRef={(el) => (cards.current.written = el)}
              icon={PenLine}
              title="Write in Gio"
              body="Draft the agreement here with headings, lists and offer fields inline."
              bullets={['Text reflows around values of any length', 'Sections that only show when they apply']}
              checked={d.use_written}
              onToggle={() => toggle('written')}
            />
            <SourceCard
              cardRef={(el) => (cards.current.uploads = el)}
              icon={Upload}
              title="Upload a document"
              body="Use an existing PDF and place offer fields on its pages."
              bullets={['Keeps your layout exactly as it is', 'Signer fields go wherever you drop them']}
              checked={d.use_uploads}
              onToggle={() => toggle('uploads')}
            />
          </div>
          <p className="font-inter text-[12px] text-text-tertiary">
            {d.use_written && d.use_uploads
              ? 'Both on · write the agreement here and attach the uploaded files to the same envelope.'
              : 'At least one is needed.'}
          </p>

          {/* Written in Gio: the document itself is written on the Document step. */}
          <Collapsible open={d.use_written}>
            <CollapsibleContent>
              <ul className="flex flex-col divide-y divide-[#F0EFEA] rounded-xl border border-[#E7E8EE] bg-white">
                {d.written.map((w) => {
                  const tags = writtenKeys(w.content).tags.length
                  const blocks = signBlocks(w.content).length
                  return (
                    <FileRow
                      key={w.id}
                      icon={FilePen}
                      tint
                      name={w.name}
                      meta={`Written in Gio · ${tags} field${tags === 1 ? '' : 's'} · ${blocks} signing block${blocks === 1 ? '' : 's'}`}
                      actions={
                        <>
                          <Button variant="secondary" size="sm" icon={PenLine} onClick={() => setEditing(w)}>
                            Edit
                          </Button>
                          {d.written.length > 1 && (
                            <IconTip label={`Remove ${w.name}`}>
                              <Button variant="ghost" size="sm" iconOnly aria-label={`Remove ${w.name}`} onClick={() => set((x) => removeWritten(x, w.id))}>
                                <X />
                              </Button>
                            </IconTip>
                          )}
                        </>
                      }
                    />
                  )
                })}
                {!d.written.length && (
                  <li className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <p className="min-w-0 flex-1 font-inter text-[12.5px] text-text-secondary">Nothing written yet.</p>
                    <Button variant="secondary" size="sm" icon={FilePen} onClick={writeNew}>
                      Start writing
                    </Button>
                  </li>
                )}
              </ul>
            </CollapsibleContent>
          </Collapsible>

          {/* Uploads: the files, their progress, and a drop zone. */}
          <Collapsible open={d.use_uploads}>
            <CollapsibleContent>
              <div className="flex flex-col gap-3">
                {d.docs.length > 0 && (
                  <ul className="flex flex-col divide-y divide-[#F0EFEA] rounded-xl border border-[#E7E8EE] bg-white">
                    {d.docs.map((doc) => (
                      <FileRow
                        key={doc.id}
                        icon={FileText}
                        name={doc.name}
                        meta={
                          doc.uploading != null ? (
                            <span className="mt-1.5 block h-[3px] w-full max-w-[240px] overflow-hidden rounded-full bg-[#ECEBE6]" role="progressbar" aria-valuenow={Math.round(doc.uploading)} aria-label={`Uploading ${doc.name}`}>
                              <span className="gio-progress-fill block h-full w-full rounded-full bg-[#0d0d09]" style={{ transform: `scaleX(${doc.uploading / 100})`, transition: 'transform 300ms linear' }} />
                            </span>
                          ) : (
                            `${doc.page_count} page${doc.page_count === 1 ? '' : 's'} · ${fmtSize(doc.size_bytes)}`
                          )
                        }
                        actions={
                          <IconTip label={`Remove ${doc.name}`}>
                            <Button variant="ghost" size="sm" iconOnly aria-label={`Remove ${doc.name}`} disabled={doc.uploading != null} onClick={() => set((x) => removeDoc(x, doc.id))}>
                              <X />
                            </Button>
                          </IconTip>
                        }
                      />
                    ))}
                  </ul>
                )}
                <div
                  role="button"
                  tabIndex={0}
                  data-drag-over={over || undefined}
                  onClick={() => input.current?.click()}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current?.click())}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setOver(true)
                  }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setOver(false)
                    void addFiles(e.dataTransfer.files)
                  }}
                  className={cn(
                    'gio-dropzone flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center',
                    over ? 'border-virgilio-purple bg-[#F6F1FE]' : 'border-[#D9D8D2] bg-[#FAFAF7] hover:bg-[#F6F5F1]',
                  )}
                >
                  <Upload className="h-5 w-5 text-text-secondary" strokeWidth={2} aria-hidden />
                  <p className="font-inter text-[13px] font-medium text-text-primary">{d.docs.length ? 'Add another document' : 'Drop a PDF'}</p>
                  <p className="font-inter text-[11.5px] text-text-tertiary">or click to browse · up to 25 MB</p>
                  <input
                    ref={input}
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    hidden
                    onChange={(e) => {
                      if (e.target.files) void addFiles(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </div>
                <p className="gio-field-message min-h-[18px] font-inter text-[12px] text-virgilio-error" role={problem ? 'alert' : undefined}>
                  {problem}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </FormSection>
      <WrittenEditor
        open={!!editing}
        doc={editing}
        kind={d.kind}
        formId={d.offer_form_id}
        roles={d.roles}
        onClose={() => setEditing(null)}
        onDone={(w) => {
          set((x) => ({ ...x, written: x.written.some((y) => y.id === w.id) ? x.written.map((y) => (y.id === w.id ? w : y)) : [...x.written, w] }))
          setEditing(null)
        }}
      />
    </div>
  )
}

/** One of the two Documents cards: a big checkbox (role="checkbox"). */
function SourceCard({
  cardRef,
  icon: Icon,
  title,
  body,
  bullets,
  checked,
  onToggle,
}: {
  cardRef: (el: HTMLButtonElement | null) => void
  icon: LucideIcon
  title: string
  body: string
  bullets: string[]
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button ref={cardRef} type="button" role="checkbox" aria-checked={checked} className="gio-src-card" onClick={onToggle}>
      <span className="gio-src-tile" aria-hidden>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="gio-src-box" aria-hidden>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path pathLength={1} d="M3.6 8.4 6.6 11.2 12.4 4.8" />
        </svg>
      </span>
      <span className="font-poppins text-[14px] font-semibold text-text-primary">{title}</span>
      <span className="font-inter text-[12.5px] leading-snug text-text-secondary">{body}</span>
      <ul className="mt-0.5 flex flex-col gap-1">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2 font-inter text-[12px] text-text-tertiary">
            <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#B5B9C4]" />
            {b}
          </li>
        ))}
      </ul>
    </button>
  )
}

function FileRow({ icon: Icon, tint, name, meta, actions }: { icon: LucideIcon; tint?: boolean; name: string; meta: ReactNode; actions: ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tint ? 'bg-[#F2EBFF] text-virgilio-purple' : 'bg-[#F1F0EC] text-text-secondary')}>
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-inter text-[13px] font-medium text-text-primary">{name}</p>
        <div className="font-inter text-[11.5px] tabular-nums text-text-tertiary">{meta}</div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">{actions}</div>
    </li>
  )
}
