import { useState } from 'react'
import { Copy, Check, ExternalLink, Plus, Info, Loader2, AlertCircle } from 'lucide-react'
import { SettingsCard } from '@/components/settings/shared/SettingsCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useBookingConfig } from '@/hooks/useBookingConfig'
import { useBookingEventTypes, BookingEventType } from '@/hooks/useBookingEventTypes'
import { useCalendarIdentities } from '@/hooks/useCalendarIdentities'
import { EventTypeSheet } from '@/components/settings/booking/EventTypeSheet'
import { toast } from 'sonner'

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

  const hasCalendar = identities && identities.length > 0

  if (isLoading || isCreating) {
    return (
      <SettingsCard title="Booking link" description="Your public scheduling page — share it with candidates and clients.">
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[#8B8F9E]" />
        </div>
      </SettingsCard>
    )
  }

  if (needsProfileCompletion) {
    return (
      <SettingsCard title="Booking link" description="Your public scheduling page — share it with candidates and clients.">
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

  const handleSave = (data: Partial<BookingEventType> & { title: string }) => {
    if (data.id) {
      updateEventType(data as any, { onSuccess: () => setSheetOpen(false) })
    } else {
      createEventType(data, { onSuccess: () => setSheetOpen(false) })
    }
  }

  // Display URL without protocol for the input
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
              <Badge
                tone={config.is_active ? 'green' : 'neutral'}
                size="sm"
                dot={false}
              >
                {config.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Switch
                checked={config.is_active}
                onCheckedChange={handleToggleActive}
                disabled={isUpdating || (!hasCalendar && !config.is_active)}
              />
            </div>
          }
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 h-9 px-3 flex items-center rounded-lg bg-[#F7F7F4] border border-[#EFEFEA] font-mono text-[12.5px] text-[#0d0d09] truncate">
              {displayUrl}
            </div>
            <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={handleCopyMain}>
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

        {/* === Event types card === */}
        <SettingsCard
          title="Event types"
          description="Each event type carries its own weekly hours, meeting settings and booking rules."
          action={
            <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreate}>
              Create event type
            </Button>
          }
          footer={
            <div className="flex items-start gap-2 text-[12px] text-[#5A6072] font-inter leading-relaxed">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#8B8F9E]" />
              <p>
                Editing opens the event sheet: Weekly hours (presets · per-event timezone) · Meeting (calendar title with{' '}
                <span className="font-mono text-[11.5px]">{'{candidate_name}'}</span>, duration, buffer, location — Google Meet auto-generated) · Rules (minimum notice, max days ahead).
              </p>
            </div>
          }
          bodyClassName="px-0 pb-0"
        >
          {isLoadingEventTypes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#8B8F9E]" />
            </div>
          ) : eventTypes.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="font-poppins text-[13px] font-medium text-[#0d0d09]">No event types yet</p>
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
            <ul className="divide-y divide-[#EFEFEA]">
              {eventTypes.map((et) => {
                const eventUrl = `${bookingUrl}/${et.slug}`
                return (
                  <li
                    key={et.id}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAF7] transition-colors"
                  >
                    {/* Color dot */}
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: et.color }}
                    />
                    {/* Title + description */}
                    <div className="flex-1 min-w-0">
                      <p className="font-poppins text-[13px] font-medium text-[#0d0d09] truncate">
                        {et.title}
                      </p>
                      {et.description && (
                        <p className="font-inter text-[12px] text-[#5A6072] truncate">
                          {et.description}
                        </p>
                      )}
                    </div>
                    {/* Duration pill */}
                    <span className="shrink-0 h-[22px] px-2 rounded-md bg-[#F1F0EC] flex items-center font-poppins text-[11px] font-medium text-[#5A6072]">
                      {et.duration_minutes}m
                    </span>
                    {/* Copy direct link */}
                    <Button
                      variant="ghost"
                      size="xs"
                      iconOnly
                      icon={Copy}
                      aria-label="Copy direct link"
                      onClick={() => {
                        navigator.clipboard.writeText(eventUrl)
                        toast.success('Event type link copied')
                      }}
                    />
                    {/* Active toggle */}
                    <Switch
                      checked={et.is_active}
                      onCheckedChange={(checked) =>
                        updateEventType({ id: et.id, is_active: checked } as any)
                      }
                      disabled={isUpdatingEventType}
                    />
                    {/* Edit */}
                    <Button variant="link" size="sm" onClick={() => handleOpenEdit(et)}>
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
