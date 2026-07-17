import { useState, useEffect, ReactNode } from 'react'
import {
  ChevronLeft,
  Check,
  Link as LinkIcon,
  Clock,
  Video,
  ShieldCheck,
  Bell,
  CalendarRange,
  GitCommitHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { BookingConfig, WeeklySchedule } from '@/hooks/useBookingConfig'
import { WeeklyScheduleEditor } from './WeeklyScheduleEditor'
import { TimezoneSelector } from './TimezoneSelector'

type TabKey = 'availability' | 'meeting' | 'rules'

interface Props {
  config: BookingConfig
  isUpdating: boolean
  hasCalendar: boolean
  onToggleActive: () => void
  onSave: (updates: Partial<BookingConfig>) => void
  onBack: () => void
}

function SegmentedTabs({
  value,
  onChange,
}: {
  value: TabKey
  onChange: (v: TabKey) => void
}) {
  const items: { key: TabKey; label: string; icon: typeof Clock }[] = [
    { key: 'availability', label: 'Availability', icon: Clock },
    { key: 'meeting', label: 'Meeting', icon: Video },
    { key: 'rules', label: 'Booking rules', icon: ShieldCheck },
  ]
  return (
    <div
      className="inline-flex items-center gap-1 rounded-[10px] p-[3px]"
      style={{ background: '#F1F0EC' }}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.key === value
        const Icon = item.icon
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              'h-[32px] px-3.5 rounded-[8px] inline-flex items-center justify-center gap-1.5 font-inter text-[12.5px] transition-all',
              active
                ? 'bg-[#0d0d09] text-[#fffcf9] font-semibold'
                : 'text-[#5A6072] hover:text-[#1F2230] font-medium'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function SettingRow({
  label,
  hint,
  children,
  last,
}: {
  label: string
  hint?: string
  children: ReactNode
  last?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-6 px-[18px] py-[13px]',
        !last && 'border-b border-[#F1F0EC]'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-inter text-[12.5px] font-medium text-[#1F2230]">
          {label}
        </p>
        {hint && (
          <p className="font-inter text-[11px] text-[#8B8F9E] mt-0.5 leading-snug">
            {hint}
          </p>
        )}
      </div>
      <div className="shrink-0 w-[220px]">{children}</div>
    </div>
  )
}

export function GeneralLinkConfigurator({
  config,
  isUpdating,
  hasCalendar,
  onToggleActive,
  onSave,
  onBack,
}: Props) {
  const [tab, setTab] = useState<TabKey>('availability')

  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(config.weekly_schedule)
  const [timezone, setTimezone] = useState<string>(config.timezone)
  const [durationMinutes, setDurationMinutes] = useState<number>(config.duration_minutes)
  const [meetingLocation, setMeetingLocation] = useState<string>(config.meeting_location || '')
  const [minNoticeHours, setMinNoticeHours] = useState<number>(config.min_notice_hours)
  const [maxDaysAhead, setMaxDaysAhead] = useState<number>(config.max_days_ahead)
  const [bufferMinutes, setBufferMinutes] = useState<number>(config.buffer_time_minutes)

  useEffect(() => {
    setWeeklySchedule(config.weekly_schedule)
    setTimezone(config.timezone)
    setDurationMinutes(config.duration_minutes)
    setMeetingLocation(config.meeting_location || '')
    setMinNoticeHours(config.min_notice_hours)
    setMaxDaysAhead(config.max_days_ahead)
    setBufferMinutes(config.buffer_time_minutes)
  }, [config.id])

  const handleSave = () => {
    onSave({
      weekly_schedule: weeklySchedule,
      timezone,
      duration_minutes: durationMinutes,
      meeting_location: meetingLocation || null,
      min_notice_hours: minNoticeHours,
      max_days_ahead: maxDaysAhead,
      buffer_time_minutes: bufferMinutes,
    })
    onBack()
  }

  return (
    <section
      className="bg-white border border-[#E7E8EE] rounded-xl overflow-hidden"
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-[18px] py-[14px]"
        style={{ borderBottom: '1px solid #F1F0EC' }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="w-8 h-8 rounded-lg inline-flex items-center justify-center border border-[#E7E8EE] text-[#5A6072] hover:bg-[#FAFAF7] hover:text-[#0d0d09] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span
          className="w-[34px] h-[34px] rounded-[9px] inline-flex items-center justify-center shrink-0"
          style={{ background: '#EDE4FF' }}
        >
          <LinkIcon className="w-4 h-4" style={{ color: '#6F3FF5' }} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="font-poppins font-semibold text-[14px] text-[#0d0d09]"
            style={{ letterSpacing: '-0.01em' }}
          >
            General booking link
          </p>
          <p className="font-inter text-[11.5px] text-[#8B8F9E] mt-0.5">
            Defaults for job, candidate &amp; stage-specific links.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="inline-flex items-center gap-1.5 px-2 h-[22px] rounded-md font-inter font-semibold text-[10.5px]"
            style={{
              background: config.is_active ? '#D1FAE5' : '#F1F0EC',
              color: config.is_active ? '#0B7A57' : '#5A6072',
              letterSpacing: '0.02em',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: config.is_active ? '#12B886' : '#8B8F9E' }}
            />
            {config.is_active ? 'Active' : 'Inactive'}
          </span>
          <Switch
            checked={config.is_active}
            onCheckedChange={onToggleActive}
            disabled={isUpdating || (!hasCalendar && !config.is_active)}
          />
        </div>
      </header>

      {/* Tab bar */}
      <div
        className="px-[18px] py-[12px]"
        style={{ borderBottom: '1px solid #F1F0EC' }}
      >
        <SegmentedTabs value={tab} onChange={setTab} />
      </div>

      {/* Tab content */}
      <div>
        {tab === 'availability' && (
          <div className="px-[18px] py-[16px] space-y-4">
            <div>
              <p className="font-inter text-[11.5px] font-medium text-[#5A6072] mb-2">
                Time zone
              </p>
              <TimezoneSelector value={timezone} onChange={setTimezone} />
            </div>
            <div>
              <p className="font-inter text-[11.5px] font-medium text-[#5A6072] mb-2">
                Weekly hours
              </p>
              <WeeklyScheduleEditor
                schedule={weeklySchedule}
                onChange={setWeeklySchedule}
              />
            </div>
          </div>
        )}

        {tab === 'meeting' && (
          <div>
            <SettingRow
              label="Default duration"
              hint="Length of a slot on your general booking link."
            >
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
            </SettingRow>
            <SettingRow
              label="Location"
              hint="Where the meeting takes place. Leave blank to auto-generate a Google Meet link."
              last
            >
              <div className="relative">
                <Video className="w-3.5 h-3.5 text-[#8B8F9E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  placeholder="e.g. Google Meet (auto)"
                  className="h-9 pl-9"
                />
              </div>
            </SettingRow>
          </div>
        )}

        {tab === 'rules' && (
          <div>
            <SettingRow
              label="Minimum notice"
              hint="How far in advance someone must book."
            >
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
            </SettingRow>
            <SettingRow
              label="Booking window"
              hint="How far into the future candidates can schedule."
            >
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
            </SettingRow>
            <SettingRow
              label="Buffer time"
              hint="Padding held around each meeting."
              last
            >
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
                      {m === 0 ? 'None' : `${m} minutes`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer
        className="flex items-center justify-end gap-2 px-[18px] py-[12px]"
        style={{ borderTop: '1px solid #F1F0EC', background: '#FAFAF7' }}
      >
        <Button variant="secondary" size="sm" onClick={onBack}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={Check}
          onClick={handleSave}
          loading={isUpdating}
        >
          Save changes
        </Button>
      </footer>
    </section>
  )
}
