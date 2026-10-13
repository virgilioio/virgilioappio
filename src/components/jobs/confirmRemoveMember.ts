import { confirmDestructive } from '@/components/ui/confirm-dialog'

/**
 * J12 / J13 (Block B §16, Pattern 1): taking someone off a job's hiring team
 * ends their assignment. Re-adding them is the way back, so it asks first.
 * Nothing they wrote goes: scorecards, notes and interview history stay.
 */
export function confirmRemoveMember(name: string, jobTitle?: string | null) {
  const who = name.trim() || 'this member'
  const first = who.split(/\s+/)[0]
  return confirmDestructive({
    variant: 'remove',
    title: `Remove ${who} from the hiring team?`,
    description: `${first} loses access to ${jobTitle?.trim() || 'this job'} unless they’re a workspace admin, and stops getting its notifications. Their scorecards, notes and interview history stay, and you can add them back at any time.`,
    confirmLabel: 'Remove member',
  })
}
