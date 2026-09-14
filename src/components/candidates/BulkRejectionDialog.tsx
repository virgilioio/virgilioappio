import { RejectionDialog } from './RejectionDialog';

interface BulkRejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateIds: string[];
  jobId: string;
  jobTitle?: string;
  onSuccess?: () => void;
}

/**
 * Bulk rejection deliberately renders the canonical rejection dialog.
 * Only its targets, count-aware copy, and mutation differ from the individual flow.
 */
export function BulkRejectionDialog({
  open,
  onOpenChange,
  candidateIds,
  jobId,
  jobTitle,
  onSuccess,
}: BulkRejectionDialogProps) {
  return (
    <RejectionDialog
      open={open}
      onOpenChange={onOpenChange}
      candidateIds={candidateIds}
      jobId={jobId}
      jobTitle={jobTitle}
      onSuccess={onSuccess}
    />
  );
}