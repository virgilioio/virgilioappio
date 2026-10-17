import { FilePen, FileText, LayoutTemplate, Pencil, TriangleAlert } from 'lucide-react'

import { FormSection } from '@/components/references/FormSection'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { APP_LABEL, FIELD_LABEL, KIND_LABEL, SIGNER_FIELDS, pageCount, tagLabel, templateIssues, type TplDraft } from '@/lib/sign/templates'
import { docItems, writtenKeys } from '@/lib/sign/written'
import { TagText } from './parts'

const ROLE_WORD = { signer: 'Signer', approver: 'Approver', cc: 'Gets a copy' } as const

export function ReviewStep({ d, go }: { d: TplDraft; go: (step: number) => void }) {
  const issues = templateIssues(d).map((i) => i.text)
  const pages = pageCount(d)
  const dataKeys = [...new Set([...d.fields.filter((f) => f.type === 'data').map((f) => f.data_key ?? ''), ...d.written.flatMap((w) => writtenKeys(w.content).tags)])]
  const docs = d.docs.length + d.written.length
  const edit = (i: number) => (
    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => go(i)}>
      Edit
    </Button>
  )

  return (
    <div className="max-w-[760px]">
      <div className="mb-5 flex items-start gap-3.5 rounded-xl border border-[#E7E8EE] bg-white p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F2EBFF] text-virgilio-purple">
          <LayoutTemplate className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 font-inter text-[12px] text-text-tertiary">
            <Badge tone="lilac">{KIND_LABEL[d.kind]}</Badge>
            <Badge tone={d.app === 'sales' ? 'ink' : 'purple'}>{APP_LABEL[d.app]}</Badge>
            <span>
              · {d.ordered ? 'Signs in order' : 'Signs in any order'} · reminders{' '}
              {d.reminder_days === 0 ? 'off' : `every ${d.reminder_days === 1 ? 'day' : `${d.reminder_days} days`}`} · expires after {d.expiry_days} days
            </span>
          </div>
          <h2 className="mt-1.5 line-clamp-2 font-poppins text-[20px] font-semibold tracking-[-0.03em] text-text-primary">
            {d.name || 'Untitled template'}
            <span className="text-virgilio-purple">.</span>
          </h2>
          <p className="font-inter text-[12.5px] tabular-nums text-text-secondary">
            {docs} document{docs === 1 ? '' : 's'} · {pages} page{pages === 1 ? '' : 's'}{d.written.length ? ' + written' : ''} · {d.roles.length} role{d.roles.length === 1 ? '' : 's'} · {d.fields.length} field
            {d.fields.length === 1 ? '' : 's'}
          </p>
        </div>
        {issues.length ? <Badge tone="yellow">{issues.length} to fix</Badge> : <Badge tone="green" dot>Ready</Badge>}
      </div>

      {issues.length > 0 && (
        <p className="mb-5 flex gap-2 rounded-lg bg-[#FCF1DC] p-3 font-inter text-[12.5px] leading-snug text-[#7A4A06]">
          <TriangleAlert className="mt-px h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          {issues.join(' · ')}
        </p>
      )}

      <FormSection title="Documents" action={edit(0)}>
        <ul className="flex flex-col gap-2">
          {docItems(d).map((item) =>
            item.kind === 'upload' ? (
              <li key={item.doc.id} className="flex items-center gap-2.5 font-inter text-[13px]">
                <FileText className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={2} aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{item.doc.name}</span>
                <span className="shrink-0 tabular-nums text-[12px] text-text-tertiary">
                  {item.doc.page_count} page{item.doc.page_count === 1 ? '' : 's'}
                </span>
              </li>
            ) : (
              <li key={item.doc.id} className="flex items-center gap-2.5 font-inter text-[13px]">
                <FilePen className="h-4 w-4 shrink-0 text-virgilio-purple" strokeWidth={2} aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{item.doc.name}</span>
                <span className="shrink-0 text-[12px] text-text-tertiary">Written in Gio</span>
              </li>
            ),
          )}
        </ul>
      </FormSection>

      <FormSection title={`Roles · ${d.roles.length}`} action={edit(2)}>
        <ul className="flex flex-col gap-2.5">
          {d.roles.map((r, i) => (
            <li key={r.id} className="flex items-center gap-2.5 font-inter text-[13px]">
              {d.ordered && <span className="w-4 text-center text-[12px] tabular-nums text-text-tertiary">{i + 1}</span>}
              <span aria-hidden className="h-6 w-2.5 shrink-0 rounded-[5px]" style={{ background: r.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-text-primary">{r.label}</p>
                <p className="truncate text-[11.5px] text-text-tertiary">
                  {r.fixed ? `Always ${r.name || r.email}` : 'Filled when sent'} · {ROLE_WORD[r.role]}
                </p>
              </div>
              <span className="shrink-0 tabular-nums text-[12px] text-text-tertiary">{d.fields.filter((f) => f.rid === r.id).length} field{d.fields.filter((f) => f.rid === r.id).length === 1 ? '' : 's'}</span>
            </li>
          ))}
        </ul>
      </FormSection>

      <FormSection title={`Fields · ${d.fields.length}`} action={edit(1)}>
        <dl className="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 gap-y-2 font-inter text-[12.5px]">
          {d.roles
            .filter((r) => r.role !== 'cc')
            .map((r) => {
              const counts = SIGNER_FIELDS.concat('email')
                .map((t) => [t, d.fields.filter((f) => f.rid === r.id && f.type === t).length] as const)
                .filter(([, n]) => n)
                .map(([t, n]) => `${n} ${FIELD_LABEL[t].toLowerCase()}`)
              return [
                <dt key={`${r.id}-t`} className="truncate text-text-secondary">
                  {r.label}
                </dt>,
                <dd key={`${r.id}-d`} className="text-text-primary">
                  {counts.join(', ') || 'None'}
                </dd>,
              ]
            })}
          <dt className="text-text-secondary">Data fields</dt>
          <dd className="text-text-primary">{dataKeys.length ? dataKeys.map((k) => tagLabel(d.kind, k)).join(', ') : 'None'}</dd>
        </dl>
      </FormSection>

      <FormSection title="Message" action={edit(0)}>
        <p className="font-inter text-[13px] font-medium text-text-primary">
          <TagText text={d.subject || 'No subject yet'} label={(k) => tagLabel(d.kind, k)} />
        </p>
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap font-inter text-[12.5px] leading-relaxed text-text-secondary">
          <TagText text={d.body} label={(k) => tagLabel(d.kind, k)} />
        </p>
      </FormSection>
    </div>
  )
}
