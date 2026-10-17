import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Building2, FilePen, FileText, IdCard, PenLine, Upload, UserRound, X } from 'lucide-react'

import { FormSection } from '@/components/references/FormSection'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { inspectPdf, PdfProblem, primePdf, uploadTemplatePdf } from '@/lib/sign/pdf'
import { APP_LABEL, moveItem, removeDoc, uid, useOfferForms, withKind, type SignApp, type TplDraft } from '@/lib/sign/templates'
import { docItems, emptyContent, nextPosition, removeWritten, signBlocks, writtenKeys, type TplWritten } from '@/lib/sign/written'
import { WrittenEditor } from '@/components/sign/written/WrittenEditor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SignKind } from '@/lib/sign/api'
import { Field, Seg } from './parts'

const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

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
  const forms = useOfferForms()
  const [over, setOver] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [editing, setEditing] = useState<TplWritten | null>(null)
  const items = docItems(d)

  const writeNew = () => {
    const w: TplWritten = { id: uid(), name: d.written.length ? `Document ${d.written.length + 1}` : 'Offer letter', position: nextPosition(d), content: emptyContent() }
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

  const fieldsOn = (docId: string) => {
    let gi = 0
    for (const doc of d.docs) {
      if (doc.id === docId) {
        const from = gi
        return d.fields.filter((f) => f.page >= from && f.page < from + doc.page_count).length
      }
      gi += doc.page_count
    }
    return 0
  }

  return (
    <div className="max-w-[720px]">
      <FormSection title="Basics" subtitle="The name and type admins and senders see when picking a template.">
        <div className="flex flex-col gap-5">
          <Field label="Template name" required htmlFor="tpl-name">
            <Input
              id="tpl-name"
              value={d.name}
              maxLength={120}
              autoFocus
              placeholder="e.g. Offer letter (Mexico)"
              onChange={(e) => {
                const v = e.target.value
                set((x) => ({ ...x, name: v }))
              }}
            />
          </Field>
          <Field label="Type" required help="Decides which data fields it can use: salary for candidates, deal value for customers.">
            <Seg
              label="Type"
              value={d.kind}
              onChange={(k) => set((x) => withKind(x, k as SignKind))}
              options={[
                { value: 'candidate', label: 'Candidate', icon: UserRound },
                { value: 'member', label: 'Member', icon: IdCard },
                { value: 'customer', label: 'Customer', icon: Building2 },
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
              onChange={(a) => set((x) => ({ ...x, app: a as SignApp }))}
              options={[
                { value: 'ats', label: APP_LABEL.ats },
                { value: 'sales', label: APP_LABEL.sales },
              ]}
            />
          </Field>
          {d.kind === 'candidate' && d.app === 'ats' && (
            <Field
              label="Offer form"
              help={
                d.offer_form_id
                  ? 'Linked: it can fill in any field of this form, and is offered when an offer built from it is sent.'
                  : 'Not linked: works with any candidate, using name, job title, salary and start date only.'
              }
            >
              <Select
                value={d.offer_form_id ?? 'none'}
                onValueChange={(v) =>
                  set((x) => ({
                    ...x,
                    offer_form_id: v === 'none' ? null : v,
                    // Fields from the old form can't be filled any more.
                    fields: v === 'none' ? x.fields.filter((f) => f.type !== 'data' || ['name', 'job', 'salary', 'start', 'today', 'sender'].includes(f.data_key ?? '')) : x.fields,
                  }))
                }
              >
                <SelectTrigger className="h-9" aria-label="Offer form">
                  <SelectValue placeholder="Any candidate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any candidate (no offer form)</SelectItem>
                  {(forms.data ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                      {!f.is_active ? ' · inactive' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Description" optional htmlFor="tpl-desc">
            <Textarea
              id="tpl-desc"
              rows={2}
              maxLength={500}
              value={d.description}
              placeholder="When to use it, e.g. Full-time hires in Mexico"
              onChange={(e) => {
                const v = e.target.value
                set((x) => ({ ...x, description: v }))
              }}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Documents" subtitle="Upload PDFs (up to 25 MB each) or write documents in Gio. They’re signed in this order.">
        <div className="flex flex-col gap-3">
          {items.length > 0 && (
            <ul className="flex flex-col divide-y divide-[#F0EFEA] rounded-xl border border-[#E7E8EE]">
              {items.map((item, i) => {
                const move = (
                  <>
                    <IconTip label="Move up">
                      <Button variant="ghost" size="sm" iconOnly aria-label="Move up" disabled={i === 0} onClick={() => set((x) => moveItem(x, i, i - 1))}>
                        <ArrowUp />
                      </Button>
                    </IconTip>
                    <IconTip label="Move down">
                      <Button variant="ghost" size="sm" iconOnly aria-label="Move down" disabled={i === items.length - 1} onClick={() => set((x) => moveItem(x, i, i + 1))}>
                        <ArrowDown />
                      </Button>
                    </IconTip>
                  </>
                )
                if (item.kind === 'written') {
                  const w = item.doc
                  const tags = writtenKeys(w.content).tags.length
                  const blocks = signBlocks(w.content).length
                  return (
                    <li key={w.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F2EBFF] text-virgilio-purple">
                        <FilePen className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-inter text-[13px] font-medium text-text-primary">{w.name}</p>
                        <p className="font-inter text-[11.5px] tabular-nums text-text-tertiary">
                          Written in Gio · {tags} field{tags === 1 ? '' : 's'} · {blocks} signing block{blocks === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button variant="secondary" size="sm" icon={PenLine} onClick={() => setEditing(w)}>
                          Edit
                        </Button>
                        {move}
                        <IconTip label={`Remove ${w.name}`}>
                          <Button variant="ghost" size="sm" iconOnly aria-label={`Remove ${w.name}`} onClick={() => set((x) => removeWritten(x, w.id))}>
                            <X />
                          </Button>
                        </IconTip>
                      </div>
                    </li>
                  )
                }
                const doc = item.doc
                const n = fieldsOn(doc.id)
                return (
                  <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F1F0EC] text-text-secondary">
                      <FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-inter text-[13px] font-medium text-text-primary">{doc.name}</p>
                      {doc.uploading != null ? (
                        <div className="mt-1.5 h-1 w-full max-w-[240px] overflow-hidden rounded-full bg-[#ECEBE6]" role="progressbar" aria-valuenow={Math.round(doc.uploading)} aria-label={`Uploading ${doc.name}`}>
                          <div
                            className="gio-progress-fill h-full w-full origin-left rounded-full bg-virgilio-purple"
                            style={{ transform: `scaleX(${doc.uploading / 100})`, transition: 'transform 300ms linear' }}
                          />
                        </div>
                      ) : (
                        <p className="font-inter text-[11.5px] tabular-nums text-text-tertiary">
                          {doc.page_count} page{doc.page_count === 1 ? '' : 's'} · {fmtSize(doc.size_bytes)}
                          {n > 0 && ` · ${n} field${n === 1 ? '' : 's'}`}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {move}
                      <IconTip label={`Remove ${doc.name}`}>
                        <Button variant="ghost" size="sm" iconOnly aria-label={`Remove ${doc.name}`} disabled={doc.uploading != null} onClick={() => set((x) => removeDoc(x, doc.id))}>
                          <X />
                        </Button>
                      </IconTip>
                    </div>
                  </li>
                )
              })}
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
              'gio-dropzone flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-7 text-center',
              over ? 'border-virgilio-purple bg-[#F6F1FE]' : 'border-[#D9D8D2] bg-[#FAFAF7] hover:bg-[#F6F5F1]',
            )}
          >
            <Upload className="h-5 w-5 text-text-secondary" strokeWidth={2} aria-hidden />
            <p className="font-inter text-[13px] text-text-secondary">
              <span className="font-medium text-text-primary">Drop PDFs here</span> or click to browse
            </p>
            <p className="font-inter text-[11.5px] text-text-tertiary">Word files: save them as PDF first, so what people sign is exactly what you laid out.</p>
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
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E7E8EE] bg-white px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-inter text-[13px] font-medium text-text-primary">Or write it in Gio</p>
              <p className="font-inter text-[11.5px] text-text-tertiary">Fields fill in, sections print only when they apply, and signing blocks place themselves.</p>
            </div>
            <Button variant="secondary" icon={FilePen} onClick={writeNew}>
              Write a document
            </Button>
          </div>
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
