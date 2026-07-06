import { useState, useEffect, ReactNode } from 'react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  X,
  Check,
  Plus,
  Trash2,
  CalendarClock,
  Video,
  SlidersHorizontal,
  Clock,
  GitCommitHorizontal,
  Bell,
  CalendarRange,
} from 'lucide-react';
import { WeeklyScheduleEditor } from './WeeklyScheduleEditor';
import { SchedulePresets } from './SchedulePresets';
import { TimezoneSelector } from './TimezoneSelector';
import { cn } from '@/lib/utils';
import { BookingEventType } from '@/hooks/useBookingEventTypes';
import { WeeklySchedule, getDefaultWeeklySchedule } from '@/hooks/useBookingConfig';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

const COLOR_OPTIONS = [
  '#6F3FF5',
  '#2563EB',
  '#12B886',
  '#D97706',
  '#EF4444',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
];

interface EventTypeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventType: BookingEventType | null;
  onSave: (data: Partial<BookingEventType> & { title: string }) => void;
  onDelete?: (id: string) => void;
  isSaving: boolean;
  isDeleting?: boolean;
  parentTimezone?: string;
}

type TabKey = 'weekly-hours' | 'meeting' | 'rules';

/* -------------------------------------------------------------------------- */
/* Section primitives                                                         */
/* -------------------------------------------------------------------------- */

function SectionBlock({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h3
            className="font-poppins font-semibold text-[12px] uppercase text-[#0d0d09]"
            style={{ letterSpacing: '0.06em' }}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="font-inter text-[11.5px] text-[#8B8F9E] mt-1 leading-snug">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="bg-white border border-[#E7E8EE] rounded-[12px] p-4 space-y-4">
        {children}
      </div>
    </section>
  );
}

function FieldLabel({
  children,
  required,
  optional,
  htmlFor,
}: {
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block font-inter text-[11.5px] font-medium text-[#5A6072] mb-1.5"
    >
      {children}
      {required && <span className="text-[#DC2626] ml-0.5">*</span>}
      {optional && <span className="text-[#8B8F9E] ml-1 font-normal">(optional)</span>}
    </label>
  );
}

function FieldHelp({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 font-inter text-[11px] text-[#8B8F9E] leading-snug">{children}</p>
  );
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                          */
/* -------------------------------------------------------------------------- */

function SegmentedTabs({
  value,
  onChange,
  items,
}: {
  value: TabKey;
  onChange: (v: TabKey) => void;
  items: { key: TabKey; label: string; icon: typeof CalendarClock }[];
}) {
  return (
    <div
      className="inline-flex w-full items-center gap-1 rounded-[11px] p-[3px]"
      style={{ background: '#F1F0EC' }}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.key === value;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              'flex-1 h-[30px] rounded-[9px] inline-flex items-center justify-center gap-1.5 font-poppins font-medium text-[12px] transition-all',
              active
                ? 'bg-[#0d0d09] text-[#fffcf9] shadow-[0_2px_6px_-1px_rgba(13,13,9,0.25)]'
                : 'text-[#5A6072] hover:text-[#1F2230]'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Color swatches                                                             */
/* -------------------------------------------------------------------------- */

function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {COLOR_OPTIONS.map((c) => {
        const selected = value.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            aria-label={`Choose color ${c}`}
            onClick={() => onChange(c)}
            className="w-[26px] h-[26px] rounded-full inline-flex items-center justify-center transition-transform"
            style={{
              background: c,
              boxShadow: selected
                ? `0 0 0 2px #fff, 0 0 0 4px ${c}`
                : '0 0 0 1px rgba(13,13,9,0.06)',
            }}
          >
            {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main sheet                                                                 */
/* -------------------------------------------------------------------------- */

export function EventTypeSheet({
  open,
  onOpenChange,
  eventType,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
  parentTimezone,
}: EventTypeSheetProps) {
  const isNew = !eventType;
  const defaultTz = parentTimezone || 'UTC';

  const [tab, setTab] = useState<TabKey>('weekly-hours');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6F3FF5');
  const [isActive, setIsActive] = useState(true);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(getDefaultWeeklySchedule());
  const [timezone, setTimezone] = useState(defaultTz);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [minNoticeHours, setMinNoticeHours] = useState(24);
  const [maxDaysAhead, setMaxDaysAhead] = useState(30);
  const [meetingLocation, setMeetingLocation] = useState('');
  const [customEventTitle, setCustomEventTitle] = useState('Interview with {candidate_name}');

  useEffect(() => {
    if (eventType) {
      setTitle(eventType.title);
      setDescription(eventType.description || '');
      setColor(eventType.color || '#6F3FF5');
      setIsActive(eventType.is_active);
      setWeeklySchedule(eventType.weekly_schedule || getDefaultWeeklySchedule());
      setTimezone(eventType.timezone || defaultTz);
      setDurationMinutes(eventType.duration_minutes || 30);
      setBufferMinutes(eventType.buffer_time_minutes || 15);
      setMinNoticeHours(eventType.min_notice_hours || 24);
      setMaxDaysAhead(eventType.max_days_ahead || 30);
      setMeetingLocation(eventType.meeting_location || '');
      setCustomEventTitle(eventType.custom_event_title || 'Interview with {candidate_name}');
    } else {
      setTitle('');
      setDescription('');
      setColor('#6F3FF5');
      setIsActive(true);
      setWeeklySchedule(getDefaultWeeklySchedule());
      setTimezone(defaultTz);
      setDurationMinutes(30);
      setBufferMinutes(15);
      setMinNoticeHours(24);
      setMaxDaysAhead(30);
      setMeetingLocation('');
      setCustomEventTitle('Interview with {candidate_name}');
    }
    setTab('weekly-hours');
  }, [eventType, open, defaultTz]);

  const handleSave = () => {
    if (!title.trim()) return;
    const data: any = {
      title: title.trim(),
      description: description.trim() || null,
      color,
      is_active: isActive,
      weekly_schedule: weeklySchedule,
      timezone,
      duration_minutes: durationMinutes,
      buffer_time_minutes: bufferMinutes,
      min_notice_hours: minNoticeHours,
      max_days_ahead: maxDaysAhead,
      meeting_location: meetingLocation || null,
      custom_event_title: customEventTitle || null,
    };
    if (eventType) data.id = eventType.id;
    onSave(data);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'p-0 gap-0 flex flex-col',
          'sm:max-w-[620px] w-full h-full',
          'rounded-l-[16px] border-l-0',
          '[&>button]:hidden'
        )}
        style={{
          boxShadow: '0 24px 80px -12px rgba(13,13,9,0.2)',
          background: '#FAFAF7',
        }}
      >
        <VisuallyHidden>
          <SheetTitle>{isNew ? 'Create event type' : 'Edit event type'}</SheetTitle>
          <SheetDescription>
            {isNew
              ? 'A new booking option on your public scheduling page.'
              : 'Update hours, meeting details and booking rules for this event type.'}
          </SheetDescription>
        </VisuallyHidden>

        {/* ── Header ─────────────────────────────────────────────── */}
        <header
          className="shrink-0 bg-white px-6 pt-5 pb-4 flex items-start justify-between gap-3"
          style={{ borderBottom: '1px solid #F1F0EC' }}
        >
          <div className="min-w-0">
            <p
              className="font-inter font-semibold text-[10.5px] uppercase text-[#6F3FF5]"
              style={{ letterSpacing: '0.08em' }}
            >
              Booking · Event type
            </p>
            <h2
              className="mt-1.5 font-poppins font-semibold text-[20px] text-[#0d0d09]"
              style={{ letterSpacing: '-0.035em', lineHeight: 1.15 }}
            >
              {isNew ? 'Create event type' : 'Edit event type'}
              <span className="text-[#D7C5FB]">.</span>
            </h2>
            <p className="mt-1.5 font-inter text-[12.5px] text-[#5A6072] leading-relaxed">
              {isNew
                ? 'A new booking option on your public scheduling page.'
                : 'Update hours, meeting details and booking rules for this event type.'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="shrink-0 w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-[#5A6072] hover:bg-[#F1F0EC] hover:text-[#0d0d09] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* ── Body (scroll) ──────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          {/* Details */}
          <SectionBlock
            title="Details"
            action={
              <div className="inline-flex items-center gap-2">
                <span
                  className={cn(
                    'font-poppins font-medium text-[11.5px]',
                    isActive ? 'text-[#0B7A57]' : 'text-[#8B8F9E]'
                  )}
                >
                  {isActive ? 'Active' : 'Inactive'}
                </span>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            }
          >
            <div>
              <FieldLabel required htmlFor="et-title">Event title</FieldLabel>
              <Input
                id="et-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 30-minute intro chat"
                className="h-9"
              />
            </div>
            <div>
              <FieldLabel optional htmlFor="et-desc">Description</FieldLabel>
              <Textarea
                id="et-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Quick introductory call to discuss the role."
                rows={3}
              />
              <FieldHelp>Shown to candidates on the booking page.</FieldHelp>
            </div>
            <div>
              <FieldLabel>Color</FieldLabel>
              <ColorSwatches value={color} onChange={setColor} />
              <FieldHelp>Used as the event's dot across your calendar and booking page.</FieldHelp>
            </div>
          </SectionBlock>

          {/* Segmented tabs */}
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            items={[
              { key: 'weekly-hours', label: 'Weekly hours', icon: CalendarClock },
              { key: 'meeting', label: 'Meeting', icon: Video },
              { key: 'rules', label: 'Rules', icon: SlidersHorizontal },
            ]}
          />

          {/* ── Tab: Weekly hours ─────────────────────────────── */}
          {tab === 'weekly-hours' && (
            <>
              <SectionBlock
                title="Quick presets"
                subtitle="Start from a common schedule — you can fine-tune it below."
              >
                <SchedulePresets
                  onSelectPreset={setWeeklySchedule}
                  currentSchedule={weeklySchedule}
                />
              </SectionBlock>

              <SectionBlock title="Timezone">
                <TimezoneSelector value={timezone} onChange={setTimezone} />
              </SectionBlock>

              <SectionBlock
                title="Weekly schedule"
                subtitle="Choose the days and hours candidates can pick from."
              >
                <WeeklyScheduleEditor schedule={weeklySchedule} onChange={setWeeklySchedule} />
              </SectionBlock>
            </>
          )}

          {/* ── Tab: Meeting ───────────────────────────────────── */}
          {tab === 'meeting' && (
            <>
              <SectionBlock title="Calendar event">
                <div>
                  <FieldLabel htmlFor="et-cal-title">Calendar event title</FieldLabel>
                  <Input
                    id="et-cal-title"
                    value={customEventTitle}
                    onChange={(e) => setCustomEventTitle(e.target.value)}
                    placeholder="Interview with {candidate_name}"
                    className="h-9 font-inter"
                  />
                  <p className="mt-1.5 font-inter text-[11px] text-[#8B8F9E] leading-snug">
                    Use{' '}
                    <code
                      className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] font-mono text-[10.5px] text-[#5B21B6]"
                      style={{ background: '#F1F0EC' }}
                    >
                      {'{candidate_name}'}
                    </code>{' '}
                    to insert their name.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Meeting duration</FieldLabel>
                    <Select
                      value={String(durationMinutes)}
                      onValueChange={(v) => setDurationMinutes(Number(v))}
                    >
                      <SelectTrigger className="h-9">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#8B8F9E]" />
                          <SelectValue />
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {[15, 30, 45, 60, 90, 120].map((m) => (
                          <SelectItem key={m} value={String(m)}>
                            {m} minutes
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel>Buffer time</FieldLabel>
                    <Select
                      value={String(bufferMinutes)}
                      onValueChange={(v) => setBufferMinutes(Number(v))}
                    >
                      <SelectTrigger className="h-9">
                        <span className="inline-flex items-center gap-1.5">
                          <GitCommitHorizontal className="w-3.5 h-3.5 text-[#8B8F9E]" />
                          <SelectValue />
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 5, 10, 15, 20, 30, 45, 60].map((m) => (
                          <SelectItem key={m} value={String(m)}>
                            {m} minutes
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldHelp>Padding between meetings.</FieldHelp>
                  </div>
                </div>
              </SectionBlock>

              <SectionBlock title="Location">
                <div>
                  <FieldLabel optional htmlFor="et-loc">Meeting location</FieldLabel>
                  <div className="relative">
                    <Video className="w-3.5 h-3.5 text-[#8B8F9E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      id="et-loc"
                      value={meetingLocation}
                      onChange={(e) => setMeetingLocation(e.target.value)}
                      placeholder="e.g. Google Meet (auto-generated)"
                      className="h-9 pl-9"
                    />
                  </div>
                  <FieldHelp>Leave blank to auto-generate a Google Meet link.</FieldHelp>
                </div>
              </SectionBlock>
            </>
          )}

          {/* ── Tab: Rules ─────────────────────────────────────── */}
          {tab === 'rules' && (
            <SectionBlock title="Booking window">
              <div>
                <FieldLabel>Minimum notice</FieldLabel>
                <Select
                  value={String(minNoticeHours)}
                  onValueChange={(v) => setMinNoticeHours(Number(v))}
                >
                  <SelectTrigger className="h-9">
                    <span className="inline-flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-[#8B8F9E]" />
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 4, 8, 12, 24, 48, 72].map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h === 0 ? 'No minimum' : `${h} hour${h > 1 ? 's' : ''}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHelp>How far in advance someone must book.</FieldHelp>
              </div>
              <div>
                <FieldLabel>Maximum days ahead</FieldLabel>
                <Select
                  value={String(maxDaysAhead)}
                  onValueChange={(v) => setMaxDaysAhead(Number(v))}
                >
                  <SelectTrigger className="h-9">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarRange className="w-3.5 h-3.5 text-[#8B8F9E]" />
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {[7, 14, 30, 60, 90].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHelp>How far into the future people can book.</FieldHelp>
              </div>
            </SectionBlock>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer
          className="shrink-0 bg-white px-6 py-3 flex items-center justify-between gap-2"
          style={{ borderTop: '1px solid #F1F0EC' }}
        >
          <div>
            {!isNew && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    className="text-[#DC2626] hover:text-[#B91C1C] hover:bg-[#FEE2E2]"
                  >
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete event type?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove "{eventType?.title}". Candidates won't be
                      able to book this event type anymore.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        onDelete(eventType!.id);
                        onOpenChange(false);
                      }}
                      className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
                    >
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={isNew ? Plus : Check}
              onClick={handleSave}
              disabled={!title.trim() || isSaving}
              loading={isSaving}
            >
              {isNew ? 'Create event type' : 'Save changes'}
            </Button>
          </div>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
