import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { splitEmailQuote } from '@/utils/emailQuoteSplit';
import { htmlToPlainText, toParagraphs } from '@/utils/emailToParagraphs';

/** Email shape rendered by the feed. Always joined from the message record. */
export interface ActivityEmail {
  emailLogId: string;
  direction: 'sent' | 'received';
  to?: string;
  from?: string;
  subject: string;
  paragraphs: string[];
  /** Pre-formatted, omitted when open tracking is unavailable. */
  opened?: string;
}

export interface ActivityAutomation {
  name: string;
  step?: string;
}

export interface Activity {
  id: string;
  user_id: string;
  organization_id: string | null;
  activity_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, any>;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  author_first_name?: string;
  author_last_name?: string;
  author_email?: string;
  email?: ActivityEmail | null;
  automation?: ActivityAutomation | null;
}

const EMAIL_ACTIVITY_TYPES = new Set([
  'candidate_email_sent',
  'candidate_email_received',
  'candidate_email_automated',
]);

interface EmailLogRow {
  id: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  snippet: string | null;
  from_address: string | null;
  to_addresses: string[] | null;
  direction: string | null;
  opened_at: string | null;
}

function buildEmail(
  activityType: string,
  log: EmailLogRow | undefined,
): ActivityEmail | null {
  if (!log) return null;

  const direction: 'sent' | 'received' =
    activityType === 'candidate_email_received' || log.direction === 'inbound' || log.direction === 'received'
      ? 'received'
      : 'sent';

  // Quoted history off first, then signature, then paragraphs.
  const split = splitEmailQuote(log.body_html, log.body_text);
  const plain = split.isHtml ? htmlToPlainText(split.main || '') : (split.main || '');
  let paragraphs = toParagraphs(plain);
  if (paragraphs.length === 0 && log.snippet) {
    paragraphs = toParagraphs(log.snippet);
  }
  if (paragraphs.length === 0) return null;

  const email: ActivityEmail = {
    emailLogId: log.id,
    direction,
    subject: log.subject || (direction === 'received' ? 'Email received' : 'Email sent'),
    paragraphs,
  };

  if (direction === 'received') {
    if (log.from_address) email.from = log.from_address;
  } else {
    const to = (log.to_addresses || [])[0];
    if (to) email.to = to;
    if (log.opened_at) {
      email.opened = `Opened ${format(new Date(log.opened_at), 'MMM d, h:mm a')}`;
    }
  }

  return email;
}

function buildAutomation(metadata: Record<string, any> | null): ActivityAutomation | null {
  const raw = metadata?.automation;
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name : '';
  const step = typeof raw.step === 'string' && raw.step ? raw.step : undefined;
  if (!name && !step) return null;
  return { name, step };
}

export function useActivityFeed(candidateId?: string, jobId?: string) {
  return useQuery({
    queryKey: ['activity-feed', candidateId, jobId],
    queryFn: async () => {
      if (!candidateId) return [];

      // Call the secure database function to get activities
      const { data, error } = await supabase.rpc('get_candidate_activities', {
        p_candidate_id: candidateId,
        p_job_id: jobId || null,
      });

      if (error) throw error;

      const activities = (data || []) as Activity[];

      const withAutomation = activities.map(a => ({
        ...a,
        automation: buildAutomation(a.metadata || null),
      }));

      // Resolve email bodies for email activities in one batched read.
      const logIds = [
        ...new Set(
          withAutomation
            .filter(a => EMAIL_ACTIVITY_TYPES.has(a.activity_type))
            .map(a => a.metadata?.email_log_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
        ),
      ];

      if (logIds.length === 0) return withAutomation;

      const { data: logs, error: logsError } = await supabase
        .from('email_logs')
        .select(
          'id, subject, body_html, body_text, snippet, from_address, to_addresses, direction, opened_at'
        )
        .in('id', logIds);

      // Missing bodies are not an error — rows simply render without a card.
      if (logsError) return withAutomation;

      const logMap = new Map((logs || []).map(l => [l.id, l as EmailLogRow]));

      return withAutomation.map(a =>
        EMAIL_ACTIVITY_TYPES.has(a.activity_type)
          ? { ...a, email: buildEmail(a.activity_type, logMap.get(a.metadata?.email_log_id)) }
          : a
      );
    },
    enabled: !!candidateId,
  });
}
