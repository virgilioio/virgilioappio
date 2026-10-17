import { CircleX, Copy, Lock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { okEmail } from '@/lib/sign/templates'
import type { SendRole } from '@/lib/sign/send'
import { isLocked, lockedProblem, sourceOf, type People, type Source } from './people'

function sourcePill(s: Source, isOffer: boolean, kind: 'candidate' | 'member') {
  switch (s) {
    case 'record':
      return isOffer ? 'From the offer' : kind === 'member' ? 'From the record' : 'From the candidate'
    case 'hiring_manager':
      return 'From the job'
    case 'fixed':
      return 'Always'
    case 'sender':
      return 'You'
    default:
      return null
  }
}

/**
 * Who signs, in the template's order (2026-10-17). People from the offer, the
 * job, the sender or the template are locked; only roles the template leaves
 * to the sender get inputs.
 */
export function WhoSigns({
  roles,
  people,
  isOffer,
  kind,
  touched,
  onTouch,
  onChange,
}: {
  roles: SendRole[]
  people: People
  isOffer: boolean
  kind: 'candidate' | 'member'
  touched: Record<string, boolean>
  onTouch: (id: string) => void
  onChange: (id: string, p: { name: string; email: string }) => void
}) {
  let n = 0
  return (
    <div className="flex flex-col">
      {roles.map((r) => {
        const copy = r.role === 'cc'
        if (!copy) n += 1
        const locked = isLocked(r)
        const problem = lockedProblem(r, isOffer, kind)
        const pill = sourcePill(sourceOf(r), isOffer, kind)
        const typed = people[r.id] ?? { name: '', email: '' }
        return (
          <div key={r.id} className="gio-who-row">
            <span className="flex justify-center font-inter text-[11.5px] tabular-nums text-text-tertiary">
              {copy ? <Copy className="h-2.5 w-2.5" strokeWidth={2.2} aria-label="Gets a copy" /> : n}
            </span>
            <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: r.color }} />
            <div className="min-w-0">
              <p className="truncate font-inter text-[12.5px] font-medium text-text-primary">
                {r.label}
                <span className="font-normal text-text-tertiary"> · {copy ? 'Gets a copy' : r.role === 'approver' ? 'Approves' : 'Signs'}</span>
              </p>
              {locked && !problem && (
                <p className="mt-0.5 flex min-w-0 items-center gap-1.5 font-inter text-[12px] text-text-secondary">
                  <Lock className="h-[11px] w-[11px] shrink-0 text-text-tertiary" strokeWidth={2} aria-hidden />
                  <span className="truncate">
                    {r.name && r.name !== r.email ? `${r.name} · ${r.email}` : r.email}
                  </span>
                </p>
              )}
              {problem && (
                <p className="mt-0.5 flex gap-1.5 font-inter text-[12px] leading-snug text-[#A82E23]" role="alert">
                  <CircleX className="mt-[2px] h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden />
                  {problem}
                </p>
              )}
              {!locked && (
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <Input
                    aria-label={`${r.label} name`}
                    placeholder="Full name"
                    maxLength={120}
                    className="h-9"
                    value={typed.name}
                    onChange={(e) => onChange(r.id, { ...typed, name: e.target.value })}
                  />
                  <Input
                    aria-label={`${r.label} email`}
                    placeholder="Email"
                    type="email"
                    className="h-9"
                    value={typed.email}
                    aria-invalid={!!touched[r.id] && !!typed.email && !okEmail(typed.email.trim())}
                    onBlur={() => onTouch(r.id)}
                    onChange={(e) => onChange(r.id, { ...typed, email: e.target.value })}
                  />
                </div>
              )}
            </div>
            <span className="self-start pt-px">
              {pill && (
                <Badge tone="neutral" size="sm">
                  {pill}
                </Badge>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}
