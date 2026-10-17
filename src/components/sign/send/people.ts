import { okEmail } from '@/lib/sign/templates'
import type { SendRole } from '@/lib/sign/send'

export type Source = NonNullable<SendRole['source']>
export type People = Record<string, { name: string; email: string }>

/** Where a role's person comes from; databases from before sources fall back to the old rule. */
export const sourceOf = (r: SendRole): Source => r.source ?? (r.fixed ? 'fixed' : 'typed')
/** The sender can't change this person. */
export const isLocked = (r: SendRole) => r.locked ?? r.fixed

/** The person a role sends to: the locked one from the server, or what the sender typed. */
export function personOf(r: SendRole, people: People) {
  return isLocked(r) ? { name: r.name ?? '', email: r.email ?? '' } : people[r.id] ?? { name: '', email: '' }
}

/** Why a locked role has nobody to send to, or null. */
export function lockedProblem(r: SendRole, isOffer: boolean, kind: 'candidate' | 'member'): string | null {
  if (!isLocked(r) || (r.email && okEmail(r.email))) return null
  switch (sourceOf(r)) {
    case 'hiring_manager':
      return `${r.label} comes from the job, and this job has no hiring manager. Add one to the job’s team first.`
    case 'record':
      return kind === 'member'
        ? `${r.label} comes from the team member, who has no email on file.`
        : `${r.label} comes from the ${isOffer ? 'offer' : 'candidate'}, and the candidate has no email on file. Add one to their profile first.`
    case 'sender':
      return `${r.label} is whoever sends it, and your account has no email.`
    default:
      return `${r.label} is set in the template without a valid email. An admin can fix it in the template.`
  }
}
