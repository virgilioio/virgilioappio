import { useState } from 'react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { ChevronDown, ChevronUp, Check, X, Clock, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SafeHtml } from '@/components/ui/safe-html';
import { cn } from '@/lib/utils';

interface EmailHistoryCardProps {
  email: {
    id: string;
    from_address: string;
    to_addresses: string[];
    cc_addresses?: string[] | null;
    bcc_addresses?: string[] | null;
    subject: string;
    body_html?: string | null;
    body_text?: string | null;
    status: string;
    created_at: string;
    sent_at?: string | null;
    opened_at?: string | null;
    clicked_at?: string | null;
    replied_at?: string | null;
    error_message?: string | null;
  };
}

export function EmailHistoryCard({ email }: EmailHistoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    }
    return format(date, 'MMM d, yyyy \'at\' h:mm a');
  };

  const getStatusBadge = () => {
    switch (email.status) {
      case 'sent':
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
            <Check className="h-3 w-3 mr-1" />
            Sent
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
            <X className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {email.status}
          </Badge>
        );
    }
  };

  const hasRecipients = email.cc_addresses?.length || email.bcc_addresses?.length;

  return (
    <Card className={cn(
      "relative border-l-4 transition-all",
      email.status === 'sent' && "border-l-green-500",
      email.status === 'failed' && "border-l-red-500",
      email.status === 'pending' && "border-l-gray-400"
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-text-secondary flex-shrink-0" />
              <span className="text-sm font-medium text-text-primary truncate">
                {email.from_address}
              </span>
            </div>
            <div className="text-xs text-text-secondary">
              To: {email.to_addresses.join(', ')}
            </div>
            {hasRecipients && (
              <div className="text-xs text-text-secondary mt-0.5">
                {email.cc_addresses?.length ? `CC: ${email.cc_addresses.join(', ')}` : ''}
                {email.bcc_addresses?.length ? ` BCC: ${email.bcc_addresses.join(', ')}` : ''}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 ml-3">
            <span className="text-xs text-text-secondary whitespace-nowrap">
              {formatTimestamp(email.created_at)}
            </span>
            {getStatusBadge()}
          </div>
        </div>

        {/* Subject */}
        <div className="font-medium text-text-primary mb-2">
          {email.subject}
        </div>

        {/* Status indicators */}
        {email.status === 'sent' && (
          <div className="flex gap-2 mb-2 text-xs text-text-secondary">
            {email.opened_at && (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-green-600" />
                Opened {formatDistanceToNow(new Date(email.opened_at), { addSuffix: true })}
              </span>
            )}
            {email.clicked_at && (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-blue-600" />
                Clicked
              </span>
            )}
            {email.replied_at && (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-purple-600" />
                Replied
              </span>
            )}
          </div>
        )}

        {/* Error message */}
        {email.error_message && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-2 rounded mb-2">
            {email.error_message}
          </div>
        )}

        {/* Body preview/expanded */}
        <div className="mt-3">
          {isExpanded ? (
            <div className="text-sm text-text-primary">
              {email.body_html ? (
                <SafeHtml content={email.body_html} className="prose prose-sm max-w-none dark:prose-invert" />
              ) : (
                <div className="whitespace-pre-wrap">{email.body_text || 'No content'}</div>
              )}
            </div>
          ) : (
            <div className="text-sm text-text-secondary line-clamp-2">
              {email.body_text?.slice(0, 150) || email.body_html?.replace(/<[^>]*>/g, '').slice(0, 150) || 'No content'}
            </div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 h-7 text-xs"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show more
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
