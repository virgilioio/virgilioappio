import { ArrowRight, CircleCheck, FilePen, Files, FileUp, Pencil, TriangleAlert } from 'lucide-react'

import { FormSection } from '@/components/references/FormSection'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ROLE_SOURCES,
  STEP,
  WIZARD_STEPS,
  draftCoverage,
  listLabels,
  roleSource,
  tagLabel,
  templateIssues,
  useOfferForms,
  useOfferFormTags,
  type TplDraft,
} from '@/lib/sign/templates'
import { CoverageCard } from './FieldList'
import { TagText } from './parts'

const ROLE_DOES = { signer: 'Signs', approver: 'Approves', cc: 'Gets a copy' } as const

/**
 * Review & save (§5, 2026-10-17): a noir summary of the template, what's
 * left to fix (each with Go to), the offer form coverage, the roles and the
 * default email. Fields missing from the document never block saving.
 */
export function ReviewStep({ d, go }: { d: TplDraft; go: (step: number) => void }) {
  const forms = useOfferForms()
  const linked = d.kind === 'candidate' && !!d.offer_form_id
  const formTags = useOfferFormTags(linked ? d.offer_form_id : null)
  const formName = forms.data?.find((f) => f.id === d.offer_form_id)?.name ?? 'linked'
  const cov = linked && formTags.data ? draftCoverage(d, formTags.data) : null
  const issues = [
    ...templateIssues(d).map((i) => ({ step: i.step as number, text: i.text })),
    ...(cov?.blocking.length
      ? [{ step: STEP.document as number, text: `${listLabels(cov.blocking.map((k) => tagLabel(d.kind, k)), 3)} ${cov.blocking.length === 1 ? 'isn’t' : 'aren’t'} in the ${formName} form` }]
      : []),
  ]

  const hasWritten = d.written.length > 0
  const Icon = hasWritten && d.docs.length ? Files : hasWritten ? FilePen : FileUp
  const source = hasWritten && d.docs.length ? `Written in Gio + ${d.docs.length} uploaded` : hasWritten ? 'Written in Gio' : 'Uploaded'
  const docs = d.docs.length + d.written.length
  const offerFields = cov ? cov.mapped.length : 0
  const edit = (label: string, step: number) => (
    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => go(step)}>
      {label}
    </Button>
  )

  return (
    <div className="max-w-[760px]">
      {/* The hero: noir, the template's name with a lilac full stop. */}
      <div className="mb-5 flex items-start gap-4 rounded-2xl bg-[#0d0d09] p-5 text-[#FFFCF9]">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#D7C5FB]">
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-inter text-[11px] font-semibold uppercase tracking-[0.08em] text-[#B5B9C4]">
            {linked ? formName : d.kind === 'candidate' ? 'Any candidate' : d.kind === 'member' ? 'Team member' : 'Customer'} · {source}
          </p>
          <h2 className="mt-1 line-clamp-2 font-poppins text-[22px] font-semibold leading-tight tracking-[-0.03em]">
            {d.name.trim() || 'Untitled template'}
            <span className="text-[#D7C5FB]">.</span>
          </h2>
          <p className="mt-1 font-inter text-[12.5px] tabular-nums text-[#B5B9C4]">
            {docs} document{docs === 1 ? '' : 's'} · {d.roles.length} role{d.roles.length === 1 ? '' : 's'}
            {linked ? ` · ${offerFields} offer field${offerFields === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        {issues.length ? (
          <Badge tone="yellow">
            <span className="tabular-nums">{issues.length} to fix</span>
          </Badge>
        ) : (
          <Badge tone="green" dot>
            Ready
          </Badge>
        )}
      </div>

      {issues.length > 0 && (
        <div className="gio-send-note mb-5 flex-col gap-1.5" data-tone="warn" role="status">
          {issues.map((i) => (
            <p key={i.text} className="flex items-start gap-2">
              <TriangleAlert className="mt-[3px] h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span className="min-w-0 flex-1">{i.text}</span>
              <button type="button" className="gio-pressable inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 font-medium underline-offset-2 hover:underline" onClick={() => go(i.step)}>
                Go to {WIZARD_STEPS[i.step]}
                <ArrowRight className="h-3 w-3" strokeWidth={2.2} aria-hidden />
              </button>
            </p>
          ))}
        </div>
      )}

      {cov && (
        <FormSection title="Offer form coverage" action={edit('Edit document', STEP.document)}>
          <div className="flex flex-col gap-3">
            <CoverageCard placed={cov.mapped.length} total={cov.total} missing={cov.missing.length} />
            {cov.missing.length > 0 && (
              <p className="font-inter text-[12.5px] leading-snug text-text-secondary">
                <span className="font-medium text-text-primary">Not in the document:</span> {cov.missing.map((t) => t.label).join(', ')}. Recruiters will see this flag.
              </p>
            )}
            {cov.skipped.length > 0 && (
              <p className="font-inter text-[12.5px] leading-snug text-text-tertiary">
                <span className="font-medium text-text-secondary">Marked not needed:</span> {cov.skipped.map((t) => t.label).join(', ')}.
              </p>
            )}
          </div>
        </FormSection>
      )}

      <FormSection title={`Roles · ${d.roles.length}`} action={edit('Edit signers', STEP.signers)}>
        <ul className="flex flex-col gap-2.5">
          {d.roles.map((r, i) => {
            const src = ROLE_SOURCES[d.kind].find((s) => s.value === roleSource(d, r))?.label ?? 'Typed in when sending'
            return (
              <li key={r.id} className="flex items-center gap-2.5 font-inter text-[13px]">
                <span className={cn('w-4 text-center text-[12px] tabular-nums text-text-tertiary', !d.ordered && 'invisible')}>{i + 1}</span>
                <span aria-hidden className="h-6 w-2.5 shrink-0 rounded-[5px]" style={{ background: r.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text-primary">{r.label || 'Unnamed role'}</p>
                  <p className="truncate text-[11.5px] text-text-tertiary">
                    {r.fixed && (r.name || r.email) ? `Always ${r.name || r.email}` : src} · {ROLE_DOES[r.role]}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </FormSection>

      <FormSection title="Default email" action={edit('Edit email', STEP.info)}>
        <p className="font-inter text-[13px] font-medium text-text-primary">
          <TagText text={d.subject || 'No subject yet'} label={(k) => tagLabel(d.kind, k)} />
        </p>
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap font-inter text-[12.5px] leading-relaxed text-text-secondary">
          <TagText text={d.body} label={(k) => tagLabel(d.kind, k)} />
        </p>
      </FormSection>

      {!issues.length && (
        <p className="flex items-center gap-1.5 font-inter text-[12px] text-text-tertiary">
          <CircleCheck className="h-3.5 w-3.5 text-[#16704A]" strokeWidth={2} aria-hidden />
          Saving changes the template for new envelopes only. Envelopes already sent keep their own copy.
        </p>
      )}
    </div>
  )
}
