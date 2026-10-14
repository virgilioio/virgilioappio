import { Badge } from '@/components/ui/badge'
import { IconTip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  appName,
  effectiveGrants,
  personInitials,
  personState,
  roleLabel,
  type Grant,
  type Person,
} from '@/lib/os/peopleAccess'

/** Same-size initials; the photo fades in over them once loaded. */
export function PersonAvatar({ person, size = 28 }: { person: Person; size?: number }) {
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EDE4FF] font-inter font-semibold text-[#6F3FF5]"
      style={{ width: size, height: size, fontSize: Math.max(10.5, Math.round(size * 0.38)) }}
    >
      {personInitials(person)}
      {person.avatar_url && (
        <img
          src={person.avatar_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-200"
          onLoad={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
    </span>
  )
}

const STATE_TONE = { active: 'green', invited: 'blue', deactivated: 'neutral' } as const
const STATE_LABEL = { active: 'Active', invited: 'Invited', deactivated: 'Deactivated' } as const

export function PersonStateBadge({ person }: { person: Person }) {
  const state = personState(person)
  return (
    <Badge tone={STATE_TONE[state]} dot>
      {STATE_LABEL[state]}
    </Badge>
  )
}

function grantNote(g: Grant): string | null {
  if (g.app === 'ats') return null
  if (g.status === 'pending') return 'Saved. It reaches the app once the app is connected to People & Access.'
  if (g.status === 'error') return g.sync_error ?? "The app couldn't apply this."
  return null
}

/** One chip per app the person can open: "Gio Sales · Rep". */
export function AccessChips({ person, className }: { person: Person; className?: string }) {
  const grants = effectiveGrants(person)
  return (
    <span className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {grants.map((g) => {
        const note = grantNote(g)
        const chip = (
          <Badge
            key={g.app}
            tone={g.status === 'error' ? 'red' : g.status === 'pending' ? 'neutral' : 'lilac'}
            className="whitespace-nowrap"
          >
            {appName(g.app)} · {roleLabel(g.app, g.role)}
            {g.status === 'pending' && <span className="ml-1 opacity-70">· waiting</span>}
          </Badge>
        )
        return note ? (
          <IconTip key={g.app} label={note}>
            <span tabIndex={0} className="inline-flex rounded-full">
              {chip}
            </span>
          </IconTip>
        ) : (
          chip
        )
      })}
    </span>
  )
}

const GOOGLE = {
  connected: { dot: 'bg-[#12B886]', label: 'Connected' },
  reconnect: { dot: 'bg-[#F59E0B]', label: 'Needs reconnecting' },
  not_connected: { dot: 'bg-[#B5B9C4]', label: 'Not connected' },
} as const

export function GoogleStatus({ person, showEmail = false }: { person: Person; showEmail?: boolean }) {
  const s = GOOGLE[person.google_status] ?? GOOGLE.not_connected
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 font-inter text-[12px] text-[#1F2230]">
      <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.dot)} />
      <span className="whitespace-nowrap">{s.label}</span>
      {showEmail && person.google_email && (
        <span className="truncate text-[11.5px] text-[#6B7080]">{person.google_email}</span>
      )}
    </span>
  )
}

export function JobCounts({ person }: { person: Person }) {
  if (person.active_jobs === 0 && person.closed_jobs === 0) {
    return <span className="font-inter text-[12px] text-[#6B7080]">No jobs</span>
  }
  return (
    <span className="font-inter text-[12px] tabular-nums text-[#1F2230]">
      {person.active_jobs} active
      {person.closed_jobs > 0 && <span className="text-[#6B7080]"> · {person.closed_jobs} closed</span>}
    </span>
  )
}
