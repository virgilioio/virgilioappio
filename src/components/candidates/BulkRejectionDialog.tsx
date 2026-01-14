import { useState, useEffect, useCallback } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SubjectTemplateEditor, BodyTemplateEditor } from '@/components/editors';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio';
import { TimePickerVirgilio } from '@/components/ui/time-picker-virgilio';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RejectionReasonSelector } from './RejectionReasonSelector';

import { useBulkRejectCandidates } from '@/hooks/useBulkRejectCandidates';
import { useMailIdentities } from '@/hooks/useMailIdentities';
import { useRejectionEmailTemplates } from '@/hooks/useRejectionEmailTemplates';
import { convertHtmlToPlaceholders, containsPlaceholders } from '@/utils/placeholderUtils';
import { ThumbsDown, Loader2, Send, Clock, AlertCircle, Users, Mail, Info } from 'lucide-react';
import { setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface BulkRejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateIds: string[];
  jobId: string;
  onSuccess?: () => void;
}

export function BulkRejectionDialog({
  open,
  onOpenChange,
  candidateIds,
  jobId,
  onSuccess,
}: BulkRejectionDialogProps) {
  const [associationIds, setAssociationIds] = useState<string[]>([]);
  const [rejectionReasonId, setRejectionReasonId] = useState<string | undefined>();
  const [sendEmail, setSendEmail] = useState(true);
  const [fromEmail, setFromEmail] = useState('');
  const [subjectHtml, setSubjectHtml] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [sendOption, setSendOption] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState('09:00');

  const { identities, isLoading: loadingIdentities } = useMailIdentities();
  const { templates, isLoading: loadingTemplates } = useRejectionEmailTemplates('organization');
  const bulkReject = useBulkRejectCandidates();

  const activeIdentities = identities.filter(id => id.is_active);

  // Fetch association IDs when dialog opens
  useEffect(() => {
    if (open && candidateIds.length > 0) {
      fetchAssociations();
    }
  }, [open, candidateIds, jobId]);

  const fetchAssociations = async () => {
    const { data, error } = await supabase
      .from('job_candidate_associations')
      .select('id, candidate_id, status')
      .eq('job_id', jobId)
      .in('candidate_id', candidateIds)
      .not('status', 'eq', 'rejected')
      .not('status', 'eq', 'hired');

    if (!error && data) {
      setAssociationIds(data.map(a => a.id));
    }
  };

  // Set default from email
  useEffect(() => {
    if (activeIdentities.length > 0 && !fromEmail) {
      setFromEmail(activeIdentities[0].email_address);
    }
  }, [activeIdentities, fromEmail]);

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

  const handleSubmit = async () => {
    if (associationIds.length === 0) return;

    try {
      let scheduleFor: Date | undefined;
      if (sendOption === 'later' && scheduledDate) {
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        scheduleFor = setMinutes(setHours(scheduledDate, hours), minutes);
      }

      await bulkReject.mutateAsync({
        associationIds,
        rejectionReasonId,
        sendEmail: sendEmail && !!fromEmail && !!subjectHtml && !!bodyHtml,
        emailData: sendEmail && fromEmail && subjectHtml && bodyHtml ? {
          fromEmail,
          subject: convertHtmlToPlaceholders(subjectHtml),
          bodyHtml: convertHtmlToPlaceholders(bodyHtml),
        } : undefined,
        scheduleFor,
      });

      onSuccess?.();
      onOpenChange(false);
      resetState();
    } catch (error) {
      console.error('Bulk rejection failed:', error);
    }
  };

  const resetState = () => {
    setRejectionReasonId(undefined);
    setSendEmail(true);
    setFromEmail('');
    setSubjectHtml('');
    setBodyHtml('');
    setSelectedTemplateId(null);
    setSendOption('now');
    setScheduledDate(undefined);
    setScheduledTime('09:00');
    setAssociationIds([]);
  };

  const canSubmit = associationIds.length > 0 && (!sendEmail || (sendEmail && fromEmail && subjectHtml && bodyHtml));
  const isScheduled = sendEmail && sendOption === 'later' && scheduledDate;
  const progressPercent = bulkReject.progress.total > 0
    ? ((bulkReject.progress.completed + bulkReject.progress.failed) / bulkReject.progress.total) * 100
    : 0;

  // Cmd+Enter shortcut handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (canSubmit && !bulkReject.isPending) {
        handleSubmit();
      }
    }
  }, [canSubmit, bulkReject.isPending, handleSubmit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col" onKeyDown={handleKeyDown}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ThumbsDown className="h-5 w-5 text-destructive" />
            Reject {candidateIds.length} Candidate{candidateIds.length > 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Apply rejection to all selected candidates at once
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2">
          <div className="space-y-6 py-2">
            {/* Progress indicator during submission */}
            {bulkReject.isPending && (
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span>Processing rejections...</span>
                  <span>{bulkReject.progress.completed + bulkReject.progress.failed}/{bulkReject.progress.total}</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            )}

            {/* Rejection Reason */}
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <RejectionReasonSelector
                value={rejectionReasonId}
                onValueChange={setRejectionReasonId}
              />
              <p className="text-xs text-muted-foreground">
                This reason will be applied to all selected candidates
              </p>
            </div>

            {/* Send Email Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="send-email-bulk" className="cursor-pointer">
                  Send rejection emails
                </Label>
                <p className="text-xs text-muted-foreground">
                  Notify all candidates about your decision
                </p>
              </div>
              <Switch
                id="send-email-bulk"
                checked={sendEmail}
                onCheckedChange={setSendEmail}
              />
            </div>

            {/* Email Composer */}
            {sendEmail && (
              <div className="rounded-lg border p-4 space-y-4">
                {loadingIdentities ? (
                  <Skeleton className="h-64 w-full" />
                ) : activeIdentities.length === 0 ? (
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
                ) : (
                  <>
                    {/* Personalization info */}
                    <div className="flex items-start gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm">
                      <Info className="h-4 w-4 text-primary mt-0.5" />
                      <p className="text-primary">
                        Emails will be personalized for each candidate using placeholders like <Badge variant="secondary" className="text-xs">{'{{candidate.name}}'}</Badge>
                      </p>
                    </div>

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
                          ✨ Placeholders will be replaced with each candidate's information
                        </p>
                      )}
                    </div>

                    {/* Send Timing */}
                    <div className="space-y-3 pt-2">
                      <Label>When to send</Label>
                      <RadioGroup value={sendOption} onValueChange={(v) => setSendOption(v as 'now' | 'later')}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="now" id="bulk-send-now" />
                          <Label htmlFor="bulk-send-now" className="font-normal cursor-pointer">
                            Send immediately
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="later" id="bulk-send-later" />
                          <Label htmlFor="bulk-send-later" className="font-normal cursor-pointer">
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
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 flex-row items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground hidden sm:inline">⌘↵ to submit</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={bulkReject.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={!canSubmit || bulkReject.isPending}
            >
              {bulkReject.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : isScheduled ? (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Reject & Schedule Emails
                </>
              ) : sendEmail && activeIdentities.length > 0 ? (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Reject & Send Emails
                </>
              ) : (
                <>
                  <ThumbsDown className="h-4 w-4 mr-2" />
                  Reject {candidateIds.length} Candidate{candidateIds.length > 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>

        {sendEmail && activeIdentities.length > 0 && (!fromEmail || !subjectHtml || !bodyHtml) && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded-md px-3 py-2">
            <AlertCircle className="h-4 w-4" />
            Complete all email fields to send rejection emails
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
