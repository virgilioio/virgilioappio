import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Mail, Info } from 'lucide-react'
import { PlaceholderHelper } from '@/components/settings/PlaceholderHelper'
import {
  SubjectTemplateEditor,
  BodyTemplateEditor,
  type SubjectTemplateEditorHandle,
  type BodyTemplateEditorHandle
} from '@/components/editors'

export function ConfirmationEmailAutomation() {
  const [enabled, setEnabled] = useState(false)
  const [subject, setSubject] = useState('Thank you for applying to {{job.title}} at {{organization.name}}')
  const [body, setBody] = useState(
    `Hi {{candidate.first_name}},\n\nThank you for applying to the {{job.title}} position at {{organization.name}}. We've received your application and our team will review it shortly.\n\nWe'll be in touch if your qualifications match our requirements.\n\nBest regards,\nThe {{organization.name}} Team`
  )
  const [lastFocusedField, setLastFocusedField] = useState<'subject' | 'body'>('body')
  const subjectRef = useRef<SubjectTemplateEditorHandle>(null)
  const bodyRef = useRef<BodyTemplateEditorHandle>(null)

  const handleInsertPlaceholder = (placeholder: string) => {
    if (lastFocusedField === 'subject') {
      subjectRef.current?.insertPlaceholder(placeholder)
    } else {
      bodyRef.current?.insertPlaceholder(placeholder)
    }
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
                onCheckedChange={setEnabled}
              />
            </div>
          </CardHeader>

          <CardContent className={`space-y-6 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <SubjectTemplateEditor
                ref={subjectRef}
                value={subject}
                onChange={setSubject}
                placeholder="Enter email subject..."
                onFocus={() => setLastFocusedField('subject')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Email Body</Label>
              <BodyTemplateEditor
                ref={bodyRef}
                value={body}
                onChange={setBody}
                onFocus={() => setLastFocusedField('body')}
              />
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
