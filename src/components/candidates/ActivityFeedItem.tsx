import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Paperclip } from 'lucide-react';
import { Activity } from '@/hooks/useActivityFeed';
import { activityMeta, ACTIVITY_TONES } from '@/lib/activityRegistry';
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

/** Bordered card — for someone's words. */
function BodyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-2 rounded-[8px] border border-[#E7E8EE] bg-white px-3 py-2.5 font-inter text-[12.5px] leading-[1.55] text-[#1F2230] break-words"
    >
      {children}
    </div>
  );
}

/** Plain lines — for the system's facts. */
function DetailLines({ lines }: { lines: (string | null | undefined)[] }) {
  const visible = lines.filter(Boolean) as string[];
  if (visible.length === 0) return null;
  return (
    <div className="mt-1.5 font-inter text-[11.5px] leading-[1.5] text-[#5A6072]">
      {visible.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

export function ActivityFeedItem({ activity, isLast }: ActivityFeedItemProps) {
  const meta = activityMeta(activity.activity_type);
  const Icon = meta.icon;
  const tone = ACTIVITY_TONES[meta.tone];
  const [expanded, setExpanded] = useState(false);

  const authorName =
    (activity.author_first_name || activity.author_last_name)
      ? `${activity.author_first_name || ''} ${activity.author_last_name || ''}`.trim()
      : activity.metadata?.author_name
        || activity.author_email?.split('@')[0]
        || 'System';

  const isEmail = EMAIL_TYPES.has(activity.activity_type);
  const isReceived = activity.activity_type === 'candidate_email_received';
  const md = activity.metadata || {};

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

    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    return {
      subject: body.subject || md.subject || null,
      counterparty,
      preview,
      mainHtml,
      isHtml: split.isHtml,
      plain,
      attachments,
    };
  }, [isEmail, isReceived, activity.emailBody, md]);

  // ---- Title ------------------------------------------------------------
  let title: string = activity.title;
  if (isEmail && email) {
    title = email.subject
      ? email.subject
      : isReceived
        ? 'Email received'
        : 'Email sent';
  } else if (activity.activity_type === 'candidate_stage_changed' && md.to_stage) {
    title = md.from_stage ? `${md.from_stage} → ${md.to_stage}` : `Moved to ${md.to_stage}`;
  }

  // ---- Detail lines (system facts) --------------------------------------
  const detailLines: (string | null)[] = [];
  if (activity.activity_type === 'candidate_stage_changed') {
    if (md.job_title) detailLines.push(md.job_title);
  } else if (isEmail && email) {
    if (email.counterparty) {
      detailLines.push(`${isReceived ? 'From' : 'To'} ${email.counterparty}`);
    }
  } else if (activity.activity_type === 'interview_rescheduled') {
    if (md.previous_time || md.new_time) {
      detailLines.push(
        [md.previous_time, md.new_time].filter(Boolean).join(' → ')
      );
    }
    if (activity.description) detailLines.push(activity.description);
  } else if (activity.description) {
    detailLines.push(activity.description);
  }

  // ---- Quoted content (someone's words) ---------------------------------
  const quoted: string | null =
    activity.activity_type === 'candidate_note_added'
      ? (md.note || md.content || activity.description || null)
      : activity.activity_type === 'candidate_stage_changed'
        ? (md.note || null)
        : activity.activity_type === 'scorecard_submitted'
          ? (md.feedback || md.summary || null)
          : null;

  const when = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });

  return (
    <div className={`relative flex gap-[14px] ${isLast ? 'pb-0' : 'pb-[18px]'}`}>
      {!isLast && (
        <div className="absolute left-[13px] top-[30px] bottom-0 w-px bg-[#E7E8EE]" />
      )}

      <div
        className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: tone.bg, color: tone.fg }}
      >
        <Icon size={13} strokeWidth={2.25} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-inter text-[13px] font-medium text-[#1F2230] break-words">
            {title}
          </span>
          <span className="font-inter text-[11px] text-[#8B8F9E]">
            · {authorName} · {when}
          </span>
        </div>

        <DetailLines lines={detailLines} />

        {quoted && <BodyBlock>{quoted}</BodyBlock>}

        {isEmail && email && (
          <>
            <BodyBlock>
              {expanded ? (
                email.isHtml && email.mainHtml ? (
                  <div
                    className="[&_a]:text-virgilio-purple [&_img]:max-w-full break-words"
                    dangerouslySetInnerHTML={{ __html: email.mainHtml }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap break-words">
                    {email.plain || email.preview}
                  </div>
                )
              ) : (
                <div className="line-clamp-2">{email.preview}</div>
              )}
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="mt-1.5 font-inter text-[11.5px] font-medium text-virgilio-purple hover:underline"
              >
                {expanded ? 'See less' : 'See more'}
              </button>
            </BodyBlock>

            {email.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {email.attachments.map((att: any, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-[6px] border border-[#E7E8EE] bg-white px-2 py-1 font-inter text-[11px] text-[#5A6072]"
                  >
                    <Paperclip size={10} />
                    {att?.filename || att?.name || 'Attachment'}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {activity.activity_type === 'candidate_attachment_uploaded' && md.file_name && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-[6px] border border-[#E7E8EE] bg-white px-2 py-1 font-inter text-[11px] text-[#5A6072]">
              <Paperclip size={10} />
              {md.file_name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
