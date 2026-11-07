import { useState, useRef, useEffect, useCallback } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMailIdentities } from '@/hooks/useMailIdentities'
import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'
import { toast } from 'sonner'
import {
  SubjectTemplateEditor,
  BodyTemplateEditor,
  VariableMenu,
  TemplatePreview,
  PreviewToggle,
  type SubjectTemplateEditorHandle,
  type BodyTemplateEditorHandle,
} from '@/components/editors'
import { CONFIRMATION_VARIABLES } from '@/lib/automations'
import { SpecCard } from '../shared/SpecCard'

const DEFAULT_SUBJECT = 'Thank you for applying to {{job.title}} at {{organization.name}}'
const DEFAULT_BODY = `Hi {{candidate.first_name}},\n\nThank you for applying to the {{job.title}} position at {{organization.name}}. We've received your application and our team will review it shortly.\n\nWe'll be in touch if your qualifications match our requirements.\n\nBest regards,\nThe {{organization.name}} Team`

/**
 * "When someone applies" (Allan, 2026-10-19; it was the only automation in
 * Settings › Automations): the email each candidate gets after applying on the
 * careers page. It's the workspace's `application_confirmation_email` row in
 * `workspace_automations`, sent by public-submit-application. Everything else
 * that happens on its own lives in each job's stage automations.
 */
export function ApplyConfirmationCard() {
  const { automation, isLoading, isSaving, save, toggle } = useWorkspaceAutomation('application_confirmation_email')
  const { identities, isLoading: identitiesLoading } = useMailIdentities()

  const [enabled, setEnabled] = useState(false)
  const [subject, setSubject] = useState(DEFAULT_SUBJECT)
  const [body, setBody] = useState(DEFAULT_BODY)
  const [fromEmail, setFromEmail] = useState('')
  const [dirty, setDirty] = useState(false)
  const [preview, setPreview] = useState(false)

  const subjectRef = useRef<SubjectTemplateEditorHandle>(null)
  const bodyRef = useRef<BodyTemplateEditorHandle>(null)

  useEffect(() => {
    if (automation) {
      setEnabled(automation.is_active)
      setSubject(automation.subject || DEFAULT_SUBJECT)
      setBody(automation.body || DEFAULT_BODY)
      setFromEmail(automation.from_email || '')
      setDirty(false)
    }
  }, [automation])

  useEffect(() => {
    if (!fromEmail && identities.length > 0 && !automation?.from_email) {
      setFromEmail(identities[0].email_address)
    }
  }, [identities, fromEmail, automation])

  const handleToggle = async (checked: boolean) => {
    if (checked && !fromEmail) {
      toast.error('Choose who it comes from first.')
      return
    }
    setEnabled(checked)
    try {
      await toggle(checked)
      toast.success(checked ? 'Confirmation email on' : 'Confirmation email off')
    } catch {
      setEnabled(!checked)
    }
  }

  const handleSave = async () => {
    if (!fromEmail) {
      toast.error('Choose who it comes from first.')
      return
    }
    try {
      await save({ subject, body, from_email: fromEmail })
      setDirty(false)
      toast.success('Confirmation email saved')
    } catch {
      // useWorkspaceAutomation shows the error
    }
  }

  const markDirty = useCallback(() => setDirty(true), [])

  return (
    <SpecCard
      title="When someone applies"
      description="An email to each candidate who applies through your careers page, sent straight away."
      action={isLoading ? undefined : <Switch checked={enabled} onCheckedChange={handleToggle} aria-label="Send a confirmation email" />}
    >
      {isLoading ? (
        <div className="flex flex-col gap-3" style={{ padding: '14px 18px' }}>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-[140px] w-full" />
        </div>
      ) : (
        <>
          <div className={`flex flex-col gap-3 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`} style={{ padding: '14px 18px' }}>
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[#5A6072]" style={{ fontSize: 11.5, fontWeight: 600 }}>From</label>
              {identitiesLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : identities.length === 0 ? (
                <div className="font-inter text-[#6B7080]" style={{ fontSize: 12 }}>
                  No mailbox connected. Connect Google on My profile first.
                </div>
              ) : (
                <Select value={fromEmail} onValueChange={(v) => { setFromEmail(v); markDirty() }}>
                  <SelectTrigger><SelectValue placeholder="Choose who it comes from…" /></SelectTrigger>
                  <SelectContent>
                    {identities.map((i) => (
                      <SelectItem key={i.id} value={i.email_address}>
                        {i.display_name ? `${i.display_name} (${i.email_address})` : i.email_address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="confirmation-subject" className="font-inter text-[#5A6072]" style={{ fontSize: 11.5, fontWeight: 600 }}>Subject</label>
                <VariableMenu variant="subject" variables={CONFIRMATION_VARIABLES} onInsert={(k) => subjectRef.current?.insertPlaceholder(k)} />
              </div>
              <SubjectTemplateEditor
                ref={subjectRef}
                id="confirmation-subject"
                variables={CONFIRMATION_VARIABLES}
                value={subject}
                onChange={(v) => { setSubject(v); markDirty() }}
                placeholder="Enter email subject…"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[#5A6072]" style={{ fontSize: 11.5, fontWeight: 600 }}>Body</label>
              {preview ? (
                <>
                  <div className="flex items-center justify-end">
                    <PreviewToggle preview onToggle={() => setPreview(false)} />
                  </div>
                  <TemplatePreview subject={subject} body={body} keys={CONFIRMATION_VARIABLES.map((v) => v.key)} minHeight={140} />
                </>
              ) : (
                <BodyTemplateEditor
                  ref={bodyRef}
                  variables={CONFIRMATION_VARIABLES}
                  value={body}
                  onChange={(v) => { setBody(v); markDirty() }}
                  ariaLabel="Confirmation email body"
                  toolbarExtra={
                    <>
                      <VariableMenu variant="toolbar" variables={CONFIRMATION_VARIABLES} onInsert={(k) => bodyRef.current?.insertPlaceholder(k)} />
                      <div className="flex-1" />
                      <PreviewToggle preview={false} onToggle={() => setPreview(true)} />
                    </>
                  }
                />
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #F1F0EC', padding: '10px 18px' }} className="flex justify-end">
            <Button size="sm" onClick={() => void handleSave()} disabled={!dirty} loading={isSaving}>
              Save changes
            </Button>
          </div>
        </>
      )}
    </SpecCard>
  )
}
