import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import React from 'react'

interface MetricCardGroupProps {
  /** Optional group header label */
  title?: string
  children: React.ReactNode
  className?: string
}

/**
 * Groups multiple inline MetricCards into a single card surface
 * separated by vertical dividers.
 */
export function MetricCardGroup({ title, children, className }: MetricCardGroupProps) {
  const items = React.Children.toArray(children).filter(Boolean)

  return (
    <Card className={cn('rounded-2xl border-border hover:shadow-lg transition-all duration-200 ease-out', className)}>
      <CardContent className="p-0">
        {title && (
          <div className="px-4 pt-3 pb-0">
            <p className="text-[11px] font-poppins font-semibold text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
          </div>
        )}
        <div className="flex divide-x divide-border">
          {items.map((child, i) => (
            <div key={i} className="flex-1 min-w-0">
              {child}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
