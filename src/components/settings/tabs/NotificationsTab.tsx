import { SettingsCard } from '@/components/settings/shared/SettingsCard'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Loader2, Volume2 } from 'lucide-react'
import { IconTip } from '@/components/ui/tooltip'
import { previewNotificationSound } from '@/lib/notificationSound'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/usePermissions'
import { SIGN_PREF_EVENTS, useSignPrefs, type SignPref, type SignPrefEvent } from '@/lib/sign/prefs'
import {
  useNotificationPreferences,
  PREFS_CATEGORIES,
  type NotificationChannel,
  type NotificationPreferences,
} from '@/hooks/useNotificationPreferences'

const CHANNELS: { key: NotificationChannel; label: string }[] = [
  { key: 'in_app', label: 'In-app' },
  { key: 'email',  label: 'Email'  },
  { key: 'push',   label: 'Push'   },
]

/** Gio Sign: what you hear about envelopes you sent. Admins only, like the Sign module. */
function SignPrefsCard() {
  const q = useSignPrefs()
  const set = (event: SignPrefEvent, pref: SignPref) =>
    q.save.mutate(
      { event, pref },
      {
        onError: () =>
          toast.error('Couldn’t save that change', {
            description: 'It’s back to how it was.',
            action: { label: 'Retry', onClick: () => set(event, pref) },
          }),
      },
    )

  return (
    <SettingsCard
      title="Gio Sign"
      description="Envelopes you sent: when people sign, decline or open them, and when they’re about to expire."
      bodyClassName="px-0 pb-0"
    >
      <div className="grid grid-cols-[1fr_72px_72px_72px] items-center px-5 pb-2 pt-1">
        <div />
        {['In-app', 'Email'].map((l) => (
          <div key={l} className="text-center font-poppins text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8F9E]">
            {l}
          </div>
        ))}
        <div />
      </div>
      {q.isError ? (
        <div className="border-t border-[#EFEFEA] px-5 py-4 font-inter text-[12.5px] text-text-secondary">
          Couldn’t load your Sign preferences.{' '}
          <button type="button" className="font-medium text-text-primary underline underline-offset-2" onClick={() => void q.refetch()}>
            Retry
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-[#EFEFEA] border-t border-[#EFEFEA]">
          {SIGN_PREF_EVENTS.map((row) => {
            const p = q.data?.[row.event]
            return (
              <li key={row.event} className="grid grid-cols-[1fr_72px_72px_72px] items-center px-5 py-3.5">
                <div className="min-w-0 pr-4">
                  <div className="font-inter text-[13px] text-[#0d0d09]">{row.label}</div>
                  <div className="mt-0.5 font-inter text-[12px] text-[#8B8F9E]">{row.description}</div>
                </div>
                <div className="flex justify-center">
                  <Switch
                    aria-label={`${row.label}: in-app`}
                    checked={p?.in_app ?? row.defaults.in_app}
                    disabled={!p}
                    onCheckedChange={(v) => p && set(row.event, { ...p, in_app: v })}
                  />
                </div>
                <div className="flex justify-center">
                  {row.email ? (
                    <Switch
                      aria-label={`${row.label}: email`}
                      checked={p?.by_email ?? row.defaults.by_email}
                      disabled={!p}
                      onCheckedChange={(v) => p && set(row.event, { ...p, by_email: v })}
                    />
                  ) : (
                    <span className="font-inter text-[13px] text-[#B5B9C4]" aria-label="No email for this event">
                      —
                    </span>
                  )}
                </div>
                <div />
              </li>
            )
          })}
        </ul>
      )}
    </SettingsCard>
  )
}

export function NotificationsTab() {
  const { prefs, loading, update } = useNotificationPreferences()
  const { isAdmin, isPlatformAdmin } = usePermissions()

  if (loading || !prefs) {
    return (
      <SettingsCard title="Notifications">
        <div className="flex items-center justify-center py-10 text-[#8B8F9E]">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      </SettingsCard>
    )
  }

  const get = (key: string, ch: NotificationChannel) =>
    Boolean((prefs as any)[`${key}_${ch}`])

  const set = (key: string, ch: NotificationChannel, value: boolean) =>
    update({ [`${key}_${ch}`]: value } as Partial<NotificationPreferences>)

  return (
    <div className="space-y-4">
      {/* Notification matrix */}
      <SettingsCard
        title="What to notify me about"
        description="Pick how each event reaches you. Push uses your browser when enabled."
        bodyClassName="px-0 pb-0"
      >
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_72px_72px_72px] items-center px-5 pb-2 pt-1">
          <div />
          {CHANNELS.map((c) => (
            <div
              key={c.key}
              className="text-center font-poppins text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8F9E]"
            >
              {c.label}
            </div>
          ))}
        </div>

        <ul className="divide-y divide-[#EFEFEA] border-t border-[#EFEFEA]">
          {PREFS_CATEGORIES.map((row) => (
            <li
              key={row.key}
              className="grid grid-cols-[1fr_72px_72px_72px] items-center px-5 py-3.5"
            >
              <div className="min-w-0 pr-4">
                <div className="font-inter text-[13px] text-[#0d0d09]">{row.label}</div>
                <div className="font-inter text-[12px] text-[#8B8F9E] mt-0.5">
                  {row.description}
                </div>
              </div>
              {CHANNELS.map((c) => (
                <div key={c.key} className="flex justify-center">
                  <Switch
                    checked={get(row.key, c.key)}
                    onCheckedChange={(v) => set(row.key, c.key, v)}
                  />
                </div>
              ))}
            </li>
          ))}
        </ul>
      </SettingsCard>

      {(isAdmin || isPlatformAdmin) && <SignPrefsCard />}

      {/* Delivery preferences */}
      <SettingsCard
        title="Delivery"
        description="Quiet hours and sound for your notifications."
      >
        <div className="divide-y divide-[#EFEFEA] -mx-5">
          {/* Quiet hours */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-inter text-[13px] text-[#0d0d09]">Quiet hours</div>
                <div className="font-inter text-[12px] text-[#8B8F9E] mt-0.5">
                  Mute in-app sounds and push notifications during this window.
                </div>
              </div>
              <Switch
                checked={prefs.quiet_hours_enabled}
                onCheckedChange={(v) => update({ quiet_hours_enabled: v })}
              />
            </div>

            {prefs.quiet_hours_enabled && (
              <div className="mt-3 grid grid-cols-[1fr_1fr_1.4fr] gap-3">
                <label className="block">
                  <span className="block font-poppins text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8F9E] mb-1">
                    Start
                  </span>
                  <Input
                    type="time"
                    value={prefs.quiet_hours_start ?? '22:00'}
                    onChange={(e) => update({ quiet_hours_start: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="block font-poppins text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8F9E] mb-1">
                    End
                  </span>
                  <Input
                    type="time"
                    value={prefs.quiet_hours_end ?? '08:00'}
                    onChange={(e) => update({ quiet_hours_end: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="block font-poppins text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8F9E] mb-1">
                    Timezone
                  </span>
                  <Input
                    value={prefs.quiet_hours_tz}
                    onChange={(e) => update({ quiet_hours_tz: e.target.value })}
                    placeholder="e.g. Europe/Rome"
                  />
                </label>
              </div>
            )}
          </div>

          {/* The notification sound (mentions and offer approvals) */}
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-inter text-[13px] text-[#0d0d09]">Play a sound</div>
              <div className="font-inter text-[12px] text-[#8B8F9E] mt-0.5">
                Two soft taps when someone mentions you; a short run when an offer needs your approval. In the app only, and quiet during quiet hours.
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <IconTip label="Hear the sound">
                <button
                  type="button"
                  aria-label="Hear the sound"
                  onClick={() => void previewNotificationSound('mention')}
                  className="gio-pressable h-8 w-8 rounded-md flex items-center justify-center text-[#5A6072] hover:bg-[#F1F0EC] hover:text-[#0d0d09]"
                >
                  <Volume2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </IconTip>
              <Switch
                checked={prefs.sound_on_mention}
                onCheckedChange={(v) => update({ sound_on_mention: v })}
              />
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  )
}
