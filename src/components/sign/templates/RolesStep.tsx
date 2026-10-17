import { useLayoutEffect, useRef } from 'react'
import { ArrowDown, ArrowUp, PenLine, Plus, X } from 'lucide-react'

import { FormSection } from '@/components/references/FormSection'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { IconTip } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ROLE_COLORS, uid, type FillFrom, type TplDraft, type TplRole } from '@/lib/sign/templates'
import type { SignRecipientRole } from '@/lib/sign/api'
import { prefersReducedMotion } from '@/lib/motion'

const ROLE_KIND: { value: SignRecipientRole; label: string }[] = [
  { value: 'signer', label: 'Signer' },
  { value: 'approver', label: 'Approver' },
  { value: 'cc', label: 'Gets a copy' },
]

/** Where a role's person comes from, by template type (2026-10-17). Customer templates keep the on/off switch. */
const SOURCES: Record<'candidate' | 'member', { value: FillFrom; label: string }[]> = {
  candidate: [
    { value: 'record', label: 'The candidate' },
    { value: 'hiring_manager', label: 'The job’s hiring manager' },
    { value: 'sender', label: 'Whoever sends it' },
    { value: 'fixed', label: 'Same person every time' },
    { value: 'typed', label: 'Typed in when sending' },
  ],
  member: [
    { value: 'record', label: 'The team member' },
    { value: 'sender', label: 'Whoever sends it' },
    { value: 'fixed', label: 'Same person every time' },
    { value: 'typed', label: 'Typed in when sending' },
  ],
}

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
  const add = (p: Partial<TplRole>) =>
    set((x) => ({
      ...x,
      roles: [
        ...x.roles,
        { id: uid(), label: `Role ${x.roles.length + 1}`, role: 'signer', fixed: false, fill_from: x.kind === 'customer' ? null : 'typed', name: '', email: '', color: freeColor(), ...p },
      ],
    }))
  // Roles saved before sources existed: the first open signer is the record's person, the rest are typed.
  const firstOpen = d.roles.find((r) => r.role === 'signer' && !r.fixed)?.id
  const sourceOf = (r: TplRole): FillFrom => (r.fixed ? 'fixed' : r.fill_from && r.fill_from !== 'fixed' ? r.fill_from : r.id === firstOpen ? 'record' : 'typed')
  const setSource = (r: TplRole, v: FillFrom) =>
    upd(r.id, v === 'fixed' ? { fixed: true, fill_from: 'fixed' } : { fixed: false, fill_from: v, name: '', email: '' })
  const sources = d.kind === 'customer' ? null : SOURCES[d.kind]
  const hasMe = d.roles.some((r) => r.fixed && r.email.toLowerCase() === me.email.toLowerCase())
  const full = d.roles.length >= 20

  return (
    <div className="max-w-[760px]">
      <FormSection
        title="Roles"
        subtitle={d.kind === 'customer' ? 'Roles become people when the template is used. The first signer is usually filled from the record.' : 'Roles become people when the template is used. Choose where each person comes from; only people typed in when sending can be changed then.'}
        action={
          <label className="flex items-center gap-2 whitespace-nowrap font-inter text-[12.5px] font-medium text-text-primary">
            Signing order
            <Switch checked={d.ordered} onCheckedChange={(v) => set((x) => ({ ...x, ordered: v }))} aria-label="Signing order" />
          </label>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="font-inter text-[12px] text-text-tertiary">
            {d.ordered ? 'Each person gets the email after the one before them has signed.' : 'Everyone gets the email at the same time and can sign in any order.'}
          </p>
          <div ref={list} className="flex flex-col gap-2">
            {d.roles.map((r, i) => (
              <div key={r.id} data-role-id={r.id} className="rounded-xl border border-[#E7E8EE] bg-white p-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center font-inter text-[12px] font-medium tabular-nums text-text-tertiary">{d.ordered ? i + 1 : ''}</span>
                  <span aria-hidden className="h-7 w-2.5 shrink-0 rounded-[5px]" style={{ background: r.color }} />
                  <Input
                    value={r.label}
                    maxLength={60}
                    aria-label="Role name"
                    placeholder="Role name, e.g. Candidate"
                    className="h-9 flex-1"
                    onChange={(e) => upd(r.id, { label: e.target.value })}
                  />
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
                    <SelectTrigger className="h-9 w-[140px]" aria-label="What this role does">
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
                  {sources ? (
                    <Select value={sourceOf(r)} onValueChange={(v) => setSource(r, v as FillFrom)}>
                      <SelectTrigger className="h-9 w-[208px]" aria-label={`Where ${r.label || 'this role'} comes from`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sources.map((k) => (
                          <SelectItem key={k.value} value={k.value}>
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <label className="flex shrink-0 items-center gap-2 whitespace-nowrap pl-1 font-inter text-[12px] text-text-secondary">
                      Same person every time
                      <Switch checked={r.fixed} onCheckedChange={(v) => upd(r.id, { fixed: v, ...(v ? null : { name: '', email: '' }) })} aria-label={`${r.label || 'This role'} is the same person every time`} />
                    </label>
                  )}
                  <div className="flex shrink-0 items-center">
                    <IconTip label="Move up">
                      <Button variant="ghost" size="sm" iconOnly aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>
                        <ArrowUp />
                      </Button>
                    </IconTip>
                    <IconTip label="Move down">
                      <Button variant="ghost" size="sm" iconOnly aria-label="Move down" disabled={i === d.roles.length - 1} onClick={() => move(i, i + 1)}>
                        <ArrowDown />
                      </Button>
                    </IconTip>
                    <IconTip label={`Remove ${r.label || 'role'}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        aria-label={`Remove ${r.label || 'role'}`}
                        onClick={() => set((x) => ({ ...x, roles: x.roles.filter((y) => y.id !== r.id), fields: x.fields.filter((f) => f.rid !== r.id) }))}
                      >
                        <X />
                      </Button>
                    </IconTip>
                  </div>
                </div>
                {r.fixed && (
                  <div className="mt-2 grid grid-cols-2 gap-2 pl-[52px] pr-[100px]">
                    <Input value={r.name} maxLength={120} aria-label="Name" placeholder="Full name" className="h-9" onChange={(e) => upd(r.id, { name: e.target.value })} />
                    <Input
                      value={r.email}
                      type="email"
                      aria-label="Email"
                      placeholder="Email"
                      className="h-9"
                      aria-invalid={!!r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)}
                      onChange={(e) => upd(r.id, { email: e.target.value.trim() })}
                    />
                  </div>
                )}
              </div>
            ))}
            {!d.roles.length && <p className="px-1 py-2 font-inter text-[12.5px] text-text-tertiary">No roles yet. Add at least one signer.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
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
        </div>
      </FormSection>
    </div>
  )
}
