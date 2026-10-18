import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { loadTemplatePdf } from '@/lib/sign/pdf'
import { pagesOf, type TplDoc, type TplField } from '@/lib/sign/templates'

/**
 * The Document step's page rail (Allan, 2026-10-18), under the Summary on the
 * right of both panes, in envelope order: the document written in Gio as it
 * will print (its preview, refreshed a moment after typing stops; the last
 * pages stay up meanwhile), then each uploaded document with its fields.
 * A written page opens Preview at that page; an uploaded page opens the
 * uploaded pages there.
 */

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** A small page in the rail, with a mark for every field on it in its role's colour. */
export function PageThumb({
  doc,
  index,
  fields,
  colorOf,
  active,
  label,
  onOpen,
}: {
  doc: TplDoc
  index: number
  fields: TplField[]
  colorOf: (f: TplField) => string
  active: boolean
  label: string
  onOpen: () => void
}) {
  const box = useRef<HTMLButtonElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const size = doc.page_sizes[index] ?? { w: 612, h: 792 }

  useEffect(() => {
    const el = box.current
    if (!el) return
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null
    let done = false
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || done) return
        done = true
        io.disconnect()
        try {
          const pdf = await loadTemplatePdf(doc)
          const page = await pdf.getPage(index + 1)
          const c = canvas.current
          if (!c) return
          const base = page.getViewport({ scale: 1 })
          const vp = page.getViewport({ scale: (el.clientWidth / base.width) * Math.min(2, window.devicePixelRatio || 1) })
          c.width = Math.floor(vp.width)
          c.height = Math.floor(vp.height)
          task = page.render({ canvasContext: c.getContext('2d')!, viewport: vp }) as unknown as typeof task
          await task!.promise
          setReady(true)
        } catch {
          /* the big page shows the error */
        }
      },
      { rootMargin: '300px 0px' },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      task?.cancel()
    }
  }, [doc, index])

  return (
    <button
      ref={box}
      type="button"
      onClick={onOpen}
      aria-label={label}
      aria-current={active || undefined}
      className={cn(
        'gio-pressable gio-sign-thumb relative mx-auto block w-[164px] overflow-hidden rounded-[4px] bg-white ring-offset-2',
        active ? 'ring-2 ring-virgilio-purple' : 'ring-1 ring-[#E7E8EE] hover:ring-[#C9C8C1]',
      )}
      style={{ aspectRatio: `${size.w} / ${size.h}` }}
    >
      <canvas ref={canvas} data-ready={ready || undefined} aria-hidden className="absolute inset-0 h-full w-full" />
      {fields.map((f) => (
        <span
          key={f.id}
          aria-hidden
          className="absolute rounded-[2px]"
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            width: `${f.w}%`,
            height: `${Math.max(f.h, 2.2)}%`,
            background: colorOf(f),
            border: f.type === 'data' ? '1px dashed #8456F6' : '1px solid rgba(13,13,9,.25)',
          }}
        />
      ))}
    </button>
  )
}

export interface WrittenRail {
  name: string
  pdf: UseQueryResult<TplDoc>
}

export function PagesRail({
  written,
  docs,
  fields,
  colorOf,
  active,
  onWritten,
  onUpload,
}: {
  written: WrittenRail | null
  docs: TplDoc[]
  fields: TplField[]
  colorOf: (f: TplField) => string
  /** The page in view: a written page, or an uploaded page by its global index. */
  active: { kind: 'written' | 'upload'; page: number } | null
  onWritten: (page: number) => void
  onUpload: (gi: number) => void
}) {
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const toggle = (id: string) => (o: boolean) =>
    setClosed((s) => {
      const n = new Set(s)
      if (o) n.delete(id)
      else n.add(id)
      return n
    })
  const pages = pagesOf(docs)
  const pdf = written?.pdf
  const count = pdf?.data?.page_count ?? 0

  return (
    <>
      {written && (
        <Section
          id="written"
          title={written.name.trim() || 'Untitled document'}
          meta={pdf?.isFetching ? 'Updating…' : count ? plural(count, 'page') : pdf?.isError ? 'No preview' : 'Making the preview…'}
          open={!closed.has('written')}
          onOpenChange={toggle('written')}
        >
          {pdf?.data ? (
            Array.from({ length: count }, (_, i) => (
              <Thumb key={`${pdf.data!.id}-${i}`} n={i + 1} active={active?.kind === 'written' && active.page === i}>
                <PageThumb doc={pdf.data!} index={i} fields={[]} colorOf={colorOf} active={active?.kind === 'written' && active.page === i} label={`Preview page ${i + 1} of ${written.name.trim() || 'the written document'}`} onOpen={() => onWritten(i)} />
              </Thumb>
            ))
          ) : pdf?.isError ? (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <p className="font-inter text-[11.5px] text-text-tertiary">The preview couldn’t be made.</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => void pdf.refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <Skeleton className="mx-auto w-[164px] rounded-[4px]" style={{ aspectRatio: '612 / 792' }} />
          )}
        </Section>
      )}
      {docs.map((doc) => (
        <Section key={doc.id} id={doc.id} title={doc.name} meta={plural(doc.page_count, 'page')} open={!closed.has(doc.id)} onOpenChange={toggle(doc.id)}>
          {pages
            .filter((p) => p.doc.id === doc.id)
            .map((p) => (
              <Thumb key={p.gi} n={p.i + 1} active={active?.kind === 'upload' && active.page === p.gi}>
                <PageThumb
                  doc={doc}
                  index={p.i}
                  fields={fields.filter((f) => f.page === p.gi)}
                  colorOf={colorOf}
                  active={active?.kind === 'upload' && active.page === p.gi}
                  label={`Go to page ${p.i + 1} of ${doc.name}`}
                  onOpen={() => onUpload(p.gi)}
                />
              </Thumb>
            ))}
        </Section>
      ))}
    </>
  )
}

function Section({
  id,
  title,
  meta,
  open,
  onOpenChange,
  children,
}: {
  id: string
  title: string
  meta: string
  open: boolean
  onOpenChange: (o: boolean) => void
  children: ReactNode
}) {
  return (
    <Collapsible key={id} open={open} onOpenChange={onOpenChange} className="border-b border-virgilio-border last:border-b-0">
      <CollapsibleTrigger className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-[#FAFAF7] [&[data-state=open]>svg]:rotate-180">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-inter text-[12px] font-semibold uppercase tracking-[0.03em] text-text-primary">{title}</span>
          <span className="font-inter text-[11.5px] tabular-nums text-text-tertiary">{meta}</span>
        </span>
        <ChevronDown className="gio-disclosure-chevron mt-0.5 h-4 w-4 shrink-0 text-text-secondary" strokeWidth={2} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 px-4 pb-4">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function Thumb({ n, active, children }: { n: number; active: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {children}
      <span className={cn('text-center font-inter text-[11px] tabular-nums', active ? 'font-semibold text-text-primary' : 'text-text-tertiary')}>{n}</span>
    </div>
  )
}
