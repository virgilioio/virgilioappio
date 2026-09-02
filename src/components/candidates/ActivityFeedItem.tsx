import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Paperclip } from 'lucide-react';
import { Activity } from '@/hooks/useActivityFeed';
import { getActivityIcon, getActivityColor } from '@/utils/activityHelpers';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { splitEmailQuote } from '@/utils/emailQuoteSplit';
import { sanitizeHtml } from '@/utils/htmlSanitizer';

interface ActivityFeedItemProps {
  activity: Activity;
  isLast?: boolean;
}

const EMAIL_TYPES = new Set(['candidate_email_sent', 'candidate_email_received']);

function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
}

export function ActivityFeedItem({ activity, isLast }: ActivityFeedItemProps) {
  const icon = getActivityIcon(activity.activity_type);
  const color = getActivityColor(activity.activity_type);
  const [expanded, setExpanded] = useState(false);

  // Get author name from profile data, metadata, or email
  const authorName = 
    (activity.author_first_name || activity.author_last_name)
      ? `${activity.author_first_name || ''} ${activity.author_last_name || ''}`.trim()
      : activity.metadata?.author_name 
        || activity.author_email?.split('@')[0] 
        || 'System';

  const isEmail = EMAIL_TYPES.has(activity.activity_type);
  const isReceived = activity.activity_type === 'candidate_email_received';
  const isStageMove =
    activity.activity_type === 'candidate_stage_changed' &&
    !!activity.metadata?.to_stage;

  const email = useMemo(() => {
    if (!isEmail) return null;
    const body = activity.emailBody;
    if (!body) return null;

    const split = splitEmailQuote(body.body_html, body.body_text);
    const mainHtml = split.isHtml ? sanitizeHtml(split.main || '') : '';
    const plain = split.isHtml
      ? htmlToPlainText(split.main || '')
      : (split.main || '').replace(/\s+/g, ' ').trim();

    const preview = plain || (body.snippet || '').replace(/\s+/g, ' ').trim();
    if (!preview && !mainHtml) return null;

    const counterparty = isReceived
      ? body.from_address
      : (body.to_addresses || [])[0] || null;

    const attachmentCount = Array.isArray(body.attachments) ? body.attachments.length : 0;

    return {
      subject: body.subject || activity.metadata?.subject || null,
      counterparty,
      preview,
      mainHtml,
      isHtml: split.isHtml,
      plain,
      attachmentCount,
    };
  }, [isEmail, isReceived, activity.emailBody, activity.metadata]);

  return (
    <div className="relative flex gap-3 pb-4">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
      )}
      
      {/* Icon */}
      <div 
        className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full shrink-0"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      
      {/* Content */}
      <div className="flex-1 pt-0.5 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {isStageMove ? (
              <>
                <p className="text-sm">
                  <span className="font-medium text-text-primary">{authorName}</span>
                  <span className="text-text-secondary ml-1">moved the candidate</span>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                  {activity.metadata?.from_stage && (
                    <>
                      <span className="text-text-secondary">{activity.metadata.from_stage}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                    </>
                  )}
                  <span className="font-medium text-text-primary">
                    {activity.metadata.to_stage}
                  </span>
                </div>
                {activity.metadata?.job_title && (
                  <p className="text-xs text-text-tertiary mt-0.5 truncate">
                    {activity.metadata.job_title}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm">
                  <span className="font-medium text-text-primary">{authorName}</span>
                  <span className="text-text-secondary ml-1">
                    {isEmail && email
                      ? isReceived
                        ? 'replied'
                        : 'sent an email'
                      : activity.title.toLowerCase()}
                  </span>
                </p>
                {isEmail && email ? (
                  <div className="mt-0.5">
                    {email.subject && (
                      <p className="text-sm font-medium text-text-primary truncate">
                        {email.subject}
                      </p>
                    )}
                    {email.counterparty && (
                      <p className="text-xs text-text-tertiary truncate">
                        {isReceived ? 'from' : 'to'} {email.counterparty}
                      </p>
                    )}
                  </div>
                ) : (
                  activity.description && (
                    <p className="text-sm text-text-secondary mt-0.5 line-clamp-2">
                      {activity.description}
                    </p>
                  )
                )}
              </>
            )}
          </div>
          <span className="text-xs text-text-tertiary whitespace-nowrap">
            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Email preview with See more / See less */}
        {isEmail && email && (
          <div className="mt-2 rounded-brand border border-border bg-surface-secondary p-2.5">
            {expanded ? (
              email.isHtml && email.mainHtml ? (
                <div
                  className="text-sm text-text-secondary [&_a]:text-accent [&_img]:max-w-full break-words"
                  dangerouslySetInnerHTML={{ __html: email.mainHtml }}
                />
              ) : (
                <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">
                  {email.plain || email.preview}
                </p>
              )
            ) : (
              <p className="text-sm text-text-secondary line-clamp-2">{email.preview}</p>
            )}

            <div className="mt-1.5 flex items-center justify-between gap-2">
              {email.attachmentCount > 0 ? (
                <span className="flex items-center gap-1 text-xs text-text-tertiary">
                  <Paperclip className="h-3 w-3" />
                  {email.attachmentCount}{' '}
                  {email.attachmentCount === 1 ? 'attachment' : 'attachments'}
                </span>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="text-xs font-medium text-accent hover:text-accent-hover"
              >
                {expanded ? 'See less' : 'See more'}
              </button>
            </div>
          </div>
        )}
        
        {/* Expandable metadata for stage changes and other important info */}
        {activity.activity_type === 'candidate_stage_changed' && activity.metadata?.note && (
          <div className="mt-2 text-sm bg-surface-secondary p-2 rounded-brand border border-border">
            <p className="text-text-secondary italic">"{activity.metadata.note}"</p>
          </div>
        )}
        
        {activity.activity_type === 'candidate_profile_updated' && activity.metadata?.changes && (
          <Collapsible>
            <CollapsibleTrigger className="text-xs text-accent hover:text-accent-hover mt-1">
              View changes →
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="text-xs bg-surface-secondary p-2 rounded-brand border border-border">
                <pre className="whitespace-pre-wrap font-mono">
                  {JSON.stringify(activity.metadata.changes, null, 2)}
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
