import { useEffect, useState } from 'react'
import { Check, CircleAlert } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { WizardSheet } from '@/components/ui/wizard-sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { useUserProfile } from '@/hooks/useUserProfile'
import {
  STEP,
  WIZARD_STEPS,
  draftCoverage,
  effectiveDraft,
  offerCoverage,
  saveTemplate,
  stepIssue,
  templateIssues,
  usedTags,
  useOfferForms,
  useOfferFormTags,
  type TplDraft,
} from '@/lib/sign/templates'
import { InfoStep } from './InfoStep'
import { RolesStep } from './RolesStep'
import { DocumentStep } from './DocumentStep'
import { MessageStep } from './MessageStep'
import { ReviewStep } from './ReviewStep'

// One sentence under each step's title (the order is WIZARD_STEPS).
const STEP_SUB = [
  'The name and type people see when picking a template, and the documents they sign.',
  'Who signs, in what order, and where each person comes from when the template is sent.',
  'Write the agreement or place offer fields on the uploaded pages. Each signer has their own colour.',
  'The email each person gets with their signing link, and how long the link lasts. The sender can change the email when sending.',
  'One last look. Jump back to any step to change it.',
]

// A one-off envelope (2026-11-06) uses the same steps; it's saved as a hidden, single-use General template.
const ENVELOPE_SUB: Partial<Record<number, string>> = {
  0: 'The name the signers see in their email, and the documents they sign.',
  1: 'Who signs, in what order. You type in their names and emails when you send it, or set one here.',
  4: 'One last look. Next you check who gets it and send it.',
}
const stepTitle = (i: number, envelope: boolean) =>
  envelope && i === STEP.info ? 'Envelope info' : envelope && i === STEP.review ? 'Review' : WIZARD_STEPS[i]

/** Mark the template as a one-off envelope's: never listed, archived when it's sent (admins only). */
async function markSingleUse(templateId: string) {
  const { error } = await supabase.rpc('sign_template_set_single_use', { _template_id: templateId })
  if (error) throw error
}

export type WizardMode = 'new' | 'edit' | 'duplicate' | 'envelope'

export function TemplateWizard({
  open,
  init,
  mode,
  onClose,
  onSaved,
  onEnvelopeReady,
}: {
  open: boolean
  init: TplDraft | null
  mode: WizardMode
  onClose: () => void
  /** After a successful save (the Templates page brings the card in, or flashes it). */
  onSaved?: (id: string, how: 'created' | 'saved') => void
  /** Envelope mode: the one-off is saved and ready to send (the caller opens the send sheet). */
  onEnvelopeReady?: (d: TplDraft) => void
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
  const issue = step < STEP.review ? stepIssue(step, d) : null
  // Values the linked form doesn't have: the database refuses them, so Save waits (Review lists them).
  const offForm = d.kind === 'candidate' && d.offer_form_id && formTags.data ? draftCoverage(e, formTags.data).blocking : []
  const anyIssue = issues.length > 0 || offForm.length > 0
  // Steps after Template info open once it's valid.
  const reachable = (i: number) => i === STEP.info || !stepIssue(STEP.info, d)
  const go = (i: number) => {
    if (!reachable(i)) return
    setStep(i)
    setSeen((x) => new Set(x).add(i))
  }
  const isEdit = mode === 'edit'
  const envelope = mode === 'envelope'
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
      if (envelope) {
        await markSingleUse(d.id)
        await qc.invalidateQueries({ queryKey: ['sign'] })
        setDirty(false)
        onEnvelopeReady?.(d)
        return
      }
      await qc.invalidateQueries({ queryKey: ['sign'] })
      toast.success(isEdit ? `Template saved · ${d.name.trim()}` : `Template created · ${d.name.trim()}`, {
        description: isEdit
          ? 'New envelopes use the changes. Envelopes already sent keep their own copy.'
          : d.app === 'sales'
          ? 'Sales reps can pick it on a deal in Gio Sales.'
          : 'It shows in the ATS when someone sends an agreement.',
      })
      setDirty(false)
      onSaved?.(d.id, isEdit ? 'saved' : 'created')
      onClose()
    } catch (e) {
      // The database's own checks (GSN12) say exactly what's wrong; anything else is a connection problem.
      const err = e as { code?: string; message?: string }
      setSaveError(
        (err?.code === 'GSN12' || err?.code === 'GSN17') && err.message
          ? err.message
          : envelope
          ? 'Couldn’t save the envelope. Nothing was lost; try again.'
          : 'Couldn’t save the template. Nothing was lost; try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const title = stepTitle(step, envelope)
  const eyebrow = `${envelope ? 'New envelope' : isEdit ? 'Edit template' : mode === 'duplicate' ? 'Duplicate template' : 'New template'} · step ${step + 1} of ${WIZARD_STEPS.length}`
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
  ) : step === STEP.info ? (
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
      subtitle={step === STEP.document ? documentSub(e) : (envelope && ENVELOPE_SUB[step]) || STEP_SUB[step]}
      steps={WIZARD_STEPS.map((_, i) => {
        const mine = issues.filter((x) => x.step === i)
        return {
          title: stepTitle(i, envelope),
          state: !reachable(i)
            ? 'locked'
            : i < STEP.review && mine.length && (seen.has(i) || isEdit) && i !== step
            ? 'error'
            : i < STEP.review && !mine.length && (i < step || seen.has(i + 1) || isEdit)
            ? 'done'
            : 'todo',
        }
      })}
      current={step}
      onStep={go}
      railNote={
        envelope
          ? { title: 'Sent once', body: 'It isn’t saved as a template. To reuse a document, make a General template in Sign › Templates.' }
          : isEdit
          ? { title: 'Live template', body: 'Changes apply to new envelopes only. Envelopes already sent aren’t affected.' }
          : { title: 'Not saved yet', body: 'Close any time. You’ll be asked before anything is discarded.' }
      }
      hint={hint}
      dirty={dirty}
      guard={
        envelope
          ? { title: 'Discard this envelope?', detail: 'Nothing has been sent.' }
          : isEdit
          ? { title: `Discard your changes to ${d.name.trim() || 'this template'}?`, detail: 'The saved version stays as it is.' }
          : { title: 'Discard this template?', detail: 'Nothing has been saved, so it won’t appear in Templates.' }
      }
      flush={step === STEP.document}
      wide={step === STEP.document}
      secondary={
        isEdit && step < STEP.review ? (
          <Button variant="secondary" onClick={save} disabled={anyIssue || busy}>
            Save and exit
          </Button>
        ) : undefined
      }
      primary={
        step < STEP.review
          ? { label: step === STEP.review - 1 ? (envelope ? 'Review' : 'Review & save') : 'Continue', onClick: () => go(step + 1), disabled: !!issue || busy }
          : envelope
          ? { label: 'Continue to send', onClick: save, disabled: anyIssue, loading: busy, className: 'min-w-[150px]' }
          : { label: isEdit ? 'Save changes' : 'Save template', icon: Check, onClick: save, disabled: anyIssue, loading: busy, className: 'min-w-[140px]' }
      }
    >
      {step === STEP.info && organizationId && (
        <InfoStep d={d} set={set} tenantId={organizationId} envelope={envelope} onWrite={reachable(STEP.document) ? () => go(STEP.document) : undefined} />
      )}
      {step === STEP.signers && <RolesStep d={d} set={set} me={me} />}
      {step === STEP.document && <DocumentStep d={e} set={set} />}
      {step === STEP.message && <MessageStep d={d} set={set} />}
      {step === STEP.review && <ReviewStep d={e} go={go} />}
    </WizardSheet>
  )
}

/** The Document step's sentence, by which sources the template uses (§3). */
function documentSub(e: TplDraft) {
  if (e.use_written && e.use_uploads) return STEP_SUB[STEP.document]
  // Only candidate templates have offer fields.
  const what = e.kind === 'candidate' ? 'offer fields' : 'fields'
  if (e.use_uploads) return `Drag ${what} onto the pages where the values should go, or click one to place it.`
  return `Write the agreement. Type / to add ${e.kind === 'candidate' ? 'offer fields, ' : ''}signer fields, signature blocks and conditional sections.`
}
