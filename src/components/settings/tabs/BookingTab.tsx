import { useState, useMemo } from 'react'
import {
  Copy,
  Check,
  ExternalLink,
  Plus,
  Loader2,
  AlertCircle,
  Clock,
  Link2,
  Pencil,
  Settings2,
  CalendarDays,
  Timer,
  Video,
  Bell,
  CalendarRange,
} from 'lucide-react'
import { SettingsCard } from '@/components/settings/shared/SettingsCard'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useBookingConfig } from '@/hooks/useBookingConfig'
import { useBookingEventTypes, BookingEventType } from '@/hooks/useBookingEventTypes'
import { useCalendarIdentities } from '@/hooks/useCalendarIdentities'
import { EventTypeSheet } from '@/components/settings/booking/EventTypeSheet'
import { GeneralLinkConfigurator } from '@/components/settings/booking/GeneralLinkConfigurator'
import { toast } from 'sonner'

const DAY_ORDER: (keyof import('@/hooks/useBookingConfig').WeeklySchedule)[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]
const DAY_SHORT: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

function formatTime12h(t: string) {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(m).padStart(2, '0')} ${period}`
}

function summarizeDays(schedule: import('@/hooks/useBookingConfig').WeeklySchedule): string {
  const enabled = DAY_ORDER.filter((d) => schedule[d]?.enabled)
  if (enabled.length === 0) return 'No days set'
  if (enabled.length === 7) return 'Every day'
  // Contiguous range check
  const idx = enabled.map((d) => DAY_ORDER.indexOf(d))
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  if (contiguous) return `${DAY_SHORT[enabled[0]]}–${DAY_SHORT[enabled[enabled.length - 1]]}`
  return enabled.map((d) => DAY_SHORT[d]).join(', ')
}

function summarizeHours(schedule: import('@/hooks/useBookingConfig').WeeklySchedule): string | null {
  const enabled = DAY_ORDER.filter((d) => schedule[d]?.enabled)
  if (enabled.length === 0) return null
  const first = schedule[enabled[0]]
  const uniform = enabled.every(
    (d) => schedule[d].start === first.start && schedule[d].end === first.end
  )
  if (uniform) return `${formatTime12h(first.start)} – ${formatTime12h(first.end)}`
  return 'Custom hours'
}

export function BookingTab() {
  const {
    config,
    isLoading,
    updateConfig,
    isUpdating,
    bookingUrl,
    needsProfileCompletion,
    isCreating,
  } = useBookingConfig()
  const { identities } = useCalendarIdentities()
  const {
    eventTypes,
    isLoading: isLoadingEventTypes,
    createEventType,
    updateEventType,
    deleteEventType,
    isCreating: isCreatingEventType,
    isUpdating: isUpdatingEventType,
    isDeleting: isDeletingEventType,
  } = useBookingEventTypes(config?.id)

  const [copied, setCopied] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingEventType, setEditingEventType] = useState<BookingEventType | null>(null)
  const [isConfiguring, setIsConfiguring] = useState(false)

  const hasCalendar = identities && identities.length > 0

  if (isLoading || isCreating) {
    return (
      <SettingsCard
        title="Booking link"
        description="Your public scheduling page — share it with candidates and clients."
      >
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[#8B8F9E]" />
        </div>
      </SettingsCard>
    )
  }

  if (needsProfileCompletion) {
    return (
      <SettingsCard
        title="Booking link"
        description="Your public scheduling page — share it with candidates and clients."
      >
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Profile incomplete</AlertTitle>
          <AlertDescription>
            Add your first and last name in Profile before creating a booking link.
          </AlertDescription>
        </Alert>
      </SettingsCard>
    )
  }

  if (!config || !bookingUrl) return null

  const handleCopyMain = async () => {
    await navigator.clipboard.writeText(bookingUrl)
    setCopied(true)
    toast.success('Booking link copied')
    setTimeout(() => setCopied(false), 1500)
  }

  const handleToggleActive = () => {
    if (!hasCalendar && !config.is_active) {
      toast.error('Connect a calendar first to activate your booking link')
      return
    }
    updateConfig({ is_active: !config.is_active })
  }

  const handleOpenCreate = () => {
    setEditingEventType(null)
    setSheetOpen(true)
  }

  const handleOpenEdit = (et: BookingEventType) => {
    setEditingEventType(et)
    setSheetOpen(true)
  }

  const handleDuplicate = (et: BookingEventType) => {
    createEventType({
      title: `${et.title} (copy)`,
      description: et.description || undefined,
      color: et.color,
      duration_minutes: et.duration_minutes,
      buffer_time_minutes: et.buffer_time_minutes,
      min_notice_hours: et.min_notice_hours,
      max_days_ahead: et.max_days_ahead,
      meeting_location: et.meeting_location || undefined,
      custom_event_title: et.custom_event_title || undefined,
      weekly_schedule: et.weekly_schedule,
      timezone: et.timezone,
    })
  }

  const handleSave = (data: Partial<BookingEventType> & { title: string }) => {
    if (data.id) {
      updateEventType(data as any, { onSuccess: () => setSheetOpen(false) })
    } else {
      createEventType(data, { onSuccess: () => setSheetOpen(false) })
    }
  }

  const displayUrl = bookingUrl.replace(/^https?:\/\//, '')

  return (
    <>
      <div className="space-y-4">
        {/* === Booking link card === */}
        <SettingsCard
          title="Booking link"
          description="Your public scheduling page — share it with candidates and clients."
          action={
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-2 h-[22px] rounded-md font-inter font-semibold text-[10.5px]"
                style={{
                  background: config.is_active ? '#E5F4EC' : '#F1F0EC',
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
                onCheckedChange={handleToggleActive}
                disabled={isUpdating || (!hasCalendar && !config.is_active)}
              />
            </div>
          }
        >
          <div className="flex items-center gap-2">
            <div
              className="flex-1 min-w-0 h-9 px-3 flex items-center rounded-lg font-mono text-[12px] text-[#0d0d09] truncate"
              style={{ background: '#F6F5F1' }}
            >
              {displayUrl}
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={copied ? Check : Copy}
              onClick={handleCopyMain}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={ExternalLink}
              onClick={() => window.open(bookingUrl, '_blank')}
            >
              Open
            </Button>
          </div>
        </SettingsCard>

        {/* === General availability & rules === */}
        {isConfiguring ? (
          <GeneralLinkConfigurator
            config={config}
            isUpdating={isUpdating}
            hasCalendar={hasCalendar}
            onToggleActive={handleToggleActive}
            onSave={(updates) => updateConfig(updates)}
            onBack={() => setIsConfiguring(false)}
          />
        ) : (
          <SettingsCard
            title="General availability & rules"
            description="The hours and rules behind your general link — also applied to every job, candidate and stage-specific link you generate."
            bodyClassName="px-0 py-0"
          >
            <div className="flex items-center gap-4 px-[18px] py-[14px]">
              <div className="flex-1 min-w-0 flex flex-wrap items-center gap-y-[9px] gap-x-[20px]">
                {(() => {
                  const daysStr = summarizeDays(config.weekly_schedule)
                  const hoursStr = summarizeHours(config.weekly_schedule)
                  const facts: { icon: typeof Clock; text: string }[] = []
                  facts.push({ icon: CalendarDays, text: daysStr })
                  if (hoursStr) facts.push({ icon: Clock, text: hoursStr })
                  facts.push({ icon: Timer, text: `${config.duration_minutes} min slots` })
                  facts.push({
                    icon: Video,
                    text: config.meeting_location?.trim() || 'Google Meet',
                  })
                  if (config.min_notice_hours > 0) {
                    facts.push({
                      icon: Bell,
                      text: `${config.min_notice_hours}h min notice`,
                    })
                  }
                  facts.push({
                    icon: CalendarRange,
                    text: `${config.max_days_ahead}-day window`,
                  })
                  return facts.map((f, i) => {
                    const Icon = f.icon
                    return (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 font-inter text-[12px] text-[#5A6072]"
                      >
                        <Icon className="w-[13px] h-[13px] text-[#8B8F9E]" />
                        {f.text}
                      </span>
                    )
                  })
                })()}
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={Settings2}
                onClick={() => setIsConfiguring(true)}
              >
                Configure
              </Button>
            </div>
          </SettingsCard>
        )}

        {/* === Event types card === */}
        <SettingsCard
          title="Event types"
          description="Each event type carries its own weekly hours, meeting settings and booking rules."
          action={
            <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreate}>
              Create event type
            </Button>
          }
          bodyClassName="px-0 pb-0"
        >
          {isLoadingEventTypes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#8B8F9E]" />
            </div>
          ) : eventTypes.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="font-poppins text-[13px] font-medium text-[#0d0d09]">
                No event types yet
              </p>
              <p className="font-inter text-[12px] text-[#5A6072] mt-1">
                Create your first event type to let candidates pick what to book.
              </p>
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" size="sm" icon={Plus} onClick={handleOpenCreate}>
                  Create event type
                </Button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-[#F1F0EC]">
              {eventTypes.map((et) => {
                const eventUrl = `${bookingUrl}/${et.slug}`
                return (
                  <li
                    key={et.id}
                    className="group flex items-center gap-3 px-[18px] py-[13px] hover:bg-[#FAFAF7] transition-colors"
                  >
                    {/* Color tile */}
                    <span
                      className="w-[30px] h-[30px] rounded-[8px] shrink-0 flex items-center justify-center"
                      style={{ background: `${et.color}1A` }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: et.color }}
                      />
                    </span>

                    {/* Title + description */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-inter text-[12.5px] font-semibold text-[#0d0d09] truncate"
                        style={{ letterSpacing: '-0.005em' }}
                      >
                        {et.title}
                      </p>
                      {et.description && (
                        <p className="font-inter text-[11px] text-[#8B8F9E] truncate mt-0.5">
                          {et.description}
                        </p>
                      )}
                    </div>

                    {/* Duration meta */}
                    <span className="hidden sm:inline-flex shrink-0 items-center gap-1 font-inter text-[11.5px] text-[#5A6072]">
                      <Clock className="w-3 h-3 text-[#8B8F9E]" />
                      {et.duration_minutes}m
                    </span>

                    {/* Status chip */}
                    <button
                      type="button"
                      onClick={() =>
                        updateEventType({ id: et.id, is_active: !et.is_active } as any)
                      }
                      disabled={isUpdatingEventType}
                      className="inline-flex items-center gap-1.5 px-2 h-[22px] rounded-md font-inter font-semibold text-[10.5px] transition-colors"
                      style={{
                        background: et.is_active ? '#E5F4EC' : '#F1F0EC',
                        color: et.is_active ? '#0B7A57' : '#5A6072',
                        letterSpacing: '0.02em',
                      }}
                      aria-label={et.is_active ? 'Deactivate' : 'Activate'}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: et.is_active ? '#12B886' : '#8B8F9E' }}
                      />
                      {et.is_active ? 'Active' : 'Off'}
                    </button>

                    {/* Duplicate */}
                    <Button
                      variant="ghost"
                      size="xs"
                      iconOnly
                      icon={Copy}
                      aria-label="Duplicate event type"
                      onClick={() => handleDuplicate(et)}
                    />
                    {/* Copy link */}
                    <Button
                      variant="ghost"
                      size="xs"
                      iconOnly
                      icon={Link2}
                      aria-label="Copy direct link"
                      onClick={() => {
                        navigator.clipboard.writeText(eventUrl)
                        toast.success('Event type link copied')
                      }}
                    />
                    {/* Edit */}
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Pencil}
                      onClick={() => handleOpenEdit(et)}
                    >
                      Edit
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </SettingsCard>
      </div>

      <EventTypeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        eventType={editingEventType}
        onSave={handleSave}
        onDelete={(id) => deleteEventType(id)}
        isSaving={isCreatingEventType || isUpdatingEventType}
        isDeleting={isDeletingEventType}
        parentTimezone={config?.timezone}
      />
    </>
  )
}
