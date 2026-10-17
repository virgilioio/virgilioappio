import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, PenLine, Plus, TriangleAlert, X } from 'lucide-react'

import { FormSection } from '@/components/references/FormSection'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { IconTip } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ROLE_COLORS, ROLE_SOURCES, roleSource, signersWithoutSignature, uid, type FillFrom, type TplDraft, type TplRole } from '@/lib/sign/templates'
import type { SignRecipientRole } from '@/lib/sign/api'
import { prefersReducedMotion } from '@/lib/motion'

const ROLE_KIND: { value: SignRecipientRole; label: string }[] = [
  { value: 'signer', label: 'Signer' },
  { value: 'approver', label: 'Approver' },
  { value: 'cc', label: 'Gets a copy' },
]

/**
 * Signers (2026-10-17): one row per role, in signing order. Each row has its
 * order number, colour, name, where the person comes from, what they do and
 * a remove button (off for the last role). Rows FLIP when reordered and rise
 * in when added. A signer with no signature block gets a warning.
 */
export function RolesStep({
  d,
  set,
  me,
}: {
  d: TplDraft
  set: (fn: (d: TplDraft) => TplDraft) => void
  me: { name: string; email: string }
}) {
  const list = useRef<HTMLDivElement>(null)
  const before = useRef<Map<string, number> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())

  // Rows FLIP to their new places when reordered (240ms, --ease-in-out).
  useLayoutEffect(() => {
    const prev = before.current
    before.current = null
    if (!prev || !list.current || prefersReducedMotion()) return
    list.current.querySelectorAll<HTMLElement>('[data-role-id]').forEach((el) => {
      const top = prev.get(el.dataset.roleId!)
      if (top == null) return
      const dy = top - el.getBoundingClientRect().top
      if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' })
    })
  })
  const snap = () => {
    const m = new Map<string, number>()
    list.current?.querySelectorAll<HTMLElement>('[data-role-id]').forEach((el) => m.set(el.dataset.roleId!, el.getBoundingClientRect().top))
    before.current = m
  }
  const move = (i: number, j: number) => {
    if (j < 0 || j >= d.roles.length) return
    snap()
    set((x) => {
      const a = [...x.roles]
      ;[a[i], a[j]] = [a[j], a[i]]
      return { ...x, roles: a }
    })
  }
  const upd = (id: string, p: Partial<TplRole>) => set((x) => ({ ...x, roles: x.roles.map((r) => (r.id === id ? { ...r, ...p } : r)) }))
  const freeColor = () => ROLE_COLORS.find((c) => !d.roles.some((r) => r.color === c)) ?? ROLE_COLORS[d.roles.length % ROLE_COLORS.length]
  const add = (p: Partial<TplRole>) => {
    const id = uid()
    setFresh((s) => new Set(s).add(id))
    set((x) => ({
      ...x,
      roles: [
        ...x.roles,
        { id, label: `Role ${x.roles.length + 1}`, role: 'signer', fixed: false, fill_from: x.kind === 'customer' ? null : 'typed', name: '', email: '', color: freeColor(), ...p },
      ],
    }))
  }
  const remove = (r: TplRole) =>
    set((x) => ({
      ...x,
      roles: x.roles.filter((y) => y.id !== r.id),
      fields: x.fields.filter((f) => f.rid !== r.id),
    }))

  const sourceOf = (r: TplRole) => roleSource(d, r)
  const setSource = (r: TplRole, v: FillFrom) =>
    upd(
      r.id,
      v === 'fixed'
        ? { fixed: true, fill_from: 'fixed' }
        : { fixed: false, fill_from: d.kind === 'customer' ? null : v, name: '', email: '' },
    )
  const hasMe = d.roles.some((r) => r.fixed && r.email.toLowerCase() === me.email.toLowerCase())
  const full = d.roles.length >= 20
  const unsigned = signersWithoutSignature(d)

  return (
    <div className="max-w-[860px]">
      <FormSection
        title="Roles"
        subtitle="Roles become people when the template is sent. Name them by what they do, never by a person’s name."
        action={
          <label className="flex items-center gap-2 whitespace-nowrap font-inter text-[12.5px] font-medium text-text-primary">
            Signing order
            <Switch checked={d.ordered} onCheckedChange={(v) => set((x) => ({ ...x, ordered: v }))} aria-label="Signing order" />
          </label>
        }
        cardPadding="6px 16px 14px"
      >
        <p className="py-2.5 font-inter text-[12px] text-text-tertiary">
          {d.ordered ? 'Each person gets the email after the one before them has signed.' : 'Everyone gets the email at the same time and can sign in any order.'}
        </p>
        <div ref={list} className="flex flex-col" role="list" aria-label="Roles">
          {d.roles.map((r, i) => (
            <div
              key={r.id}
              role="listitem"
              data-role-id={r.id}
              className={cn('border-t border-[#F1F0EC] py-2.5', fresh.has(r.id) && 'gio-row-in')}
              onAnimationEnd={() => fresh.has(r.id) && setFresh((s) => (s.delete(r.id) ? new Set(s) : s))}
            >
              <div className="gio-role-row">
                <span className="text-center font-inter text-[12px] font-medium tabular-nums text-text-tertiary">{d.ordered ? i + 1 : ''}</span>
                <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: r.color }} />
                <Input
                  value={r.label}
                  maxLength={60}
                  aria-label="Role name"
                  placeholder="e.g. Candidate"
                  className="h-9 min-w-0"
                  onChange={(e) => upd(r.id, { label: e.target.value })}
                />
                <Select value={sourceOf(r)} onValueChange={(v) => setSource(r, v as FillFrom)}>
                  <SelectTrigger className="h-9 min-w-0" aria-label={`Where ${r.label || 'this role'} is filled from`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_SOURCES[d.kind].map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={r.role}
                  onValueChange={(v) =>
                    set((x) => ({
                      ...x,
                      roles: x.roles.map((y) => (y.id === r.id ? { ...y, role: v as SignRecipientRole } : y)),
                      // Copy recipients don't fill anything.
                      fields: v === 'cc' ? x.fields.filter((f) => f.rid !== r.id) : x.fields,
                    }))
                  }
                >
                  <SelectTrigger className="h-9" aria-label={`What ${r.label || 'this role'} does`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_KIND.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center justify-end">
                  {d.ordered && (
                    <>
                      <IconTip label="Move up">
                        <Button variant="ghost" size="sm" iconOnly aria-label={`Move ${r.label || 'role'} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                          <ArrowUp />
                        </Button>
                      </IconTip>
                      <IconTip label="Move down">
                        <Button variant="ghost" size="sm" iconOnly aria-label={`Move ${r.label || 'role'} down`} disabled={i === d.roles.length - 1} onClick={() => move(i, i + 1)}>
                          <ArrowDown />
                        </Button>
                      </IconTip>
                    </>
                  )}
                  <IconTip label={d.roles.length === 1 ? 'A template needs at least one role' : `Remove ${r.label || 'role'}`}>
                    <span>
                      <Button variant="ghost" size="sm" iconOnly aria-label={`Remove ${r.label || 'role'}`} disabled={d.roles.length === 1} onClick={() => remove(r)}>
                        <X />
                      </Button>
                    </span>
                  </IconTip>
                </div>
              </div>
              {r.fixed && (
                <div className="gio-role-sub mt-2 grid grid-cols-2 gap-2">
                  <Input value={r.name} maxLength={120} aria-label={`${r.label || 'Role'} name`} placeholder="Full name" className="h-9" onChange={(e) => upd(r.id, { name: e.target.value })} />
                  <Input
                    value={r.email}
                    type="email"
                    aria-label={`${r.label || 'Role'} email`}
                    placeholder="Email"
                    className="h-9"
                    aria-invalid={!!r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)}
                    onChange={(e) => upd(r.id, { email: e.target.value.trim() })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-[#F1F0EC] pt-3">
          <Button variant="secondary" size="sm" icon={Plus} disabled={full} onClick={() => add({})}>
            Add role
          </Button>
          {!hasMe && me.email && (
            <Button
              variant="secondary"
              size="sm"
              icon={PenLine}
              disabled={full}
              onClick={() => add({ label: 'Countersigner', fixed: true, fill_from: 'fixed', name: me.name, email: me.email.toLowerCase() })}
            >
              Add me as countersigner
            </Button>
          )}
        </div>
      </FormSection>

      {unsigned.length > 0 && (
        <div className="flex flex-col gap-2">
          {unsigned.map((r) => (
            <p key={r.id} className="gio-send-note" data-tone="warn">
              <TriangleAlert className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span>
                <span className="font-medium">{r.label || 'A signer'}</span> signs but has no signature block in the document. Add one in the Document step.
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
