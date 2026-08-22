import { Check, CircleDashed, Eye, MailX, Pause, PencilLine, Phone, Send, X } from 'lucide-react'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import type { RefereeStatus as RefereeStatusValue } from '@/lib/references/status'

const META: Record<
  RefereeStatusValue,
  { label: string; tone: BadgeTone; icon: typeof Check }
> = {
  pending: { label: 'Pending', tone: 'neutral', icon: CircleDashed },
  invited: { label: 'Invited', tone: 'blue', icon: Send },
  opened: { label: 'Opened', tone: 'blue', icon: Eye },
  in_progress: { label: 'In progress', tone: 'yellow', icon: PencilLine },
  submitted: { label: 'Submitted', tone: 'green', icon: Check },
  declined: { label: 'Declined', tone: 'red', icon: X },
  bounced: { label: 'Bounced', tone: 'red', icon: MailX },
  on_hold: { label: 'On hold', tone: 'orange', icon: Pause },
  logged: { label: 'Logged by recruiter', tone: 'purple', icon: Phone },
}

export function RefereeStatus({
  status,
  size = 'sm',
}: {
  status: RefereeStatusValue
  size?: 'xs' | 'sm' | 'md'
}) {
  const meta = META[status]
  return (
    <Badge tone={meta.tone} size={size} icon={meta.icon}>
      {meta.label}
    </Badge>
  )
}

export default RefereeStatus
