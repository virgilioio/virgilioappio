import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type CandidateNameCardTab = {
  value: string
  label: string
  Icon?: React.ComponentType<{ className?: string }>
}

interface CandidateNameCardProps {
  name: string
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
  tabs,
  activeTab,
  onTabChange,
  rightActions,
  className,
}: CandidateNameCardProps) {
  return (
    <>
      {rightActions && (
        <div className="flex items-start justify-between mb-6">
          <div className="ml-auto flex items-center gap-sm">{rightActions}</div>
        </div>
      )}

      {/* Tabs */}
      <div className={cn("w-full rounded-xl p-1 border border-border", className)} style={{ backgroundColor: '#d7c5fb' }}>
        <div className="inline-flex h-auto items-center justify-start rounded-xl bg-transparent p-0 text-muted-foreground w-full">
          {tabs.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => onTabChange(value)}
              className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50',
                activeTab === value && 'bg-white text-gray-900'
              )}
            >
              {Icon ? <Icon className="h-4 w-4 mr-2" /> : null}
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

export default CandidateNameCard
