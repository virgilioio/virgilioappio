import { useEffect, useState } from 'react'
import { Check, ChevronDown, CircleAlert } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { WizardSheet } from '@/components/ui/wizard-sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import {
  WIZARD_STEPS,
  effectiveDraft,
  offerCoverage,
  saveTemplate,
  stepIssue,
  tagLabel,
  templateIssues,
  usedTags,
  useOfferForms,
  useOfferFormTags,
  type TplDraft,
} from '@/lib/sign/templates'
import { TagText } from './parts'
import { InfoStep } from './InfoStep'
import { RolesStep } from './RolesStep'
import { DocumentStep } from './DocumentStep'
import { MessageStep } from './MessageStep'
import { ReviewStep } from './ReviewStep'

// One sentence under each step's title (the order is WIZARD_STEPS).
const STEP_SUB = [
  'The name and type people see when picking a template, and the documents they sign.',
  'Write the agreement or place offer fields on the uploaded pages. Each signer has their own colour.',
  'Who signs, in what order, and where each person comes from when the template is sent.',
  'One last look. Jump back to any step to change it.',
]

export type WizardMode = 'new' | 'edit' | 'duplicate'

export function TemplateWizard({
  open,
  init,
  mode,
  onClose,
}: {
  open: boolean
  init: TplDraft | null
  mode: WizardMode
  onClose: () => void
}) {
  const { organizationId, user } = useAuth()
  const { profile } = useUserProfile()
  const qc = useQueryClient()
  const [d, setD] = useState<TplDraft | null>(init)
  const [step, setStep] = useState(0)
  // Steps opened so far: their problems show on the rail.
  const [seen, setSeen] = useState<Set<number>>(new Set([0]))
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (open && init) {
      setD(init)
      setStep(0)
      setSeen(new Set([0]))
      setDirty(mode === 'duplicate')
      setBusy(false)
      setSaveError(null)
    }
  }, [open, init, mode])

  const forms = useOfferForms()
  const formTags = useOfferFormTags(d?.kind === 'candidate' ? d.offer_form_id : null)
  if (!d) return null

  const set = (fn: (d: TplDraft) => TplDraft) => {
    setD((x) => (x ? fn(x) : x))
    setDirty(true)
    setSaveError(null)
  }
  // What will be saved: only the ticked sources (Template info's cards).
  const e = effectiveDraft(d)
  const issues = templateIssues(d)
  const issue = step < 3 ? stepIssue(step, d) : null
  const anyIssue = issues.length > 0
  // Steps after Template info open once it's valid.
  const reachable = (i: number) => i === 0 || !stepIssue(0, d)
  const go = (i: number) => {
    if (!reachable(i)) return
    setStep(i)
    setSeen((x) => new Set(x).add(i))
  }
  const isEdit = mode === 'edit'
  const me = {
    name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user?.email?.split('@')[0] || '',
    email: user?.email ?? '',
  }

  const save = async () => {
    if (!organizationId || busy) return
    setBusy(true)
    setSaveError(null)
    try {
      await saveTemplate(d, organizationId)
      await qc.invalidateQueries({ queryKey: ['sign'] })
      toast.success(isEdit ? `Template saved · ${d.name.trim()}` : `Template created · ${d.name.trim()}`, {
        description: isEdit
          ? 'New envelopes use the changes. Envelopes already sent keep their own copy.'
          : d.app === 'sales'
          ? 'Sales reps can pick it on a deal in Gio Sales.'
          : 'It shows in the ATS when someone sends an agreement.',
      })
      setDirty(false)
      onClose()
    } catch (e) {
      // The database's own checks (GSN12) say exactly what's wrong; anything else is a connection problem.
      const err = e as { code?: string; message?: string }
      setSaveError(err?.code === 'GSN12' && err.message ? err.message : 'Couldn’t save the template. Nothing was lost; try again.')
    } finally {
      setBusy(false)
    }
  }

  const title = WIZARD_STEPS[step]
  const eyebrow = `${isEdit ? 'Edit template' : mode === 'duplicate' ? 'Duplicate template' : 'New template'} · step ${step + 1} of ${WIZARD_STEPS.length}`
  const docs = e.docs.length + e.written.length
  const formName = forms.data?.find((f) => f.id === d.offer_form_id)?.name
  const cov = d.kind === 'candidate' && d.offer_form_id && formTags.data?.length ? offerCoverage(usedTags(e), formTags.data, d.not_needed) : null
  // The footer's status: the first that applies.
  const status = saveError ? (
    <span className="text-virgilio-error">{saveError}</span>
  ) : issue ? (
    <span className="inline-flex items-center gap-1.5 text-[#A82E23]">
      <CircleAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
      {issue}
    </span>
  ) : step === 0 ? (
    <>
      Required fields marked with <span className="text-virgilio-error">*</span>
    </>
  ) : cov ? (
    <span className="tabular-nums">
      {cov.placed.length} of {cov.total} {formName ?? 'offer form'} fields mapped
      {cov.missing.length ? ` · ${cov.missing.length} not in the document` : ''}
    </span>
  ) : (
    <span className="tabular-nums">
      {d.roles.length} role{d.roles.length === 1 ? '' : 's'} · {e.fields.length} field{e.fields.length === 1 ? '' : 's'} · {docs} document
      {docs === 1 ? '' : 's'}
    </span>
  )
  const hint = (
    <span key={typeof issue === 'string' ? issue : saveError ?? `s${step}`} className="gio-swap-in inline-block max-w-full truncate align-bottom">
      {status}
    </span>
  )

  return (
    <WizardSheet
      open={open}
      onClose={() => {
        setDirty(false)
        onClose()
      }}
      eyebrow={eyebrow}
      title={title}
      swapTitle
      titleAside={
        isEdit && d.uses > 0 ? (
          <Badge tone="neutral" size="sm">
            <span className="tabular-nums">{`Used ${d.uses}×`}</span>
          </Badge>
        ) : undefined
      }
      subtitle={step === 1 ? documentSub(e) : STEP_SUB[step]}
      steps={WIZARD_STEPS.map((t, i) => {
        const mine = issues.filter((x) => x.step === i)
        return {
          title: t,
          state: !reachable(i)
            ? 'locked'
            : i < 3 && mine.length && (seen.has(i) || isEdit) && i !== step
            ? 'error'
            : i < 3 && !mine.length && (i < step || seen.has(i + 1) || isEdit)
            ? 'done'
            : 'todo',
        }
      })}
      current={step}
      onStep={go}
      railNote={
        isEdit
          ? { title: 'Live template', body: 'Changes apply to new envelopes only. Envelopes already sent aren’t affected.' }
          : { title: 'Not saved yet', body: 'Close any time. You’ll be asked before anything is discarded.' }
      }
      hint={hint}
      dirty={dirty}
      guard={
        isEdit
          ? { title: `Discard your changes to ${d.name.trim() || 'this template'}?`, detail: 'The saved version stays as it is.' }
          : { title: 'Discard this template?', detail: 'Nothing has been saved, so it won’t appear in Templates.' }
      }
      flush={step === 1}
      wide={step === 1}
      secondary={
        isEdit && step < 3 ? (
          <Button variant="secondary" onClick={save} disabled={anyIssue || busy}>
            Save and exit
          </Button>
        ) : undefined
      }
      primary={
        step < 3
          ? { label: step === 2 ? 'Review & save' : 'Continue', onClick: () => go(step + 1), disabled: !!issue || busy }
          : { label: isEdit ? 'Save changes' : 'Save template', icon: Check, onClick: save, disabled: anyIssue, loading: busy, className: 'min-w-[140px]' }
      }
    >
      {step === 0 && organizationId && (
        <>
          <InfoStep d={d} set={set} tenantId={organizationId} onWrite={reachable(1) ? () => go(1) : undefined} />
          <DefaultEmail d={d} set={set} />
        </>
      )}
      {step === 1 && <DocumentStep d={e} set={set} />}
      {step === 2 && <RolesStep d={d} set={set} me={me} />}
      {step === 3 && <ReviewStep d={e} go={go} />}
    </WizardSheet>
  )
}

/** The Document step's sentence, by which sources the template uses (§3). */
function documentSub(e: TplDraft) {
  if (e.use_written && e.use_uploads) return STEP_SUB[1]
  if (e.use_uploads) return 'Drag offer fields onto the pages where the values should go, or click one to place it.'
  return 'Write the agreement. Type / to add offer fields, signer fields, signature blocks and conditional sections.'
}

/**
 * The email each person gets with their link, folded under Template info (the
 * Message step's content). Open when it needs attention.
 */
function DefaultEmail({ d, set }: { d: TplDraft; set: (fn: (d: TplDraft) => TplDraft) => void }) {
  const empty = !d.subject.trim() || !d.body.trim()
  const [open, setOpen] = useState(empty)
  useEffect(() => {
    if (empty) setOpen(true)
  }, [empty])
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2 max-w-[1000px] border-t border-virgilio-border pt-5">
      <CollapsibleTrigger className="flex w-full items-start gap-3 text-left [&[data-state=open]_svg.gio-disclosure-chevron]:rotate-180">
        <div className="min-w-0 flex-1">
          <p className="font-poppins text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[#1F2230]">Default email</p>
          <p className="mt-[3px] truncate font-inter text-[11.5px] text-text-tertiary">
            {d.subject.trim() ? <TagText text={d.subject} label={(k) => tagLabel(d.kind, k)} /> : 'No subject yet'} · the sender can change it when sending
          </p>
        </div>
        <ChevronDown className="gio-disclosure-chevron mt-1 h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={2} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-4">
          <MessageStep d={d} set={set} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
