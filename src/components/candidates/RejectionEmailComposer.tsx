import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SubjectTemplateEditor, BodyTemplateEditor } from '@/components/editors';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio';
import { TimePickerVirgilio } from '@/components/ui/time-picker-virgilio';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMailIdentities } from '@/hooks/useMailIdentities';
import { useRejectionEmailTemplates } from '@/hooks/useRejectionEmailTemplates';
import { convertHtmlToPlaceholders, containsPlaceholders } from '@/utils/placeholderUtils';
import { setHours, setMinutes } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

interface RejectionEmailComposerProps {
  defaultTo: string;
  onEmailDataChange: (data: {
    fromEmail: string;
    toEmails: string[];
    subject: string;
    bodyHtml: string;
  } | null) => void;
  onScheduleChange: (scheduleFor: Date | undefined) => void;
}

export function RejectionEmailComposer({
  defaultTo,
  onEmailDataChange,
  onScheduleChange,
}: RejectionEmailComposerProps) {
  const { identities, isLoading: loadingIdentities } = useMailIdentities();
  const { templates, isLoading: loadingTemplates } = useRejectionEmailTemplates('organization');

  const activeIdentities = identities.filter(id => id.is_active);

  const [fromEmail, setFromEmail] = useState('');
  const [toEmail, setToEmail] = useState(defaultTo);
  const [subjectHtml, setSubjectHtml] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [sendOption, setSendOption] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState('09:00');

  // Set default from email when identities load
  useEffect(() => {
    if (activeIdentities.length > 0 && !fromEmail) {
      setFromEmail(activeIdentities[0].email_address);
    }
  }, [activeIdentities, fromEmail]);

  // Update parent with email data when inputs change
  useEffect(() => {
    if (!fromEmail || !toEmail || !subjectHtml || !bodyHtml) {
      onEmailDataChange(null);
      return;
    }

    const subjectWithPlaceholders = convertHtmlToPlaceholders(subjectHtml);
    const bodyHtmlWithPlaceholders = convertHtmlToPlaceholders(bodyHtml);

    onEmailDataChange({
      fromEmail,
      toEmails: toEmail.split(/[,;]/).map(e => e.trim()).filter(Boolean),
      subject: subjectWithPlaceholders,
      bodyHtml: bodyHtmlWithPlaceholders,
    });
  }, [fromEmail, toEmail, subjectHtml, bodyHtml, onEmailDataChange]);

  // Update parent with schedule date
  useEffect(() => {
    if (sendOption === 'later' && scheduledDate) {
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const scheduledDateTime = setMinutes(setHours(scheduledDate, hours), minutes);
      onScheduleChange(scheduledDateTime);
    } else {
      onScheduleChange(undefined);
    }
  }, [sendOption, scheduledDate, scheduledTime, onScheduleChange]);

  const handleTemplateSelect = (templateId: string) => {
    if (templateId === '__none__') {
      setSelectedTemplateId(null);
      return;
    }
    
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      // Normalize to plain text with {{placeholders}} - the editor handles badge rendering
      setSubjectHtml(convertHtmlToPlaceholders(template.subject));
      setBodyHtml(convertHtmlToPlaceholders(template.body));
    }
  };

  if (loadingIdentities) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (activeIdentities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-3">
          Connect your email account to send rejection emails
        </p>
        <Link to="/settings?tab=email">
          <Button variant="outline" size="sm">
            <Mail className="h-4 w-4 mr-2" />
            Connect Mailbox
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Template Selector */}
      <div className="space-y-2">
        <Label>Email Template</Label>
        <Select
          value={selectedTemplateId || '__none__'}
          onValueChange={handleTemplateSelect}
          disabled={loadingTemplates}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a template..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No template</SelectItem>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                <div className="flex items-center gap-2">
                  <span>{template.name}</span>
                  {template.source === 'platform' && (
                    <Badge variant="outline" className="text-xs">
                      Platform
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* From */}
      <div className="space-y-2">
        <Label>From</Label>
        <Select value={fromEmail} onValueChange={setFromEmail}>
          <SelectTrigger>
            <SelectValue placeholder="Select email account" />
          </SelectTrigger>
          <SelectContent>
            {activeIdentities.map((identity) => (
              <SelectItem key={identity.id} value={identity.email_address}>
                {identity.display_name} ({identity.email_address})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* To */}
      <div className="space-y-2">
        <Label>To</Label>
        <Input
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
          placeholder="recipient@example.com"
        />
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label>Subject</Label>
        <SubjectTemplateEditor
          value={subjectHtml}
          onChange={setSubjectHtml}
          placeholder="Email subject"
        />
      </div>

      {/* Body */}
      <div className="space-y-2">
        <Label>Message</Label>
        <BodyTemplateEditor
          value={bodyHtml}
          onChange={setBodyHtml}
          placeholder="Write your rejection email..."
          minHeight="150px"
        />
        {containsPlaceholders(bodyHtml) && (
          <p className="text-xs text-primary bg-primary/10 border border-primary/30 rounded px-2 py-1">
            ✨ Placeholders will be replaced with candidate/job information when sent
          </p>
        )}
      </div>

      {/* Send Timing */}
      <div className="space-y-3 pt-2">
        <Label>When to send</Label>
        <RadioGroup value={sendOption} onValueChange={(v) => setSendOption(v as 'now' | 'later')}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="now" id="send-now" />
            <Label htmlFor="send-now" className="font-normal cursor-pointer">
              Send immediately
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="later" id="send-later" />
            <Label htmlFor="send-later" className="font-normal cursor-pointer">
              Schedule for later
            </Label>
          </div>
        </RadioGroup>

        {sendOption === 'later' && (
          <div className="flex items-center gap-3 pl-6">
            <DatePickerVirgilio
              value={scheduledDate}
              onChange={setScheduledDate}
              minDate={new Date()}
              className="w-[200px]"
            />
            <TimePickerVirgilio
              value={scheduledTime}
              onChange={setScheduledTime}
              className="w-[130px]"
            />
          </div>
        )}
      </div>
    </div>
  );
}
