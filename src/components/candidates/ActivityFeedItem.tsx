import { formatDistanceToNow } from 'date-fns';
import { Paperclip, Zap } from 'lucide-react';
import { Activity } from '@/hooks/useActivityFeed';
import { activityMeta, ACTIVITY_TONES, isAutomated } from '@/lib/activityRegistry';
import { ActivityEmailCard } from './ActivityEmailCard';

interface ActivityFeedItemProps {
  activity: Activity;
  isLast?: boolean;
  onOpenInEmails?: (emailLogId: string) => void;
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

/** Bordered card — for someone's words. */
function BodyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-[8px] border border-[#E7E8EE] bg-white px-3 py-2.5 font-inter text-[12.5px] leading-[1.55] text-[#1F2230] break-words">
      {children}
    </div>
  );
}

export function ActivityFeedItem({ activity, isLast, onOpenInEmails }: ActivityFeedItemProps) {
  const meta = activityMeta(activity.activity_type);
  const Icon = meta.icon;
  const tone = ACTIVITY_TONES[meta.tone];

  const automated = isAutomated(activity);
  const automation = activity.automation || null;

  const authorName = automated
    ? 'Gio'
    : (activity.author_first_name || activity.author_last_name)
      ? `${activity.author_first_name || ''} ${activity.author_last_name || ''}`.trim()
      : activity.metadata?.author_name
        || activity.author_email?.split('@')[0]
        || 'System';

  const md = activity.metadata || {};
  const email = activity.email || null;

  // ---- Title ------------------------------------------------------------
  let title: string = activity.title;
  if (email) {
    title = email.subject;
  } else if (activity.activity_type === 'candidate_stage_changed' && md.to_stage) {
    title = md.from_stage ? `${md.from_stage} → ${md.to_stage}` : `Moved to ${md.to_stage}`;
  }

  // ---- Detail lines (system facts) --------------------------------------
  const detailLines: (string | null)[] = [];
  if (activity.activity_type === 'candidate_stage_changed') {
    if (md.job_title) detailLines.push(md.job_title);
  } else if (email) {
    // The card carries the participants; nothing to repeat here.
  } else if (activity.activity_type === 'interview_rescheduled') {
    if (md.previous_time || md.new_time) {
      detailLines.push([md.previous_time, md.new_time].filter(Boolean).join(' → '));
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
          {automated && (
            <span
              className="inline-flex items-center gap-1 font-inter text-[10.5px] font-semibold"
              style={{
                backgroundColor: '#FEF3C7',
                color: '#8A5306',
                borderRadius: 999,
                padding: '2px 7px 2px 5px',
              }}
            >
              <Zap size={9} />
              {automation?.name ? `Automated · ${automation.name}` : 'Automated'}
            </span>
          )}
        </div>

        {automation?.step && (
          <div className="mt-0.5 font-inter text-[11px] text-[#8B8F9E]">{automation.step}</div>
        )}

        <DetailLines lines={detailLines} />

        {quoted && <BodyBlock>{quoted}</BodyBlock>}

        {email && <ActivityEmailCard email={email} onOpenInEmails={onOpenInEmails} />}

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
