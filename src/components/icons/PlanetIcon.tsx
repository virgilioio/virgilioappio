
import { Icon } from 'lucide-react'
import { planet } from '@lucide/lab'

interface PlanetIconProps {
  className?: string
}

export function PlanetIcon({ className }: PlanetIconProps) {
  return <Icon iconNode={planet} className={className} />
}
