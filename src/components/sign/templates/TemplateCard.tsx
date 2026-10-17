import { useEffect, useRef, useState } from 'react'
import { Archive, ArchiveRestore, Copy, MoreHorizontal, Pencil } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { loadTemplatePdf } from '@/lib/sign/pdf'
import { ago } from '@/lib/sign/status'
import { APP_LABEL, KIND_LABEL, offerCoverage, pageCount, usedTags, useOfferFormTags, type TemplateRow, type TplDoc } from '@/lib/sign/templates'
import { docItems } from '@/lib/sign/written'

/** The first page of the first document, drawn once the card scrolls into view. */
function Thumb({ doc, accent }: { doc: TplDoc | undefined; accent: string }) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el || !doc) return
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null
    const io = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return
      io.disconnect()
      try {
        const pdf = await loadTemplatePdf(doc)
        const page = await pdf.getPage(1)
        const c = canvas.current
        if (!c) return
        const base = page.getViewport({ scale: 1 })
        const vp = page.getViewport({ scale: (120 / base.width) * Math.min(2, window.devicePixelRatio || 1) })
        c.width = Math.floor(vp.width)
        c.height = Math.floor(vp.height)
        task = page.render({ canvasContext: c.getContext('2d')!, viewport: vp }) as unknown as typeof task
        await task!.promise
        setReady(true)
      } catch {
        // The drawn placeholder stays.
      }
    })
    io.observe(el)
    return () => {
      io.disconnect()
      task?.cancel()
    }
  }, [doc])

  const size = doc?.page_sizes[0] ?? { w: 612, h: 792 }
  return (
    <div ref={box} aria-hidden className="flex h-[132px] shrink-0 items-end justify-center overflow-hidden bg-[#F1F0EC] pt-[18px]">
      <div className="relative w-[120px] overflow-hidden rounded-t bg-white shadow-[0_2px_8px_rgba(13,13,9,.08)]" style={{ aspectRatio: `${size.w} / ${size.h}` }}>
        <div className="absolute inset-0 flex flex-col gap-[5px] px-3 py-3.5">
          <i className="mb-[3px] block h-[5px] w-3/5 rounded-sm bg-[#C9C8C1]" />
          <i className="block h-[3px] rounded-sm bg-[#E4E3DD]" />
          <i className="block h-[3px] w-[90%] rounded-sm bg-[#E4E3DD]" />
          <i className="block h-[3px] rounded-sm bg-[#E4E3DD]" />
          <i className="block h-[3px] w-[70%] rounded-sm bg-[#E4E3DD]" />
          <i className="mt-6 block h-2 w-[44%] rounded-[3px]" style={{ background: accent }} />
        </div>
        <canvas ref={canvas} className="absolute inset-0 h-full w-full bg-white transition-opacity duration-200" style={{ opacity: ready ? 1 : 0 }} />
      </div>
    </div>
  )
}

/** How many of the linked offer form's fields the template places (offer templates only). */
function OfferCoverageLine({ t }: { t: TemplateRow }) {
  const tags = useOfferFormTags(t.kind === 'candidate' ? t.offer_form_id : null)
  if (!t.offer_form_id || !tags.data?.length) return null
  const c = offerCoverage(usedTags(t), tags.data, t.not_needed)
  return (
    <p className={c.missing.length ? 'font-inter text-[12px] text-[#7A4A06]' : 'font-inter text-[12px] text-text-tertiary'}>
      <span className="tabular-nums">
        {c.placed.length} of {c.total}
      </span>{' '}
      offer fields placed
    </p>
  )
}

const edited = (iso: string) => {
  const a = ago(iso)
  return /^(Just now|Yesterday)$/.test(a) ? a.toLowerCase() : a
}

export function TemplateCard({
  t,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
}: {
  t: TemplateRow
  onEdit: () => void
  onDuplicate: () => void
  onArchive: () => void
  onRestore: () => void
}) {
  const archived = !!t.archived_at
  const pages = pageCount(t)
  const first = docItems(t)[0]
  const docs = t.docs.length + t.written.length
  return (
    <article className="flex flex-col overflow-hidden rounded-[14px] border border-[#E7E8EE] bg-white" data-row-id={t.id}>
      <Thumb doc={first?.kind === 'upload' ? first.doc : undefined} accent={t.roles[0]?.color ?? '#E4E3DD'} />
      <div className="flex flex-1 flex-col gap-1.5 px-3.5 pb-3.5 pt-3">
        <div className="flex items-center gap-1.5">
          <Badge tone="lilac" size="xs">
            {KIND_LABEL[t.kind]}
          </Badge>
          <Badge tone={t.app === 'sales' ? 'ink' : 'purple'} size="xs">
            {APP_LABEL[t.app]}
          </Badge>
          {archived && (
            <Badge tone="neutral" size="xs">
              Archived
            </Badge>
          )}
          <span className="flex-1" />
          <DropdownMenu>
            <IconTip label="Actions">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="xs" iconOnly aria-label={`Actions for ${t.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
            </IconTip>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              {!archived && (
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit template
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-3.5 w-3.5" aria-hidden /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {archived ? (
                <DropdownMenuItem onClick={onRestore}>
                  <ArchiveRestore className="h-3.5 w-3.5" aria-hidden /> Restore template
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="h-3.5 w-3.5" aria-hidden /> Archive template
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <h3 className="line-clamp-2 font-poppins text-[14px] font-semibold leading-snug tracking-[-0.01em] text-text-primary">{t.name}</h3>
        <p className="flex flex-wrap gap-x-2.5 gap-y-0.5 font-inter text-[12px] text-text-tertiary">
          <span className="whitespace-nowrap tabular-nums">
            {docs} doc{docs === 1 ? '' : 's'}
            {pages > 0 && ` · ${pages} page${pages === 1 ? '' : 's'}`}
            {t.written.length > 0 && ` · ${t.written.length} written`}
          </span>
          <span className="min-w-0 truncate">{t.roles.map((r) => r.label).join(' → ')}</span>
        </p>
        <p className="flex flex-wrap gap-x-2.5 gap-y-0.5 font-inter text-[12px] tabular-nums text-text-tertiary">
          <span className="whitespace-nowrap">{t.fields.length} field{t.fields.length === 1 ? "" : "s"}</span>
          <span className="whitespace-nowrap">Sent {t.uses}×</span>
          <span className="whitespace-nowrap">Edited {edited(t.updated_at)}</span>
        </p>
        <OfferCoverageLine t={t} />
        <div className="mt-auto flex gap-1.5 pt-2">
          {archived ? (
            <Button variant="secondary" size="sm" icon={ArchiveRestore} onClick={onRestore}>
              Restore
            </Button>
          ) : (
            <Button variant="secondary" size="sm" icon={Pencil} onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
