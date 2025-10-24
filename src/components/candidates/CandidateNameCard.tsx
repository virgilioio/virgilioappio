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
        <div className="w-full rounded-xl p-1" style={{ backgroundColor: '#fffcf9' }}>
          <div className="inline-flex h-auto items-center justify-start rounded-xl bg-transparent p-0 text-muted-foreground w-full">
            {tabs.map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => onTabChange(value)}
                className={cn(
                  'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50',
                  activeTab === value && 'text-purple-900'
                )}
                style={activeTab === value ? { backgroundColor: '#d7c5fb' } : undefined}
              >
                {Icon ? <Icon className="h-4 w-4 mr-2" /> : null}
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
