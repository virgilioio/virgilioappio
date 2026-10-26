import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useSettingsSections } from '@/components/settings/settingsSections'

interface SettingsSidebarProps {
  currentTab: string
  onTabChange: (tab: string) => void
  essentialsRemaining?: number
  className?: string
}

export function SettingsSidebar({ currentTab, onTabChange, essentialsRemaining = 0, className }: SettingsSidebarProps) {
  const visibleSections = useSettingsSections(essentialsRemaining)

  return (
    <nav className={cn('w-[224px] shrink-0', className)}>
      <div className="space-y-4">
        {visibleSections.map((section) => (
          <div key={section.id} className="space-y-0.5">
            {section.label && (
              <div
                className="px-2.5 mb-1.5 flex items-center gap-1.5 font-inter font-semibold uppercase text-[#8B8F9E]"
                style={{ fontSize: '10px', letterSpacing: '0.08em' }}
              >
                <span>{section.label}</span>
                {section.groupBadge}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive = currentTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-lg transition-colors text-left',
                    'font-inter',
                    isActive
                      ? 'bg-[#0d0d09] text-[#fffcf9]'
                      : 'text-[#1F2230] hover:bg-[rgba(13,13,9,0.05)]'
                  )}
                  style={{ padding: '7px 10px', fontSize: '12.5px' }}
                >
                  <Icon className="w-[14px] h-[14px] shrink-0" strokeWidth={2} />
                  <span className="truncate flex-1">{item.label}</span>
                  {item.badge}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </nav>
  )
}

/**
 * Settings on a phone or tablet (Allan, 2026-10-26): the sections as a
 * full-width list, grouped in cards like a phone's own settings; a row opens
 * its section, which has "‹ Settings" to come back.
 */
export function SettingsList({ onTabChange, essentialsRemaining = 0 }: { onTabChange: (tab: string) => void; essentialsRemaining?: number }) {
  const visibleSections = useSettingsSections(essentialsRemaining)
  return (
    <nav aria-label="Settings sections" className="space-y-5">
      {visibleSections.map((section) => (
        <div key={section.id}>
          {section.label && (
            <div
              className="mb-2 flex items-center gap-1.5 px-1 font-inter font-semibold uppercase text-[#8B8F9E]"
              style={{ fontSize: '10.5px', letterSpacing: '0.08em' }}
            >
              <span>{section.label}</span>
              {section.groupBadge}
            </div>
          )}
          <div className="overflow-clip rounded-[14px] border border-[#E7E8EE] bg-white">
            {section.items.map((item, i) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    'flex min-h-[52px] w-full items-center gap-3 px-4 text-left font-inter text-[15px] text-[#1F2230] transition-colors active:bg-[#F7F6F2] hover:bg-[#F7F6F2]',
                    i > 0 && 'border-t border-[#F1F0EC]',
                  )}
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#F1F0EC] text-[#1F2230]" aria-hidden>
                    <Icon className="h-[16px] w-[16px]" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge}
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#B5B9C4]" strokeWidth={2} aria-hidden />
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
