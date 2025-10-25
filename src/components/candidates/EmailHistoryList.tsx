import { Mail } from 'lucide-react';
import { useEmailLogs } from '@/hooks/useEmailLogs';
import { EmailHistoryCard } from './EmailHistoryCard';
import { Skeleton } from '@/components/ui/skeleton';

interface EmailHistoryListProps {
  candidateId: string;
  jobId?: string;
}

export function EmailHistoryList({ candidateId, jobId }: EmailHistoryListProps) {
  const { data: emails, isLoading } = useEmailLogs(candidateId, jobId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!emails || emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-surface-secondary p-3 mb-4">
          <Mail className="h-6 w-6 text-text-secondary" />
        </div>
        <h3 className="text-sm font-medium text-text-primary mb-1">
          No emails sent yet
        </h3>
        <p className="text-xs text-text-secondary max-w-sm">
          Emails sent to this candidate will appear here. Use the "Send Email" button to start a conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-text-secondary mb-4">
        {emails.length} {emails.length === 1 ? 'email' : 'emails'}
      </div>
      {emails.map((email) => (
        <EmailHistoryCard key={email.id} email={email} />
      ))}
    </div>
  );
}
