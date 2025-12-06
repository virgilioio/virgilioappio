import { useState, useCallback } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { RejectionReasonSelector } from './RejectionReasonSelector';
import { RejectionEmailComposer } from './RejectionEmailComposer';
import { useRejectCandidate } from '@/hooks/useRejectCandidate';
import { ThumbsDown, Loader2, Send, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface RejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  associationId: string;
  candidateName: string;
  candidateEmail: string;
  candidateId?: string;
  jobId?: string;
  onSuccess?: () => void;
}

export function RejectionDialog({
  open,
  onOpenChange,
  associationId,
  candidateName,
  candidateEmail,
  candidateId,
  jobId,
  onSuccess,
}: RejectionDialogProps) {
  const [rejectionReasonId, setRejectionReasonId] = useState<string | undefined>();
  const [sendEmail, setSendEmail] = useState(false);
  const [emailData, setEmailData] = useState<{
    fromEmail: string;
    toEmails: string[];
    subject: string;
    bodyHtml: string;
  } | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Date | undefined>();

  const rejectCandidate = useRejectCandidate();

  const handleSubmit = async () => {
    await rejectCandidate.mutateAsync({
      associationId,
      rejectionReasonId,
      sendEmail: sendEmail && !!emailData,
      emailData: sendEmail && emailData ? {
        ...emailData,
        candidateId,
        jobId,
      } : undefined,
      scheduleFor,
    });

    onSuccess?.();
    onOpenChange(false);
    
    // Reset state
    setRejectionReasonId(undefined);
    setSendEmail(false);
    setEmailData(null);
    setScheduleFor(undefined);
  };

  const handleEmailDataChange = useCallback((data: typeof emailData) => {
    setEmailData(data);
  }, []);

  const handleScheduleChange = useCallback((date: Date | undefined) => {
    setScheduleFor(date);
  }, []);

  const canSubmit = !sendEmail || (sendEmail && emailData);
  const isScheduled = sendEmail && scheduleFor;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ThumbsDown className="h-5 w-5 text-destructive" />
            Reject Candidate
          </DialogTitle>
          <DialogDescription>
            Reject {candidateName} from this position. You can optionally send them a rejection email.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-6 py-2">
            {/* Rejection Reason */}
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <RejectionReasonSelector
                value={rejectionReasonId}
                onValueChange={setRejectionReasonId}
              />
              <p className="text-xs text-muted-foreground">
                Select a reason for rejection (for internal tracking)
              </p>
            </div>

            {/* Send Email Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="send-email" className="cursor-pointer">
                  Send rejection email
                </Label>
                <p className="text-xs text-muted-foreground">
                  Notify the candidate about your decision
                </p>
              </div>
              <Switch
                id="send-email"
                checked={sendEmail}
                onCheckedChange={setSendEmail}
              />
            </div>

            {/* Email Composer */}
            {sendEmail && (
              <div className="rounded-lg border p-4 space-y-4">
                <RejectionEmailComposer
                  defaultTo={candidateEmail}
                  onEmailDataChange={handleEmailDataChange}
                  onScheduleChange={handleScheduleChange}
                />
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canSubmit || rejectCandidate.isPending}
          >
            {rejectCandidate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rejecting...
              </>
            ) : isScheduled ? (
              <>
                <Clock className="h-4 w-4 mr-2" />
                Reject & Schedule Email
              </>
            ) : sendEmail ? (
              <>
                <Send className="h-4 w-4 mr-2" />
                Reject & Send Email
              </>
            ) : (
              <>
                <ThumbsDown className="h-4 w-4 mr-2" />
                Reject Candidate
              </>
            )}
          </Button>
        </DialogFooter>

        {sendEmail && !emailData && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded-md px-3 py-2">
            <AlertCircle className="h-4 w-4" />
            Complete all email fields to send a rejection email
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
