import { BriefcaseBusiness, Coins, FileSignature, History, LayoutGrid, ShieldCheck, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ProfileTab = 'overview' | 'work' | 'earnings' | 'agreements' | 'access' | 'history'

export const TAB_META: Record<ProfileTab, { label: string; icon: LucideIcon }> = {
  overview: { label: 'Overview', icon: LayoutGrid },
  work: { label: 'Work', icon: BriefcaseBusiness },
  earnings: { label: 'Earnings', icon: Coins },
  agreements: { label: 'Agreements', icon: FileSignature },
  access: { label: 'Access', icon: ShieldCheck },
  history: { label: 'History', icon: History },
}

const GROUPS: { label: string; tabs: ProfileTab[] }[] = [
  { label: 'PROFILE', tabs: ['overview', 'work', 'earnings', 'agreements'] },
  { label: 'ADMIN', tabs: ['access', 'history'] },
]

/**
 * The member profile's side menu (Allan, 2026-10-24): the Settings side menu
 * exactly (SettingsSidebar's look: no card, small uppercase group labels, the
 * active row filled noir). Shown from lg; below it the page uses the tab bar.
 */
export function ProfileNav({
  tabs,
  active,
  onPick,
  counts,
}: {
  tabs: readonly ProfileTab[]
  active: ProfileTab
  onPick: (tab: ProfileTab) => void
  counts?: Partial<Record<ProfileTab, number>>
}) {
  const groups = GROUPS.map((g) => ({ ...g, tabs: g.tabs.filter((t) => tabs.includes(t)) })).filter((g) => g.tabs.length > 0)
  return (
    <nav aria-label="Profile sections" className="w-[224px] shrink-0">
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.label} className="space-y-0.5">
            <div
              className="mb-1.5 px-2.5 font-inter font-semibold uppercase text-[#8B8F9E]"
              style={{ fontSize: '10px', letterSpacing: '0.08em' }}
            >
              {g.label}
            </div>
            {g.tabs.map((t) => {
              const { label, icon: Icon } = TAB_META[t]
              const on = t === active
              return (
                <button
                  key={t}
                  type="button"
                  aria-current={on ? 'page' : undefined}
                  onClick={() => onPick(t)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg text-left font-inter transition-colors',
                    on ? 'bg-[#0d0d09] text-[#fffcf9]' : 'text-[#1F2230] hover:bg-[rgba(13,13,9,0.05)]',
                  )}
                  style={{ padding: '7px 10px', fontSize: '12.5px' }}
                >
                  <Icon className="h-[14px] w-[14px] shrink-0" strokeWidth={2} aria-hidden />
                  <span className="flex-1 truncate">{label}</span>
                  {counts?.[t] != null && (
                    <span
                      className={cn(
                        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums leading-none',
                        on ? 'bg-white/10 text-[#fffcf9]/80' : 'bg-[#F1F0EC] text-[#5A6072]',
                      )}
                    >
                      {counts[t]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </nav>
  )
}
