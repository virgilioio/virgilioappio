import { useEffect, useState } from 'react'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { uid, useSampleValues, type TplDraft } from '@/lib/sign/templates'
import { emptyContent, nextPosition, useWrittenPreview } from '@/lib/sign/written'
import { FieldsEditor } from './FieldsEditor'
import { WrittenPane } from './WrittenPane'
import { formatUses, useWrittenTags, writtenPreviewInput } from './writtenTags'
import type { WrittenRail } from './PagesRail'

/** A page to bring into view: in the written Preview, or on the uploaded pages (n makes a repeat click count). */
export type PageFocus = { kind: 'written' | 'upload'; page: number; n: number }

/**
 * The Document step (§3, 2026-10-17), full width. Written in Gio and the
 * uploaded pages each have their own pane; with both, tabs switch between
 * them in envelope order. The written pane can show its Preview, filled in
 * with the latest offer on the linked form.
 */
export function DocumentStep({ d, set }: { d: TplDraft; set: (fn: (d: TplDraft) => TplDraft) => void }) {
  const hasWritten = d.use_written
  const hasUploads = d.use_uploads && d.docs.length > 0
  const both = hasWritten && hasUploads
  const [tab, setTab] = useState<'written' | 'uploads'>(hasWritten ? 'written' : 'uploads')
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [docId, setDocId] = useState<string | null>(null)
  const segRef = useSegmentLayer<HTMLDivElement>()

  useEffect(() => {
    if (tab === 'written' && !hasWritten) setTab('uploads')
    if (tab === 'uploads' && !hasUploads && hasWritten) setTab('written')
  }, [tab, hasWritten, hasUploads])

  // Write in Gio starts with a blank document to write in.
  const none = hasWritten && !d.written.length
  useEffect(() => {
    if (!none) return
    set((x) =>
      x.written.length
        ? x
        : { ...x, written: [{ id: uid(), name: x.kind === 'candidate' ? 'Offer letter' : 'Agreement', position: nextPosition(x), content: emptyContent() }] },
    )
  }, [none, set])

  const doc = d.written.find((w) => w.id === docId) ?? d.written[0] ?? null
  const formId = d.kind === 'candidate' ? d.offer_form_id : null
  const sampleQ = useSampleValues(formId, formatUses(doc?.content))
  const sample = sampleQ.data ? { firstName: sampleQ.data.firstName, values: sampleQ.data.values } : null
  const previewLabel = sample ? `Preview with ${sample.firstName ? `${sample.firstName}’s` : 'the latest'} offer` : 'Preview'

  // The page rail's written pages: the preview of what's written, a second after typing stops.
  const tags = useWrittenTags(d)
  const [settled, setSettled] = useState(doc ? { name: doc.name, content: doc.content } : null)
  useEffect(() => {
    const t = setTimeout(() => setSettled(doc ? { name: doc.name, content: doc.content } : null), 1000)
    return () => clearTimeout(t)
  }, [doc?.name, doc?.content]) // eslint-disable-line react-hooks/exhaustive-deps
  const railPdf = useWrittenPreview(settled && hasWritten ? writtenPreviewInput(settled, d.roles, tags, sample) : null, { keep: true })
  const written: WrittenRail | null = hasWritten && doc ? { name: doc.name, pdf: railPdf } : null
  const [focus, setFocus] = useState<PageFocus | null>(null)
  const [writtenPage, setWrittenPage] = useState<number | null>(null)
  const openWritten = (page: number) => {
    setTab('written')
    setView('preview')
    setFocus((f) => ({ kind: 'written', page, n: (f?.n ?? 0) + 1 }))
  }
  const openUpload = (page: number) => {
    setTab('uploads')
    setFocus((f) => ({ kind: 'upload', page, n: (f?.n ?? 0) + 1 }))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-[48px] shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-virgilio-border bg-white px-4 py-2">
        {both && (
          <>
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'written' | 'uploads')}>
              <TabsList>
                <TabsTrigger value="written">1 · Written in Gio</TabsTrigger>
                <TabsTrigger value="uploads">
                  <span className="tabular-nums">2 · Uploaded ({d.docs.length})</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="font-inter text-[12px] text-text-tertiary">Both go out in one envelope, in this order. Coverage counts fields from both.</p>
          </>
        )}
        {tab === 'written' && doc && (
          <div className="flex items-center gap-2">
            {d.written.length > 1 && (
              <Select value={doc.id} onValueChange={setDocId}>
                <SelectTrigger className="h-8 w-[160px] text-[12.5px]" aria-label="Written document">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {d.written.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name || 'Untitled document'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        <span className="flex-1" />
        {tab === 'written' && doc && (
          <div ref={segRef} role="radiogroup" aria-label="Edit or preview" className="gio-seg inline-flex gap-1 rounded-[10px] bg-[#F1F0EC] p-1">
            {(['edit', 'preview'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                data-seg-option
                data-active={view === v || undefined}
                onClick={() => setView(v)}
                className="gio-pressable inline-flex items-center rounded-[7px] px-3 py-1.5 font-poppins text-[12px]"
                style={{ fontWeight: view === v ? 600 : 500, color: view === v ? '#1F2230' : '#5A6072' }}
              >
                {v === 'edit' ? 'Edit' : previewLabel}
              </button>
            ))}
            <SegmentLayer fill="#fff" shadow="0 1px 2px rgba(13,13,9,.08)" />
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'written' && doc ? (
          <WrittenPane
            d={d}
            set={set}
            doc={doc}
            preview={view === 'preview'}
            sample={sample}
            rail={{ written, active: view === 'preview' && writtenPage != null ? { kind: 'written', page: writtenPage } : null, onWritten: openWritten, onUpload: openUpload }}
            focus={focus?.kind === 'written' ? focus : null}
            onPage={setWrittenPage}
          />
        ) : hasUploads ? (
          <FieldsEditor d={d} set={set} written={written} onWritten={openWritten} focus={focus?.kind === 'upload' ? focus : null} />
        ) : null}
      </div>
    </div>
  )
}
