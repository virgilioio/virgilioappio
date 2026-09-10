import { useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronUp, Eye, Inbox, Send } from 'lucide-react';
import type { ActivityEmail } from '@/hooks/useActivityFeed';

interface ActivityEmailCardProps {
  email: ActivityEmail;
  /** Switch to the Emails tab and scroll this message into view. */
  onOpenInEmails?: (emailLogId: string) => void;
}

/**
 * Compact, expandable email card inside an activity entry.
 * Collapsed by default; expansion is local state and never persisted.
 */
export function ActivityEmailCard({ email, onOpenInEmails }: ActivityEmailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isReceived = email.direction === 'received';
  const address = isReceived ? email.from : email.to;

  return (
    <div className="mt-2 overflow-hidden rounded-[8px] border border-[#E7E8EE] bg-white">
      <div
        className="flex items-center gap-1.5 border-b border-[#F1F0EC] px-3 py-2"
        style={{ backgroundColor: isReceived ? '#FBFAFF' : '#FCFCFA' }}
      >
        {isReceived ? (
          <Inbox size={11} className="shrink-0 text-[#8B8F9E]" />
        ) : (
          <Send size={11} className="shrink-0 text-[#8B8F9E]" />
        )}
        <span className="font-inter text-[11px] text-[#8B8F9E]">
          {isReceived ? 'From' : 'To'}
        </span>
        <span className="truncate font-inter text-[11px] text-[#5A6072]">
          {address || '—'}
        </span>
      </div>

      <div className="px-3 pb-3 pt-2.5">
        <div className="font-inter text-[12.5px] font-semibold text-[#1F2230] break-words">
          {email.subject}
        </div>

        {expanded ? (
          <div className="mt-1.5 space-y-[10px]">
            {email.paragraphs.map((p, i) => (
              <p
                key={i}
                className="font-inter text-[12.5px] leading-[1.6] text-[#5A6072] break-words"
              >
                {p}
              </p>
            ))}
          </div>
        ) : (
          <p
            className="mt-1.5 font-inter text-[12.5px] leading-[1.6] text-[#5A6072] break-words"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {email.paragraphs.join(' ')}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-inter text-[11.5px] font-semibold text-[#6F3FF5]"
          >
            {expanded ? 'See less' : 'See more'}
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          {expanded && onOpenInEmails && (
            <button
              type="button"
              onClick={() => onOpenInEmails(email.emailLogId)}
              className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-inter text-[11.5px] text-[#5A6072]"
            >
              Open in Emails
              <ArrowUpRight size={11} />
            </button>
          )}
        </div>

        {expanded && !isReceived && email.opened && (
          <div className="mt-1.5 inline-flex items-center gap-1 font-inter text-[11px] text-[#8B8F9E]">
            <Eye size={11} />
            {email.opened}
          </div>
        )}
      </div>
    </div>
  );
}
