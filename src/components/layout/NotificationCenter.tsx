import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, Check, CheckCheck, SlidersHorizontal, ArrowLeft, ChevronRight,
  AtSign, Users2, ClipboardCheck, CalendarCheck2, FileCheck2, Briefcase,
  CalendarDays, Filter, Inbox, MessageSquare,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { useNotifications, NotificationRow, NotificationCategory } from '@/hooks/useNotifications'
import {
  useNotificationPreferences, PREFS_CATEGORIES, CategoryKey, NotificationPreferences,
} from '@/hooks/useNotificationPreferences'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftCaughtUp } from '@/components/ui/EmptyIllustrations'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Tab = 'all' | 'mentions' | 'activity'

const CATEGORY_META: Record<NotificationCategory, { label: string; icon: any; tone: string; bg: string; fg: string }> = {
  mention:             { label: 'MENTION',           icon: AtSign,         tone: 'purple', bg: '#EDE4FF', fg: '#6F3FF5' },
  application_batch:   { label: 'APPLICATION BATCH', icon: Users2,         tone: 'green',  bg: '#DCFCE7', fg: '#15803D' },
  scorecard_submitted: { label: 'SCORECARD',         icon: ClipboardCheck, tone: 'orange', bg: '#FFEDD5', fg: '#C2410C' },
  interview_event:     { label: 'INTERVIEW',         icon: CalendarCheck2, tone: 'yellow', bg: '#FEF3C7', fg: '#A16207' },
  offer_event:         { label: 'OFFER',             icon: FileCheck2,     tone: 'green',  bg: '#DCFCE7', fg: '#15803D' },
  posting_status:      { label: 'POSTING',           icon: Briefcase,      tone: 'orange', bg: '#FFE4D6', fg: '#9A3412' },
  daily_digest:        { label: 'DIGEST',            icon: CalendarDays,   tone: 'blue',   bg: '#DBEAFE', fg: '#1D4ED8' },
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return `${Math.floor(d / 7)}w`
}

function initials(name?: string | null) {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase() || '·'
}

function dateBucket(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const d = new Date(iso); const n = new Date()
  if (d.toDateString() === n.toDateString()) return 'Today'
  const y = new Date(n); y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return 'Earlier'
}

function NotificationItem({ n, onClick, onMarkRead }: {
  n: NotificationRow; onClick: () => void; onMarkRead: () => void
}) {
  const meta = CATEGORY_META[n.category]
  const Icon = meta.icon
  const isMention = n.category === 'mention'
  const unread = !n.read_at
  const isPerson = !!n.actor_user_id && (isMention || n.category === 'scorecard_submitted')

  return (
    <div className="relative group">
      {unread && <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r bg-virgilio-purple" />}
      <button
        onClick={() => { if (unread) onMarkRead(); onClick() }}
        className={cn(
          'w-full text-left px-4 py-3 transition-colors',
          'hover:bg-[#FAFAF7] focus:outline-none focus:bg-[#FAFAF7]',
        )}
      >
        <div className="flex items-start gap-3">
          {/* Avatar / Glyph */}
          <div className="relative shrink-0">
            {isPerson ? (
              <Avatar className="h-9 w-9">
                {n.actor_avatar_url && <AvatarImage src={n.actor_avatar_url} />}
                <AvatarFallback className="bg-virgilio-purple text-white text-[11px] font-semibold">
                  {initials(n.actor_name)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: meta.bg, color: meta.fg }}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              </div>
            )}
            {isPerson && (
              <div
                className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center ring-2 ring-white"
                style={{ backgroundColor: meta.bg, color: meta.fg }}
              >
                <Icon className="h-[10px] w-[10px]" strokeWidth={2.5} />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span
                className="font-poppins text-[10px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: meta.fg }}
              >
                {meta.label}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-[#8B8F9E]">{relTime(n.created_at)}</span>
                {unread && <span className="h-1.5 w-1.5 rounded-full bg-virgilio-purple" />}
              </div>
            </div>
            <p className="mt-0.5 text-[12.5px] font-inter text-virgilio-text leading-snug line-clamp-2">
              {n.title}
            </p>
            {n.subtitle && (
              <p className="mt-0.5 text-[11.5px] text-[#5A6072] truncate">{n.subtitle}</p>
            )}
            {isMention && n.preview && (
              <div className="mt-2 rounded-md bg-[#F5F0FF] px-2.5 py-2 text-[12px] text-[#3F3450] leading-snug">
                {n.preview}
              </div>
            )}
            {n.action_url && (
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-[#0d0d09] px-2.5 py-1 text-[11px] font-poppins font-medium text-[#fffcf9]">
                  {isMention ? 'Reply' : 'Open'}
                  <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  )
}

function NotificationsEmpty() {
  return (
    <div className="px-3 py-6">
      <EmptyState
        size="card"
        illustration={<SoftCaughtUp />}
        title="You're all caught up"
        body="Mentions, scorecards, and stage moves will appear here as your team works."
      />
    </div>
  )
}

function PreferencesPanel({ onBack }: { onBack: () => void }) {
  const { data: prefs, save } = useNotificationPreferences()
  const push = usePushSubscription()
  const [local, setLocal] = useState<Partial<NotificationPreferences>>({})
  const merged = { ...(prefs || {}), ...local } as NotificationPreferences

  if (!prefs) {
    return <div className="p-8 text-center text-[12px] text-[#8B8F9E]">Loading…</div>
  }

  const dirty = Object.keys(local).length > 0
  const set = (patch: Partial<NotificationPreferences>) => setLocal((l) => ({ ...l, ...patch }))
  const get = (k: CategoryKey, ch: 'in_app' | 'email' | 'push') =>
    (merged as any)[`${k}_${ch}`] as boolean
  const togglePush = async (k: CategoryKey, val: boolean) => {
    if (val && !push.subscribed) {
      const ok = await push.subscribe()
      if (!ok) { toast.error('Browser notifications not enabled'); return }
    }
    set({ [`${k}_push`]: val } as any)
  }

  const onSave = async () => {
    await save.mutateAsync(local)
    setLocal({})
    toast.success('Preferences saved')
  }

  return (
    <div className="flex flex-col h-[640px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E7E8EE]">
        <h3 className="font-poppins font-semibold text-[14px] text-virgilio-text">Preferences</h3>
        <button onClick={onBack} className="text-[12px] font-poppins text-[#5A6072] hover:text-virgilio-text flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Category table */}
        <div className="px-4 py-3">
          <div className="grid grid-cols-[1fr_44px_44px_44px] gap-2 px-1 pb-2 text-[10px] font-poppins font-semibold uppercase tracking-[0.06em] text-[#8B8F9E]">
            <div>Category</div>
            <div className="text-center">In-app</div>
            <div className="text-center">Email</div>
            <div className="text-center">Push</div>
          </div>
          <div className="divide-y divide-[#F1F0EC]">
            {PREFS_CATEGORIES.map(({ key, label, description }) => (
              <div key={key} className="grid grid-cols-[1fr_44px_44px_44px] gap-2 items-center py-2.5">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-inter font-medium text-virgilio-text truncate">{label}</div>
                  {description && <div className="text-[11px] text-[#8B8F9E] truncate">{description}</div>}
                </div>
                <div className="flex justify-center"><Switch checked={get(key, 'in_app')} onCheckedChange={(v) => set({ [`${key}_in_app`]: v } as any)} /></div>
                <div className="flex justify-center"><Switch checked={get(key, 'email')} onCheckedChange={(v) => set({ [`${key}_email`]: v } as any)} /></div>
                <div className="flex justify-center">
                  <Switch
                    checked={get(key, 'push')}
                    disabled={!push.supported || !push.configured}
                    onCheckedChange={(v) => togglePush(key, v)}
                  />
                </div>
              </div>
            ))}
          </div>
          {push.supported && !push.configured && (
            <div className="mt-2 rounded-md bg-[#FFF6D6] px-3 py-2 text-[11px] text-[#7A5B00]">
              Browser push isn't configured for this workspace yet.
            </div>
          )}
        </div>

        {/* Delivery */}
        <div className="px-4 pt-2 pb-4">
          <div className="text-[10px] font-poppins font-semibold uppercase tracking-[0.06em] text-[#8B8F9E] mb-2">Delivery</div>
          <div className="space-y-2">
            <div className="rounded-md border border-[#E7E8EE] bg-white px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12.5px] font-inter font-medium text-virgilio-text">Quiet hours</div>
                  <div className="text-[11px] text-[#8B8F9E]">Suppress email during these hours</div>
                </div>
                <Switch checked={merged.quiet_hours_enabled} onCheckedChange={(v) => set({ quiet_hours_enabled: v })} />
              </div>
              {merged.quiet_hours_enabled && (
                <div className="mt-2 flex items-center gap-2">
                  <Input type="time" value={merged.quiet_hours_start || '21:00'} onChange={(e) => set({ quiet_hours_start: e.target.value })} className="h-8 text-[12px]" />
                  <span className="text-[11px] text-[#8B8F9E]">to</span>
                  <Input type="time" value={merged.quiet_hours_end || '08:00'} onChange={(e) => set({ quiet_hours_end: e.target.value })} className="h-8 text-[12px]" />
                </div>
              )}
            </div>
            <div className="rounded-md border border-[#E7E8EE] bg-white px-3 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-[12.5px] font-inter font-medium text-virgilio-text">Play sound on new mention</div>
                <div className="text-[11px] text-[#8B8F9E]">Subtle chime, in-app only</div>
              </div>
              <Switch checked={merged.sound_on_mention} onCheckedChange={(v) => set({ sound_on_mention: v })} />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-[#E7E8EE] flex items-center justify-end bg-white">
        <Button onClick={onSave} disabled={!dirty || save.isPending} className="bg-[#0d0d09] text-[#fffcf9] hover:bg-[#0d0d09]/90 h-8 px-3 text-[12px]">
          Save changes
        </Button>
      </div>
    </div>
  )
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'feed' | 'prefs'>('feed')
  const [tab, setTab] = useState<Tab>('all')
  const navigate = useNavigate()
  const { data: notifications = [], markAsRead, markAllAsRead } = useNotifications()

  const counts = useMemo(() => {
    const unread = notifications.filter((n) => !n.read_at)
    return {
      all: unread.length,
      mentions: unread.filter((n) => n.category === 'mention').length,
      activity: unread.filter((n) => n.category !== 'mention').length,
    }
  }, [notifications])

  const filtered = useMemo(() => {
    if (tab === 'mentions') return notifications.filter((n) => n.category === 'mention')
    if (tab === 'activity') return notifications.filter((n) => n.category !== 'mention')
    return notifications
  }, [notifications, tab])

  const grouped = useMemo(() => {
    const groups: Record<string, NotificationRow[]> = { Today: [], Yesterday: [], Earlier: [] }
    filtered.forEach((n) => groups[dateBucket(n.created_at)].push(n))
    return groups
  }, [filtered])

  const handleClick = (n: NotificationRow) => {
    setOpen(false)
    if (n.action_url) navigate(n.action_url)
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setView('feed') }}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative h-8 w-8 rounded-md flex items-center justify-center text-white/80 hover:text-white hover:bg-white/8 transition-colors"
        >
          <Bell className="h-[16px] w-[16px]" strokeWidth={1.75} />
          {counts.all > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#D7C5FB] ring-2 ring-[#0d0d09]" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[440px] p-0 rounded-2xl shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)] border border-[#E7E8EE] overflow-hidden bg-white"
      >
        {view === 'prefs' ? (
          <PreferencesPanel onBack={() => setView('feed')} />
        ) : (
          <div className="flex flex-col h-[640px]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
              <div className="flex items-baseline gap-2">
                <h3 className="font-poppins font-semibold text-[18px] text-virgilio-text tracking-[-0.02em]">Notifications</h3>
                <span className="text-[11px] text-[#8B8F9E]">{counts.all} unread</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => markAllAsRead.mutate()}
                  disabled={counts.all === 0}
                  className="h-7 w-7 rounded-md flex items-center justify-center text-[#5A6072] hover:bg-[#F1F0EC] disabled:opacity-40"
                  aria-label="Mark all read"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setView('prefs')}
                  className="h-7 w-7 rounded-md flex items-center justify-center text-[#5A6072] hover:bg-[#F1F0EC]"
                  aria-label="Notification preferences"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center justify-between px-4 pb-2.5">
              <div className="flex items-center gap-1">
                {([
                  ['all', 'All', counts.all],
                  ['mentions', 'Mentions', counts.mentions],
                  ['activity', 'Activity', counts.activity],
                ] as const).map(([k, label, count]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={cn(
                      'h-7 px-2.5 rounded-md text-[12px] font-poppins font-medium flex items-center gap-1.5 transition-colors',
                      tab === k ? 'bg-[#0d0d09] text-[#fffcf9]' : 'text-[#5A6072] hover:bg-[#F1F0EC]'
                    )}
                  >
                    {label}
                    <span className={cn(
                      'min-w-[16px] h-[16px] px-1 rounded-full text-[10px] flex items-center justify-center',
                      tab === k ? 'bg-white/15 text-[#fffcf9]' : 'bg-[#F1F0EC] text-[#5A6072]'
                    )}>{count}</span>
                  </button>
                ))}
              </div>
              <button className="text-[11.5px] text-[#5A6072] hover:text-virgilio-text flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filter
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto border-t border-[#E7E8EE]">
              {filtered.length === 0 ? (
                <NotificationsEmpty />
              ) : (
                (['Today', 'Yesterday', 'Earlier'] as const).map((label) => {
                  const items = grouped[label]
                  if (!items.length) return null
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between px-4 pt-3 pb-1 sticky top-0 bg-white z-10">
                        <span className="text-[10px] font-poppins font-semibold uppercase tracking-[0.06em] text-[#8B8F9E]">{label}</span>
                        <span className="text-[10px] text-[#8B8F9E]">{items.length}</span>
                      </div>
                      <div className="divide-y divide-[#F1F0EC]">
                        {items.map((n) => (
                          <NotificationItem
                            key={n.id}
                            n={n}
                            onClick={() => handleClick(n)}
                            onMarkRead={() => markAsRead.mutate(n.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E7E8EE] bg-white">
              <button
                onClick={() => markAllAsRead.mutate()}
                disabled={counts.all === 0}
                className="text-[11.5px] font-poppins font-medium text-[#5A6072] hover:text-virgilio-text disabled:opacity-40 flex items-center gap-1"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
