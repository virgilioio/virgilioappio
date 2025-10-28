import { cn } from '@/lib/utils'

interface BillingTitleProps {
  children: React.ReactNode
  className?: string
}

export function BillingTitle({ children, className }: BillingTitleProps) {
  return (
    <h2 className={cn("text-2xl font-semibold tracking-tight", className)}>
      {children}
      <span className="text-virgilio-purple">.</span>
    </h2>
  )
}
