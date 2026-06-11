import { useEffect, useState } from 'react'
import { SettingsCard } from '@/components/settings/shared/SettingsCard'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

// TODO(notifications): wire to a real `user_notification_preferences` table.
// For now we persist to localStorage so the toggles round-trip per browser.
const STORAGE_KEY = 'virgilio:notification-prefs:v1'

interface PrefGroup {
  id: string
  label: string
  items: { id: string; label: string; hint?: string; default: boolean }[]
}

const GROUPS: PrefGroup[] = [
  {
    id: 'candidates',
    label: 'Candidates',
    items: [
      { id: 'new_application', label: 'New application on my jobs', default: true },
      { id: 'candidate_replied', label: 'Candidate replied to my email', default: true },
      { id: 'stage_moved', label: 'Candidate moved by a teammate', default: false },
      { id: 'note_mention', label: 'I was @mentioned in a note', default: true },
    ],
  },
  {
    id: 'scheduling',
    label: 'Scheduling',
    items: [
      { id: 'interview_booked', label: 'Candidate booked an interview', default: true },
      { id: 'interview_canceled', label: 'Interview canceled or rescheduled', default: true },
      { id: 'scorecard_due', label: 'Scorecard due reminder', default: true },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'weekly_digest', label: 'Weekly recruiting digest', hint: 'Mondays, 8am local', default: true },
      { id: 'billing_alerts', label: 'Billing alerts', default: true },
      { id: 'product_updates', label: 'Product updates from Gio', default: false },
    ],
  },
]

type PrefState = Record<string, boolean>

function loadPrefs(): PrefState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as PrefState
  } catch {}
  const initial: PrefState = {}
  GROUPS.forEach((g) => g.items.forEach((i) => (initial[i.id] = i.default)))
  return initial
}

export function NotificationsTab() {
  const [prefs, setPrefs] = useState<PrefState>(loadPrefs)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {}
  }, [prefs])

  const toggle = (id: string) => {
    setPrefs((p) => {
      const next = { ...p, [id]: !p[id] }
      toast.success(next[id] ? 'Notification enabled' : 'Notification disabled')
      return next
    })
  }

  return (
    <div className="space-y-4">
      {GROUPS.map((g) => (
        <SettingsCard key={g.id} title={g.label}>
          <ul className="divide-y divide-[#EFEFEA] -mx-5">
            {g.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="font-inter text-[13px] text-[#1F2230]">{item.label}</div>
                  {item.hint && (
                    <div className="font-inter text-[11.5px] text-[#8B8F9E] mt-0.5">{item.hint}</div>
                  )}
                </div>
                <Switch
                  checked={!!prefs[item.id]}
                  onCheckedChange={() => toggle(item.id)}
                />
              </li>
            ))}
          </ul>
        </SettingsCard>
      ))}
      <p className="font-inter text-[11.5px] text-[#8B8F9E] px-1">
        Saved to this browser. Cross-device sync coming with the notifications backend.
      </p>
    </div>
  )
}
