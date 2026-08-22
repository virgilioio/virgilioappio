import { Building2, Layers, UserRoundCog } from 'lucide-react'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import type { ReferenceTemplateScope } from '@/lib/references/templateModel'

const SCOPE: Record<
  ReferenceTemplateScope,
  { label: string; tone: BadgeTone; icon: typeof Building2 }
> = {
  client: { label: 'Client', tone: 'blue', icon: Building2 },
  default: { label: 'Default', tone: 'neutral', icon: Layers },
  personalised: { label: 'Personalised', tone: 'purple', icon: UserRoundCog },
}

export function ScopeChip({ scope }: { scope: ReferenceTemplateScope }) {
  const meta = SCOPE[scope] ?? SCOPE.default
  return (
    <Badge tone={meta.tone} size="xs" icon={meta.icon}>
      {meta.label}
    </Badge>
  )
}

export default ScopeChip
