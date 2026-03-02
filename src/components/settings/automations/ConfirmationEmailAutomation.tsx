import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Mail, Info, Save, Loader2 } from 'lucide-react'
import { PlaceholderHelper } from '@/components/settings/PlaceholderHelper'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMailIdentities } from '@/hooks/useMailIdentities'
import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'
import { toast } from 'sonner'
import {
  SubjectTemplateEditor,
  BodyTemplateEditor,
  type SubjectTemplateEditorHandle,
  type BodyTemplateEditorHandle
} from '@/components/editors'

const DEFAULT_SUBJECT = 'Thank you for applying to {{job.title}} at {{organization.name}}'
const DEFAULT_BODY = `Hi {{candidate.first_name}},\n\nThank you for applying to the {{job.title}} position at {{organization.name}}. We've received your application and our team will review it shortly.\n\nWe'll be in touch if your qualifications match our requirements.\n\nBest regards,\nThe {{organization.name}} Team`

export function ConfirmationEmailAutomation() {
  const { automation, isLoading, isSaving, save, toggle } = useWorkspaceAutomation('application_confirmation_email')
  const { identities, isLoading: identitiesLoading } = useMailIdentities()

  const [enabled, setEnabled] = useState(false)
  const [subject, setSubject] = useState(DEFAULT_SUBJECT)
  const [body, setBody] = useState(DEFAULT_BODY)
  const [fromEmail, setFromEmail] = useState('')
  const [lastFocusedField, setLastFocusedField] = useState<'subject' | 'body'>('body')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const subjectRef = useRef<SubjectTemplateEditorHandle>(null)
  const bodyRef = useRef<BodyTemplateEditorHandle>(null)

  // Sync state from DB when automation loads
  useEffect(() => {
    if (automation) {
      setEnabled(automation.is_active)
      setSubject(automation.subject || DEFAULT_SUBJECT)
      setBody(automation.body || DEFAULT_BODY)
      setFromEmail(automation.from_email || '')
      setHasUnsavedChanges(false)
    }
  }, [automation])

  // Auto-select first identity if none chosen
  useEffect(() => {
    if (!fromEmail && identities.length > 0 && !automation?.from_email) {
      setFromEmail(identities[0].email_address)
    }
  }, [identities, fromEmail, automation])

  const handleToggle = async (checked: boolean) => {
    if (checked && !fromEmail) {
      toast.error('Please select a "From" email address first')
      return
    }
    setEnabled(checked)
    try {
      await toggle(checked)
      toast.success(checked ? 'Automation enabled' : 'Automation disabled')
    } catch {
      setEnabled(!checked) // revert on error
    }
  }

  const handleSave = async () => {
    if (!fromEmail) {
      toast.error('Please select a "From" email address')
      return
    }
    await save({ subject, body, from_email: fromEmail })
    setHasUnsavedChanges(false)
    toast.success('Automation settings saved')
  }

  const markDirty = useCallback(() => setHasUnsavedChanges(true), [])

  const handleSubjectChange = (val: string) => { setSubject(val); markDirty() }
  const handleBodyChange = (val: string) => { setBody(val); markDirty() }
  const handleFromEmailChange = (val: string) => { setFromEmail(val); markDirty() }

  const handleInsertPlaceholder = (placeholder: string) => {
    if (lastFocusedField === 'subject') {
      subjectRef.current?.insertPlaceholder(placeholder)
    } else {
      bodyRef.current?.insertPlaceholder(placeholder)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Application Confirmation Email</CardTitle>
                  <CardDescription>
                    Automatically send a confirmation email when candidates submit an application
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={handleToggle}
              />
            </div>
          </CardHeader>

          <CardContent className={`space-y-6 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* From Email Selector */}
            <div className="space-y-2">
              <Label>From Email</Label>
              {identitiesLoading ? (
                <div className="text-sm text-muted-foreground">Loading connected accounts...</div>
              ) : identities.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No email accounts connected. Please connect a Gmail account in Settings → Email to use this automation.
                </div>
              ) : (
                <Select value={fromEmail} onValueChange={handleFromEmailChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sender email..." />
                  </SelectTrigger>
                  <SelectContent>
                    {identities.map((identity) => (
                      <SelectItem key={identity.id} value={identity.email_address}>
                        {identity.display_name ? `${identity.display_name} (${identity.email_address})` : identity.email_address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <SubjectTemplateEditor
                ref={subjectRef}
                value={subject}
                onChange={handleSubjectChange}
                placeholder="Enter email subject..."
                onFocus={() => setLastFocusedField('subject')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Email Body</Label>
              <BodyTemplateEditor
                ref={bodyRef}
                value={body}
                onChange={handleBodyChange}
                onFocus={() => setLastFocusedField('body')}
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={!hasUnsavedChanges || isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Workspace Default</p>
                <p className="text-sm text-muted-foreground">
                  This template will be used as the default for all new job postings. Individual postings can override this template in their automation settings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <PlaceholderHelper onInsert={handleInsertPlaceholder} />
      </div>
    </div>
  )
}
