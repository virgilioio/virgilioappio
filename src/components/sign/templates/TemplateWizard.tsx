import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { WizardSheet } from '@/components/ui/wizard-sheet'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { saveTemplate, stepIssue, type TplDraft } from '@/lib/sign/templates'
import { InfoStep } from './InfoStep'
import { RolesStep } from './RolesStep'
import { FieldsEditor } from './FieldsEditor'
import { MessageStep } from './MessageStep'
import { ReviewStep } from './ReviewStep'

const STEPS: [string, string][] = [
  ['Template info', 'Name, type, where it’s used and the PDFs people will sign.'],
  ['Roles', 'Who signs, in what order. Roles become people when the template is used.'],
  ['Fields', 'Drag signer and data fields onto the pages. Each role has its own colour.'],
  ['Message', 'The email people get, with data tags that fill in from the record.'],
  ['Review & save', 'One last look. Jump back to any step to change it.'],
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
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (open && init) {
      setD(init)
      setStep(0)
      setDirty(mode === 'duplicate')
      setBusy(false)
      setSaveError(null)
    }
  }, [open, init, mode])

  if (!d) return null

  const set = (fn: (d: TplDraft) => TplDraft) => {
    setD((x) => (x ? fn(x) : x))
    setDirty(true)
    setSaveError(null)
  }
  const issue = step < 4 ? stepIssue(step, d) : null
  const anyIssue = [0, 1, 2, 3].some((i) => stepIssue(i, d))
  const reachable = (i: number) => [...Array(i).keys()].every((k) => !stepIssue(k, d))
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
      toast.success(isEdit ? `${d.name.trim()} saved` : `${d.name.trim()} is ready to use`, {
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

  const [title, sub] = STEPS[step]
  const eyebrow = `${isEdit ? 'Edit template' : mode === 'duplicate' ? 'Duplicate template' : 'New template'} · step ${step + 1} of ${STEPS.length}`
  const hint = saveError ? (
    <span className="text-virgilio-error">{saveError}</span>
  ) : issue ? (
    issue
  ) : step === 0 ? (
    <>
      Required fields are marked with <span className="text-virgilio-error">*</span>
    </>
  ) : (
    <span className="tabular-nums">
      <span className="font-medium text-text-primary">
        {d.roles.length} role{d.roles.length === 1 ? '' : 's'}
      </span>{' '}
      · {d.fields.length} field{d.fields.length === 1 ? '' : 's'} · {d.docs.length} document{d.docs.length === 1 ? '' : 's'}
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
      subtitle={sub}
      steps={STEPS.map(([t], i) => ({
        title: t,
        state: !reachable(i) ? 'locked' : i < 4 && !stepIssue(i, d) && (i < step || isEdit) ? 'done' : 'todo',
      }))}
      current={step}
      onStep={(i) => reachable(i) && setStep(i)}
      railNote={
        isEdit
          ? { title: 'Live template', body: 'Changes apply to new envelopes only. Envelopes already sent keep their own copy.' }
          : { title: 'Not saved yet', body: 'Close any time; you’ll be asked before anything is discarded. Uploaded PDFs stay private.' }
      }
      hint={hint}
      dirty={dirty}
      flush={step === 2}
      wide={step === 2}
      secondary={
        isEdit && step < 4 ? (
          <Button variant="secondary" onClick={save} disabled={anyIssue || busy}>
            Save and exit
          </Button>
        ) : undefined
      }
      primary={
        step < 4
          ? { label: step === 3 ? 'Review' : 'Continue', onClick: () => setStep(step + 1), disabled: !!issue || busy }
          : { label: isEdit ? 'Save changes' : 'Save template', icon: Check, onClick: save, disabled: anyIssue, loading: busy }
      }
    >
      {step === 0 && organizationId && <InfoStep d={d} set={set} tenantId={organizationId} />}
      {step === 1 && <RolesStep d={d} set={set} me={me} />}
      {step === 2 && <FieldsEditor d={d} set={set} />}
      {step === 3 && <MessageStep d={d} set={set} />}
      {step === 4 && <ReviewStep d={d} go={(i) => reachable(i) && setStep(i)} />}
    </WizardSheet>
  )
}
