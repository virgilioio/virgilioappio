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
          No emails yet
        </h3>
        <p className="text-xs text-text-secondary max-w-sm">
          Email conversations with this candidate will appear here.
        </p>
      </div>
    );
  }

  // Group emails by thread_id for conversation view
  const threads = emails.reduce((acc, email) => {
    const threadId = email.thread_id || email.id;
    if (!acc[threadId]) {
      acc[threadId] = [];
    }
    acc[threadId].push(email);
    return acc;
  }, {} as Record<string, typeof emails>);

  // Sort threads by most recent activity
  const sortedThreads = Object.entries(threads).sort(([, a], [, b]) => {
    const aLatest = a.reduce((latest, email) => {
      const date = new Date(email.received_at || email.sent_at || email.created_at);
      return date > latest ? date : latest;
    }, new Date(0));
    const bLatest = b.reduce((latest, email) => {
      const date = new Date(email.received_at || email.sent_at || email.created_at);
      return date > latest ? date : latest;
    }, new Date(0));
    return bLatest.getTime() - aLatest.getTime();
  });

  return (
    <div className="space-y-4">
      <div className="text-xs text-text-secondary mb-4">
        {emails.length} {emails.length === 1 ? 'email' : 'emails'} • {sortedThreads.length} {sortedThreads.length === 1 ? 'conversation' : 'conversations'}
      </div>
      {sortedThreads.map(([threadId, threadEmails]) => (
        <div key={threadId} className="space-y-2">
          {threadEmails.map((email) => (
            <EmailHistoryCard key={email.id} email={email} />
          ))}
        </div>
      ))}
    </div>
  );
}
