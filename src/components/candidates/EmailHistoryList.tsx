import { Mail, RefreshCw } from 'lucide-react';
import { useEmailLogs } from '@/hooks/useEmailLogs';
import { useSyncGmail } from '@/hooks/useSyncGmail';
import { EmailHistoryCard, EmailHistoryCardEmail } from './EmailHistoryCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import gioFaceEmpty from '@/assets/gio-face-empty.png';

interface EmailHistoryListProps {
  candidateId: string;
  jobId?: string;
  onReply?: (email: EmailHistoryCardEmail) => void;
  onForward?: (email: EmailHistoryCardEmail) => void;
}

export function EmailHistoryList({ candidateId, jobId, onReply, onForward }: EmailHistoryListProps) {
  const { data: emails, isLoading } = useEmailLogs(candidateId, jobId);
  const syncGmail = useSyncGmail();
  const [mailIdentityId, setMailIdentityId] = useState<string | null>(null);

  // Fetch the user's mail identity on mount
  useEffect(() => {
    const fetchMailIdentity = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: identities } = await supabase
        .from('user_mail_identities')
        .select('id')
        .eq('user_id', user.id)
        .eq('sync_status', 'active')
        .limit(1)
        .single();

      if (identities) {
        setMailIdentityId(identities.id);
      }
    };

    fetchMailIdentity();
  }, []);

  const handleManualSync = () => {
    if (!mailIdentityId) {
      toast.error('No active Gmail account found');
      return;
    }
    syncGmail.mutate(mailIdentityId);
  };

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
      <div className="text-center py-12">
        <img 
          src={gioFaceEmpty}
          alt="No emails"
          className="h-16 w-16 mx-auto mb-4 rounded-full"
        />
        <p className="text-[1.38rem] font-semibold mb-2 tracking-[-0.06em]">
          <span>No emails yet</span>
          <span className="text-purple-period">.</span>
        </p>
        <p className="text-sm text-text-secondary max-w-sm mx-auto">
          Email conversations with this candidate will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-text-secondary">
          {emails.length} {emails.length === 1 ? 'email' : 'emails'}
        </div>
        {mailIdentityId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={syncGmail.isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-3 w-3 ${syncGmail.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>
      {emails.map((email) => (
        <EmailHistoryCard 
          key={email.id} 
          email={email}
          onReply={onReply}
          onForward={onForward}
        />
      ))}
    </div>
  );
}
