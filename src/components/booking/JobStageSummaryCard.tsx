import { Clock, Video, Monitor, CalendarCheck } from 'lucide-react';

interface Panelist {
  name: string;
  role?: string | null;
}

interface JobStageSummaryCardProps {
  stageName?: string | null;
  jobTitle?: string | null;
  durationMinutes: number;
  description?: string | null;
  panelists?: Panelist[];
  formatLabel?: string;
}

const AVATAR_COLORS = ['#6F3FF5', '#06B6D4', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6'];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function JobStageSummaryCard({
  stageName,
  jobTitle,
  durationMinutes,
  description,
  panelists = [],
  formatLabel = 'Google Meet · link on confirm',
}: JobStageSummaryCardProps) {
  return (
    <div className="space-y-6">
      {/* Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {stageName && (
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-virgilio-purple/10 text-virgilio-purple text-[12px] font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-virgilio-purple" />
            {stageName}
          </span>
        )}
      </div>

      {/* Title */}
      <div className="space-y-1">
        <h2 className="font-poppins font-bold text-virgilio-text text-[22px] tracking-[-0.02em] leading-tight">
          {stageName || 'Interview'}
        </h2>
        {jobTitle && (
          <p className="text-virgilio-muted text-[13.5px]">{jobTitle}</p>
        )}
      </div>

      <div className="h-px bg-virgilio-border" />

      {/* Meta rows */}
      <div className="space-y-3.5">
        <MetaRow icon={Clock} label="DURATION" value={`${durationMinutes} minutes`} />
        <MetaRow icon={Video} label="FORMAT" value={formatLabel} />
        {description && (
          <MetaRow icon={Monitor} label="TO PREPARE" value={description} />
        )}
      </div>

      {panelists.length > 0 && (
        <>
          <div className="h-px bg-virgilio-border" />
          <div className="space-y-3">
            <div className="text-[10.5px] font-poppins font-semibold tracking-[0.08em] text-virgilio-muted uppercase">
              You'll meet
            </div>
            <div className="space-y-2.5">
              {panelists.map((p, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-poppins font-semibold flex-shrink-0"
                    style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                  >
                    {initials(p.name)}
                  </div>
                  <div className="leading-tight">
                    <div className="text-[13px] font-poppins font-semibold text-virgilio-text">{p.name}</div>
                    {p.role && <div className="text-[11.5px] text-virgilio-muted">{p.role}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Reschedule pill */}
      <div className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-emerald-50 text-emerald-800 text-[12.5px] font-medium">
        <CalendarCheck className="h-3.5 w-3.5" />
        Reschedule anytime up to 12h before.
      </div>
    </div>
  );
}

function MetaRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-virgilio-border/40 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-virgilio-muted" />
      </div>
      <div className="leading-tight pt-0.5">
        <div className="text-[10.5px] font-poppins font-semibold tracking-[0.08em] text-virgilio-muted uppercase">
          {label}
        </div>
        <div className="text-[13.5px] text-virgilio-text font-medium mt-0.5">{value}</div>
      </div>
    </div>
  );
}
