/**
 * Cancel or delete a reference check — one component, two modes.
 *
 * The consequence list is COMPUTED from the request's referees. A recruiter
 * needs to know whether referees have already been emailed and whether answers
 * are at risk; a generic "this cannot be undone" tells them nothing.
 */
import {
  Archive,
  Ban,
  FileX,
  Link2,
  MailX,
  ShieldAlert,
  Trash2,
  TriangleAlert,
  Undo2,
  UserRoundX,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { RefereeLike } from '@/lib/references/status'

export type RefDestructiveMode = 'cancel' | 'delete'

const LIVE = ['invited', 'opened', 'in_progress']
const SUBMITTED = ['submitted', 'logged']

export interface CancelDeleteReferenceDialogProps {
  mode: RefDestructiveMode
  candidateName: string
  candidateRole?: string | null
  clientName?: string | null
  referees: RefereeLike[]
  busy?: boolean
  onClose: () => void
  onConfirm: () => void
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function CancelDeleteReferenceDialog({
  mode,
  candidateName,
  candidateRole,
  clientName,
  referees,
  busy,
  onClose,
  onConfirm,
}: CancelDeleteReferenceDialogProps) {
  const live = referees.filter((r) => LIVE.includes(r.status)).length
  const submitted = referees.filter((r) => SUBMITTED.includes(r.status)).length

  const lines: { icon: LucideIcon; text: string }[] =
    mode === 'cancel'
      ? [
          {
            icon: Link2,
            text:
              live > 0
                ? `Revokes the candidate's link and ${plural(live, 'referee link', 'referee links')}`
                : "Revokes the candidate's link",
          },
          { icon: MailX, text: 'Stops all reminders immediately' },
          submitted > 0
            ? {
                icon: Archive,
                text: `Keeps the ${plural(submitted, 'reference', 'references')} already submitted`,
              }
            : {
                icon: UserRoundX,
                text: "Nobody who hasn't answered will be contacted again",
              },
          { icon: Undo2, text: 'You can request references again at any time' },
        ]
      : [
          {
            icon: Trash2,
            text:
              submitted > 0
                ? `Permanently deletes ${plural(
                    submitted,
                    'submitted reference',
                    'submitted references',
                  )} and every answer`
                : 'Permanently deletes this request',
          },
          { icon: Link2, text: 'Revokes any link that is still live' },
          { icon: FileX, text: "Removes it from the candidate's profile and from reporting" },
          { icon: ShieldAlert, text: 'Keeps a minimal audit record of the deletion itself' },
        ]

  const where = [candidateRole, clientName ? `at ${clientName}` : null].filter(Boolean).join(' ')

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        background: 'rgba(13,13,9,0.28)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 24px 64px -12px rgba(13,13,9,0.28)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 22px 16px' }}>
          <div
            className="inline-flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              marginBottom: 13,
              background: mode === 'cancel' ? '#FFF7ED' : '#FEF2F2',
              color: mode === 'cancel' ? '#B45309' : '#B42318',
            }}
          >
            {mode === 'cancel' ? (
              <Ban size={17} strokeWidth={2} />
            ) : (
              <Trash2 size={17} strokeWidth={2} />
            )}
          </div>

          <h2
            className="font-poppins"
            style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.03em', color: '#0d0d09' }}
          >
            {mode === 'cancel'
              ? 'Cancel this reference check?'
              : 'Delete this reference check?'}
          </h2>
          <p
            className="font-inter"
            style={{ fontSize: 12.5, color: '#5A6072', lineHeight: 1.55, marginTop: 6 }}
          >
            {candidateName}
            {where ? ` · ${where}` : ''}.{' '}
            {mode === 'cancel' ? 'This stops the process now.' : 'This cannot be undone.'}
          </p>

          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lines.map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex" style={{ gap: 9 }}>
                <Icon
                  size={13}
                  color="#8B8F9E"
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <span
                  className="font-inter"
                  style={{ fontSize: 12, color: '#1F2230', lineHeight: 1.5 }}
                >
                  {text}
                </span>
              </div>
            ))}
          </div>

          {/* Offers the better action at the moment its cost becomes concrete —
              never a block: the delete button below still works. */}
          {mode === 'delete' && submitted > 0 && (
            <div
              className="flex font-inter"
              style={{
                marginTop: 14,
                gap: 9,
                padding: '11px 12px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 9,
                fontSize: 11.5,
                color: '#B42318',
                lineHeight: 1.5,
              }}
            >
              <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                These referees gave their time. Consider cancelling instead — it keeps their
                answers and stops all contact.
              </span>
            </div>
          )}
        </div>

        <div
          className="flex items-center"
          style={{
            gap: 8,
            padding: '12px 22px',
            borderTop: '1px solid #F1F0EC',
            background: '#FAFAF7',
          }}
        >
          <div style={{ marginLeft: 'auto' }} className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={onClose} disabled={busy}>
              Keep it
            </Button>
            <Button
              variant="danger"
              size="md"
              icon={mode === 'cancel' ? Ban : Trash2}
              loading={busy}
              onClick={onConfirm}
            >
              {mode === 'cancel' ? 'Cancel check' : 'Delete permanently'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CancelDeleteReferenceDialog
