import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface MetricCardProps {
  title: string
  value: string | number | React.ReactNode
  icon?: React.ReactNode
  tooltip?: string
  variant?: 'default' | 'success' | 'warning' | 'destructive'
  backgroundColor?: string
  iconColor?: string
}

export function MetricCard({ 
  title, 
  value, 
  icon, 
  tooltip, 
  variant = 'default',
  backgroundColor,
  iconColor
}: MetricCardProps) {
  const card = (
    <Card 
      className="transition-all duration-200 ease-out hover:shadow-lg hover:-translate-y-0.5 hover:border-virgilio-purple/30 border-virgilio-border" 
      style={backgroundColor ? { background: backgroundColor } : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle 
          className="text-sm font-poppins font-semibold text-virgilio-text"
          withPeriod={false}
        >
          {title}
        </CardTitle>
        {icon && (
          <div 
            className="h-6 w-6" 
            style={iconColor ? { color: iconColor } : undefined}
          >
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-1">
        <div className="text-3xl font-bold tracking-tight text-virgilio-text">{value}</div>
      </CardContent>
    </Card>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {card}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return card
}