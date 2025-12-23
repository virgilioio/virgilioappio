import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { toast } from '@/hooks/use-toast'

export type CandidateNameCardTab = {
  value: string
  label: string
  Icon?: React.ComponentType<{ className?: string }>
}

interface CandidateNameCardProps {
  name?: string
  linkedinUrl?: string | null
  badgeText?: string | null
  tabs: CandidateNameCardTab[]
  activeTab: string
  onTabChange: (value: string) => void
  rightActions?: React.ReactNode
  subtitle?: React.ReactNode
  email?: string | null
  phone?: string | null
  className?: string
}

export function CandidateNameCard({
  name,
  linkedinUrl,
  badgeText,
  tabs,
  activeTab,
  onTabChange,
  rightActions,
  subtitle,
  email,
  phone,
  className,
}: CandidateNameCardProps) {
  return (
    <Card className={cn('bg-surface-primary border-border', className)}>
      <CardContent className="p-layout-md">
        {rightActions && (
          <div className="flex items-center justify-end gap-sm mb-6">{rightActions}</div>
        )}

        {/* Tabs */}
        <div className="w-full rounded-xl p-1.5 bg-[#fffcf9] border border-virgilio-border/20 overflow-x-auto scrollbar-none">
          <div className="flex h-auto items-center justify-start rounded-xl bg-transparent gap-1 min-w-max">
            {tabs.map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => onTabChange(value)}
                className={cn(
                  'inline-flex items-center justify-center whitespace-nowrap rounded-lg',
                  'px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm',
                  'font-poppins font-medium tracking-tight min-h-[40px]',
                  'transition-all duration-200 ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple focus-visible:ring-offset-2',
                  'disabled:pointer-events-none disabled:opacity-50',
                  activeTab === value
                    ? 'bg-[#d7c5fb] text-[#0d0d09] font-semibold shadow-sm border border-virgilio-border/30'
                    : 'text-virgilio-muted hover:bg-virgilio-purple/5 hover:-translate-y-0.5'
                )}
              >
                {Icon ? <Icon className="h-4 w-4 mr-2 flex-shrink-0" /> : null}
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default CandidateNameCard
