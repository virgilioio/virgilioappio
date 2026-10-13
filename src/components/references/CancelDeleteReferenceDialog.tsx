/**
 * Cancel or delete a reference check — one component, two modes, on the shared
 * delete dialog (Block B §16, 2026-10-13).
 *
 * The copy is COMPUTED from the request's referees. A recruiter needs to know
 * whether links are live and whether answers are at risk; a generic "this
 * cannot be undone" tells them nothing. Cancelling (O1/O3) is Pattern 1.
 * Deleting is Pattern 2 — type the referee's name — when someone has answered,
 * otherwise Pattern 1 (O2).
 */
import { Ban } from 'lucide-react'

import { ConfirmDestructiveDialog } from '@/components/ui/confirm-destructive'
import type { DestructiveOptions } from '@/components/ui/confirm-dialog'
import type { RefereeLike } from '@/lib/references/status'

export type RefDestructiveMode = 'cancel' | 'delete'

const LIVE = ['invited', 'opened', 'in_progress']
const SUBMITTED = ['submitted', 'logged']

type RefereeWithName = RefereeLike & { name?: string | null }

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function firstNameOf(name?: string | null) {
  return (name ?? '').trim().split(/\s+/)[0] || ''
}

function possessive(name: string) {
  return `${name}’s`
}

/**
 * The one copy for cancelling a reference check, used by the request list (O1)
 * and the candidate's reference card (O3). The edge function revokes every
 * link, stops reminders, discards unsent drafts, keeps submitted answers and
 * emails nobody.
 */
export function referenceCancelCopy(candidateName: string | null | undefined, referees: RefereeLike[]): DestructiveOptions {
  const name = (candidateName ?? '').trim()
  const first = firstNameOf(name)
  const live = referees.filter((r) => LIVE.includes(r.status)).length
  const drafting = referees.filter((r) => r.status === 'in_progress').length
  const submitted = referees.filter((r) => SUBMITTED.includes(r.status)).length

  const whose = first ? `${possessive(first)} link` : 'The candidate link'
  const links =
    live > 0
      ? `${whose} and ${plural(live, 'referee link', 'referee links')} stop working, and reminders stop.`
      : `${whose} stops working, and reminders stop.`
  const kept =
    submitted > 0
      ? ` The ${plural(submitted, 'reference', 'references')} already submitted ${submitted === 1 ? 'stays' : 'stay'}.`
      : ''
  const drafts = drafting > 0 ? ' Answers not yet sent are discarded.' : ''

  return {
    icon: Ban,
    title: name ? `Cancel ${possessive(name)} reference check?` : 'Cancel this reference check?',
    description: `${links}${kept}${drafts} Nobody is emailed, and you can request references again at any time.`,
    confirmLabel: 'Cancel check',
    cancelLabel: 'Keep check',
  }
}

/** Delete copy. `typeToConfirm` is set only when someone has answered (Pattern 2). */
export function referenceDeleteCopy(
  candidateName: string | null | undefined,
  referees: RefereeWithName[],
  { canCancelInstead = false }: { canCancelInstead?: boolean } = {},
): DestructiveOptions {
  const name = (candidateName ?? '').trim()
  const answered = referees.filter((r) => SUBMITTED.includes(r.status))
  const firstAnswered = answered.map((r) => (r.name ?? '').trim()).find(Boolean) ?? ''

  let lost: string
  if (answered.length === 0) {
    lost = 'Nobody has answered yet. The request, its referees and its activity are deleted, and any live link stops working.'
  } else {
    const whose =
      answered.length === 1
        ? `${firstAnswered ? possessive(firstAnswered) : 'The referee’s'} answers are`
        : `Answers from ${firstAnswered || 'a referee'} and ${plural(answered.length - 1, 'other referee', 'other referees')} are`
    lost = `${whose} deleted with the request, its referees and its activity, and any live link stops working.`
  }
  const instead =
    answered.length > 0 && canCancelInstead ? ' To keep their answers and stop all contact, cancel the check instead.' : ''

  return {
    title: name ? `Delete ${possessive(name)} reference check?` : 'Delete this reference check?',
    description: `${lost} Only a note that it was deleted is kept. This can’t be undone.${instead}`,
    confirmLabel: 'Delete check',
    typeToConfirm: answered.length > 0 ? firstAnswered || name || undefined : undefined,
  }
}

export interface CancelDeleteReferenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: RefDestructiveMode
  candidateName: string
  referees: RefereeWithName[]
  /** The check is still running and the user may cancel it: the delete copy suggests that. */
  canCancelInstead?: boolean
  /** Awaited only for a type-to-confirm delete; throw to show the error in the dialog. */
  onConfirm: () => void | Promise<void>
}

export function CancelDeleteReferenceDialog({
  open,
  onOpenChange,
  mode,
  candidateName,
  referees,
  canCancelInstead,
  onConfirm,
}: CancelDeleteReferenceDialogProps) {
  const copy =
    mode === 'cancel'
      ? referenceCancelCopy(candidateName, referees)
      : referenceDeleteCopy(candidateName, referees, { canCancelInstead })

  return (
    <ConfirmDestructiveDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="delete"
      icon={copy.icon}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      cancelLabel={copy.cancelLabel}
      typeToConfirm={copy.typeToConfirm}
      onConfirm={onConfirm}
    />
  )
}

export default CancelDeleteReferenceDialog
