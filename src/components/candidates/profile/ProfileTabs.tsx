import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProfileTabDef {
  value: string
  label: string
  Icon: LucideIcon
  count?: number | null
  unread?: boolean
}

interface ProfileTabsProps {
  tabs: ProfileTabDef[]
  activeTab: string
  onTabChange: (v: string) => void
  className?: string
}

/**
 * Underlined tab strip used at the top of the candidate profile body.
 * Visual language matches the Job profile tab strip in the mockup:
 * icon + label, optional count, optional purple unread dot, animated underline.
 */
export function ProfileTabs({ tabs, activeTab, onTabChange, className }: ProfileTabsProps) {
  return (
    <div className={cn('border-b border-virgilio-border', className)}>
      <div className="flex items-end gap-1 overflow-x-auto scrollbar-none -mb-px">
        {tabs.map(({ value, label, Icon, count, unread }) => {
          const isActive = activeTab === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => onTabChange(value)}
              className={cn(
                'group relative inline-flex items-center gap-2 px-4 py-3 font-poppins text-[13.5px] tracking-[-0.005em] transition-colors whitespace-nowrap',
                'border-b-2 -mb-px',
                isActive
                  ? 'border-text-primary text-text-primary font-semibold'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              )}
              aria-selected={isActive}
              role="tab"
            >
              <Icon className={cn('h-4 w-4', isActive ? 'text-text-primary' : 'text-text-tertiary group-hover:text-text-primary')} />
              <span>{label}</span>
              {typeof count === 'number' && count > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-poppins font-medium tabular-nums',
                  isActive
                    ? 'bg-[#0d0d09] text-[#fffcf9]'
                    : 'bg-[#F1F0EC] text-[#5A6072]'
                )}>
                  {count}
                </span>
              )}
              {unread && (
                <span className="h-1.5 w-1.5 rounded-full bg-virgilio-purple" aria-label="Unread" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ProfileTabs
