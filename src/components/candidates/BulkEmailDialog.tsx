import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { SubjectInputWithBadges } from './SubjectInputWithBadges';
import { useBulkSendEmail } from '@/hooks/useBulkSendEmail';
import { useMailIdentities } from '@/hooks/useMailIdentities';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { convertPlaceholdersToHtml, convertHtmlToPlaceholders, containsPlaceholders } from '@/utils/placeholderUtils';
import { Loader2, Send, Clock, CalendarIcon, Mail, Info } from 'lucide-react';
import { format, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateIds: string[];
  jobId: string;
  onSuccess?: () => void;
}

export function BulkEmailDialog({
  open,
  onOpenChange,
  candidateIds,
  jobId,
  onSuccess,
}: BulkEmailDialogProps) {
  const [associationIds, setAssociationIds] = useState<string[]>([]);
  const [fromEmail, setFromEmail] = useState('');
  const [subjectHtml, setSubjectHtml] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [sendOption, setSendOption] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [candidatesWithoutEmail, setCandidatesWithoutEmail] = useState<string[]>([]);

  const { identities, isLoading: loadingIdentities } = useMailIdentities();
  const { templates, isLoading: loadingTemplates } = useEmailTemplates('organization');
  const bulkEmail = useBulkSendEmail();

  // Fetch associations when dialog opens
  useEffect(() => {
    if (open && candidateIds.length > 0) {
      fetchAssociations();
    }
  }, [open, candidateIds, jobId]);

  const fetchAssociations = async () => {
    const { data, error } = await supabase
      .from('job_candidate_associations')
      .select('id, candidate_id, candidate:candidates!inner(email, candidate_name)')
      .eq('job_id', jobId)
      .in('candidate_id', candidateIds);

    if (!error && data) {
      // Filter out candidates without email and track them
      const withEmail = data.filter((a: any) => a.candidate?.email);
      const withoutEmail = data.filter((a: any) => !a.candidate?.email);
      
      setAssociationIds(withEmail.map((a) => a.id));
      setCandidatesWithoutEmail(withoutEmail.map((a: any) => a.candidate?.candidate_name || 'Unknown'));
    }
  };

  // Set default from email when identities load
  useEffect(() => {
    if (identities.length > 0 && !fromEmail) {
      setFromEmail(identities[0].email_address);
    }
  }, [identities, fromEmail]);

  // Apply template when selected
  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find((t) => t.id === selectedTemplateId);
      if (template) {
        setSubjectHtml(convertPlaceholdersToHtml(template.subject));
        setBodyHtml(convertPlaceholdersToHtml(template.body));
      }
    }
  }, [selectedTemplateId, templates]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setAssociationIds([]);
      setFromEmail('');
      setSubjectHtml('');
      setBodyHtml('');
      setSelectedTemplateId(null);
      setSendOption('now');
      setScheduledDate(undefined);
      setScheduledTime('09:00');
      setCandidatesWithoutEmail([]);
      bulkEmail.reset();
    }
  }, [open]);

  const handleSend = async () => {
    if (associationIds.length === 0) return;

    // Convert HTML badges back to placeholder syntax
    const plainSubject = convertHtmlToPlaceholders(subjectHtml);
    const plainBody = convertHtmlToPlaceholders(bodyHtml);

    let scheduleFor: Date | undefined;
    if (sendOption === 'later' && scheduledDate) {
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      scheduleFor = setMinutes(setHours(scheduledDate, hours), minutes);
    }

    await bulkEmail.sendBulkEmailAsync({
      associationIds,
      emailData: {
        fromEmail,
        subject: plainSubject,
        bodyHtml: plainBody,
      },
      scheduleFor,
    });

    onSuccess?.();
    onOpenChange(false);
  };

  const canSubmit = associationIds.length > 0 && fromEmail && subjectHtml && bodyHtml;
  const isScheduled = sendOption === 'later' && scheduledDate;
  const progressPercent = bulkEmail.progress.total > 0
    ? ((bulkEmail.progress.completed + bulkEmail.progress.failed) / bulkEmail.progress.total) * 100
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email to {candidateIds.length} Candidate{candidateIds.length > 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            Send personalized emails to all selected candidates
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Progress indicator during sending */}
          {bulkEmail.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Sending emails...</span>
                <span>
                  {bulkEmail.progress.completed + bulkEmail.progress.failed} / {bulkEmail.progress.total}
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}

          {/* Warning for candidates without email */}
          {candidatesWithoutEmail.length > 0 && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertDescription>
                {candidatesWithoutEmail.length} candidate{candidatesWithoutEmail.length > 1 ? 's' : ''} will be skipped (no email address):
                {' '}{candidatesWithoutEmail.slice(0, 3).join(', ')}
                {candidatesWithoutEmail.length > 3 && ` and ${candidatesWithoutEmail.length - 3} more`}
              </AlertDescription>
            </Alert>
          )}

          {/* Info about placeholders */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Use placeholders like <code className="bg-muted px-1 rounded">{'{{candidate.name}}'}</code> to personalize each email.
              They will be replaced with each candidate's information.
            </AlertDescription>
          </Alert>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Email Template (optional)</Label>
            {loadingTemplates ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={selectedTemplateId || ''}
                onValueChange={(v) => setSelectedTemplateId(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* From Email */}
          <div className="space-y-2">
            <Label>From</Label>
            {loadingIdentities ? (
              <Skeleton className="h-10 w-full" />
            ) : identities.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No email accounts connected.{' '}
                  <Link to="/settings/integrations" className="underline text-primary">
                    Connect one in settings
                  </Link>
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={fromEmail} onValueChange={setFromEmail}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sender..." />
                </SelectTrigger>
                <SelectContent>
                  {identities.map((identity) => (
                    <SelectItem key={identity.id} value={identity.email_address}>
                      {identity.display_name || identity.email_address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label>Subject</Label>
            <SubjectInputWithBadges
              value={subjectHtml}
              onChange={setSubjectHtml}
              placeholder="Email subject..."
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label>Message</Label>
            <RichTextEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Write your email message..."
              minHeight="150px"
            />
            {containsPlaceholders(bodyHtml) && (
              <p className="text-xs text-muted-foreground">
                ✨ Placeholders will be replaced with each candidate's information
              </p>
            )}
          </div>

          {/* Send Timing */}
          <div className="space-y-3">
            <Label>When to send</Label>
            <RadioGroup
              value={sendOption}
              onValueChange={(v) => setSendOption(v as 'now' | 'later')}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="now" id="send-now" />
                <Label htmlFor="send-now" className="font-normal cursor-pointer flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Send immediately
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="later" id="send-later" />
                <Label htmlFor="send-later" className="font-normal cursor-pointer flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Schedule for later
                </Label>
              </div>
            </RadioGroup>

            {sendOption === 'later' && (
              <div className="flex gap-2 pl-6">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'justify-start text-left font-normal',
                        !scheduledDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Select value={scheduledTime} onValueChange={setScheduledTime}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return (
                        <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={bulkEmail.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSubmit || bulkEmail.isPending || (sendOption === 'later' && !scheduledDate)}
          >
            {bulkEmail.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {isScheduled ? 'Schedule' : 'Send'} {associationIds.length} Email{associationIds.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
