import { useEffect, useState } from 'react'
import { SettingsCard } from '@/components/settings/shared/SettingsCard'
import { Switch } from '@/components/ui/switch'

// TODO(notifications): wire to a real `user_notification_preferences` table.
const STORAGE_KEY = 'virgilio:notification-prefs:v2'

type Channel = 'email' | 'inapp'

interface PrefRow {
  id: string
  label: string
  email: boolean
  inapp: boolean
}

const ROWS: PrefRow[] = [
  { id: 'new_application',   label: 'New application',            email: true,  inapp: true  },
  { id: 'candidate_reply',   label: 'Candidate reply',            email: true,  inapp: true  },
  { id: 'interview_moved',   label: 'Interview scheduled or moved', email: true, inapp: true },
  { id: 'scorecard_due',     label: 'Scorecard due',              email: false, inapp: true  },
  { id: 'stage_changes',     label: 'Stage changes on my jobs',   email: false, inapp: true  },
  { id: 'weekly_digest',     label: 'Weekly pipeline digest',     email: true,  inapp: false },
]

type PrefState = Record<string, { email: boolean; inapp: boolean }>

function loadPrefs(): PrefState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as PrefState
  } catch {}
  const initial: PrefState = {}
  ROWS.forEach((r) => (initial[r.id] = { email: r.email, inapp: r.inapp }))
  return initial
}

export function NotificationsTab() {
  const [prefs, setPrefs] = useState<PrefState>(loadPrefs)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {}
  }, [prefs])

  const toggle = (id: string, channel: Channel) => {
    setPrefs((p) => ({
      ...p,
      [id]: { ...p[id], [channel]: !p[id]?.[channel] },
    }))
  }

  return (
    <SettingsCard
      title="Notifications"
      description="What reaches your inbox vs. what stays in your queue."
      bodyClassName="px-0 pb-0"
    >
      {/* Header */}
      <div className="grid grid-cols-[1fr_88px_88px] items-center px-5 pb-2 pt-1">
        <div />
        <div className="text-center font-poppins text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8F9E]">
          Email
        </div>
        <div className="text-center font-poppins text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8F9E]">
          In-app
        </div>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-[#EFEFEA] border-t border-[#EFEFEA]">
        {ROWS.map((row) => (
          <li
            key={row.id}
            className="grid grid-cols-[1fr_88px_88px] items-center px-5 py-3.5"
          >
            <div className="font-inter text-[13px] text-[#0d0d09]">{row.label}</div>
            <div className="flex justify-center">
              <Switch
                checked={!!prefs[row.id]?.email}
                onCheckedChange={() => toggle(row.id, 'email')}
              />
            </div>
            <div className="flex justify-center">
              <Switch
                checked={!!prefs[row.id]?.inapp}
                onCheckedChange={() => toggle(row.id, 'inapp')}
              />
            </div>
          </li>
        ))}
      </ul>
    </SettingsCard>
  )
}
