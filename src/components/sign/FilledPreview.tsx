import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { Skeleton } from '@/components/ui/skeleton'
import { PdfPage, edge, tint } from '@/components/sign/PdfPage'
import { FIELD_LABEL, TEXT_FIELDS, autoFontSize, pagesOf, type TplDoc, type TplField, type TplRole } from '@/lib/sign/templates'
import { DataFieldText } from '@/components/sign/DataFieldText'
import { docItems, useWrittenPreview, type TplWritten } from '@/lib/sign/written'

/**
 * What a template looks like filled in with a record's values: every page,
 * in order, with data fields showing the words that will be printed and
 * signer fields marked in their role's colour (2026-10-17). The same
 * positions and text sizes the sealed PDF uses (_shared/sign/stamp.ts), so
 * what the sender sees is what goes out.
 */

interface PreviewTemplate {
  docs: TplDoc[]
  written: TplWritten[]
  roles: TplRole[]
  fields: TplField[]
}

const SELECT = `
  id,
  docs:sign_documents!sign_documents_template_id_fkey(id, name, storage_path, page_count, page_sizes, size_bytes, sha256, position, removed_at),
  roles:sign_recipients!sign_recipients_template_id_fkey(id, label, role, fixed, name, email, color, position, removed_at),
  fields:sign_fields!sign_fields_template_id_fkey(id, type, recipient_id, page, x, y, w, h, required, data_key, font_size, data_style, removed_at),
  written:sign_written_docs!sign_written_docs_template_id_fkey(id, name, position, content, removed_at)
`

export function usePreviewTemplate(templateId: string | null) {
  return useQuery({
    queryKey: ['sign', 'preview-template', templateId],
    enabled: !!templateId,
    staleTime: 30_000,
    queryFn: async (): Promise<PreviewTemplate> => {
      const { data, error } = await supabase.from('sign_templates').select(SELECT).eq('id', templateId!).single()
      if (error) throw error
      type Raw = {
        docs: (TplDoc & { position: number; removed_at: string | null })[]
        written: (TplWritten & { removed_at: string | null })[] | null
        roles: { id: string; label: string | null; role: TplRole['role']; fixed: boolean; name: string | null; email: string | null; color: string; position: number; removed_at: string | null }[]
        fields: { id: string; type: TplField['type']; recipient_id: string | null; page: number; x: number | string; y: number | string; w: number | string; h: number | string; required: boolean; data_key: string | null; font_size: number | string | null; data_style: string | null; removed_at: string | null }[]
      }
      const t = data as unknown as Raw
      return {
        docs: (t.docs ?? [])
          .filter((x) => !x.removed_at)
          .sort((a, b) => a.position - b.position)
          .map(({ removed_at: _r, ...x }) => ({ ...x, page_sizes: Array.isArray(x.page_sizes) ? x.page_sizes : [] })),
        written: (t.written ?? []).filter((x) => !x.removed_at).map(({ removed_at: _r, ...x }) => x),
        roles: (t.roles ?? [])
          .filter((x) => !x.removed_at)
          .sort((a, b) => a.position - b.position)
          .map((r) => ({ id: r.id, label: r.label ?? '', role: r.role, fixed: r.fixed, name: r.name ?? '', email: r.email ?? '', color: r.color })),
        fields: (t.fields ?? [])
          .filter((x) => !x.removed_at)
          .map((f) => ({
            id: f.id,
            type: f.type,
            rid: f.recipient_id,
            page: f.page,
            x: Number(f.x),
            y: Number(f.y),
            w: Number(f.w),
            h: Number(f.h),
            required: f.required,
            data_key: f.data_key,
            font_size: f.font_size == null ? null : Number(f.font_size),
            data_style: f.data_style === 'tick' ? ('tick' as const) : null,
          })),
      }
    },
  })
}

export function FilledPreview({
  templateId,
  values,
  people,
  width = 480,
  highlight,
}: {
  templateId: string | null
  /** Data values by key (the send preview's values). */
  values: Record<string, string | null | undefined>
  /** Names typed for each role, to label signer fields ("Priya signs here"). */
  people?: Record<string, { name: string }>
  width?: number
  /**
   * The send sheet's Preview (2026-10-17): labels by key. Values get a lilac
   * underline, empty ones show [Label], signer fields read "{Role} signs here".
   */
  highlight?: Record<string, string>
}) {
  const tpl = usePreviewTemplate(templateId)
  const pages = useMemo(() => (tpl.data ? pagesOf(tpl.data.docs) : []), [tpl.data])
  const role = (id: string | null) => tpl.data?.roles.find((r) => r.id === id) ?? null

  if (!templateId) return null
  if (tpl.isLoading) {
    return (
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="rounded-md" style={{ width, aspectRatio: '612 / 792' }} />
      </div>
    )
  }
  if (tpl.isError || !tpl.data) {
    return <p className="font-inter text-[12.5px] text-virgilio-error">The documents couldn’t be loaded for the preview.</p>
  }

  const roleLabels = Object.fromEntries(tpl.data.roles.map((r) => [r.id, r.label || 'Signer']))
  return (
    <div className="flex flex-col items-center gap-4" aria-label="Preview of the documents, filled in">
      {docItems(tpl.data).flatMap((item) =>
        item.kind === 'written'
          ? [<WrittenPages key={item.doc.id} w={item.doc} values={values} roles={roleLabels} width={width} highlight={highlight} />]
          : pages.filter((p) => p.doc.id === item.doc.id).map((p) => {
              const size = p.doc.page_sizes[p.i] ?? { w: 612, h: 792 }
              return (
                <div key={`${p.doc.id}-${p.i}`} className="flex flex-col" style={{ width }}>
                  <PdfPage doc={p.doc} index={p.i} width={width}>
                    {tpl.data!.fields
                      .filter((f) => f.page === p.gi)
                      .map((f) => {
                        const r = role(f.rid)
                        const isData = f.type === 'data'
                        const text = isData ? values[f.data_key ?? ''] ?? '' : ''
                        const size_pt = f.font_size ?? autoFontSize(f.h, size.h)
                        const who = r ? people?.[r.id]?.name?.trim() || r.name || r.label : ''
                        return (
                          <div
                            key={f.id}
                            className="gio-sign-field"
                            data-type={f.type}
                            data-preview
                            style={{
                              left: `${f.x}%`,
                              top: `${f.y}%`,
                              width: `${f.w}%`,
                              height: `${f.h}%`,
                              background: isData ? 'transparent' : tint(r?.color ?? '#ffffff', 0.28),
                              borderColor: isData ? 'transparent' : edge(r?.color ?? '#9CA3AF'),
                              color: isData ? '#0d0d09' : undefined,
                              ...(TEXT_FIELDS.has(f.type) ? { fontSize: `${(size_pt / (size.w || 612)) * 100}cqw` } : {}),
                            }}
                            title={isData ? undefined : `${who} · ${FIELD_LABEL[f.type]}`}
                          >
                            {isData ? (
                              <DataFieldText
                                value={text}
                                tick={f.data_style === 'tick'}
                                w={f.w}
                                h={f.h}
                                page={size}
                                fontSize={f.font_size}
                                empty={highlight ? `[${highlight[f.data_key ?? ''] ?? f.data_key ?? ''}]` : '—'}
                                mark={!!highlight}
                              />
                            ) : highlight && f.type === 'signature' ? (
                              <span className="truncate">{`${r?.label || 'Signer'} signs here`}</span>
                            ) : (
                              <span className="truncate">{`${who} · ${FIELD_LABEL[f.type].toLowerCase()}`}</span>
                            )}
                          </div>
                        )
                      })}
                  </PdfPage>
                  <p className="mt-1.5 flex justify-between font-inter text-[11px] text-text-tertiary">
                    <span className="truncate">{p.doc.name}</span>
                    <span className="tabular-nums">
                      {p.i + 1} / {p.doc.page_count}
                    </span>
                  </p>
                </div>
              )
            }),
      )}
    </div>
  )
}

/** A written document, made into its PDF with this record's values (the same code that sends it). */
function WrittenPages({
  w,
  values,
  roles,
  width,
  highlight,
}: {
  w: TplWritten
  values: Record<string, string | null | undefined>
  roles: Record<string, string>
  width: number
  highlight?: Record<string, string>
}) {
  const preview = useWrittenPreview({ name: w.name, content: w.content, values, roles, ...(highlight ? { highlight } : null) })
  if (preview.isLoading) return <Skeleton className="rounded-md" style={{ width, aspectRatio: '612 / 792' }} />
  if (preview.isError || !preview.data) {
    return <p className="font-inter text-[12.5px] text-virgilio-error">{w.name} couldn’t be drawn for the preview.</p>
  }
  const doc = preview.data
  return (
    <>
      {Array.from({ length: doc.page_count }, (_, i) => (
        <div key={`${w.id}-${i}`} className="flex flex-col" style={{ width }}>
          <PdfPage doc={doc} index={i} width={width} />
          <p className="mt-1.5 flex justify-between font-inter text-[11px] text-text-tertiary">
            <span className="truncate">{w.name}</span>
            <span className="tabular-nums">
              {i + 1} / {doc.page_count}
            </span>
          </p>
        </div>
      ))}
    </>
  )
}
