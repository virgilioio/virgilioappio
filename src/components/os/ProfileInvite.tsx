import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarHeart, Check, Landmark, UserRound, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { markInviteSeen, useProfileInvite, type ProfileCheck } from '@/components/os/profileChecks'
import { cn } from '@/lib/utils'

/**
 * The invitation to fill in My profile (Allan, 2026-10-26): this dialog, once
 * per person (per browser), then the band under the top bar until the profile
 * is complete in HeaderContextBands. Who sees them is
 * `useProfileInvite` (`profileChecks.ts`).
 */
export function ProfileInviteDialog() {
  const navigate = useNavigate()
  const invite = useProfileInvite()
  const primary = React.useRef<HTMLButtonElement>(null)
  const close = () => markInviteSeen(invite.userId)
  const first = invite.missing[0]

  return (
    <Dialog open={invite.showDialog} onOpenChange={(next) => !next && close()}>
      <DialogContent
        className="max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto overflow-x-hidden rounded-2xl p-0 sm:w-full sm:max-w-[520px]"
        closeClassName="z-10"
        // §13: focus starts on the primary action.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          primary.current?.focus()
        }}
      >
        <Preview />
        <div className="px-6 pt-5">
          <DialogTitle className="font-poppins text-[22px] font-semibold leading-tight text-[#0d0d09]" style={{ letterSpacing: '-0.03em' }}>
            Your profile is here<span className="text-virgilio-purple">.</span>
          </DialogTitle>
          <DialogDescription className="mt-2 font-inter text-[13.5px] leading-[1.55] text-[#5A6072]">
            One place for what Virgilio needs from you: where your commissions are paid, your agreements, and what your team sees, like your
            photo and your birthday. It takes about five minutes.
          </DialogDescription>

          <Progress done={invite.done} total={invite.total} className="mt-5" />

          <ul className="mt-3 flex flex-col gap-1">
            {invite.checks.map((c) => (
              <CheckRow key={c.key} check={c} />
            ))}
          </ul>
        </div>
        <DialogFooter className="mt-5 gap-2 border-t border-[#F1F0EC] bg-[#FAFAF7] px-6 py-4 sm:space-x-0">
          <Button variant="secondary" onClick={close}>
            Later
          </Button>
          <Button
            ref={primary}
            iconRight={ArrowRight}
            onClick={() => {
              close()
              if (first) navigate(first.to)
            }}
          >
            Complete my profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** "2 of 5 done" over a bar that fills with scaleX (§8). */
export function Progress({ done, total, className }: { done: number; total: number; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between font-inter text-[12px]">
        <span className="font-medium text-[#1F2230]">Your profile</span>
        <span className="tabular-nums text-[#6B7080]">
          {done} of {total} done
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F1F0EC]" aria-hidden>
        <div className="gio-progress-fill h-full w-full rounded-full bg-virgilio-purple" style={{ transform: `scaleX(${total ? done / total : 0})` }} />
      </div>
    </div>
  )
}

function CheckRow({ check: c }: { check: ProfileCheck }) {
  return (
    <li className="flex min-h-[40px] items-center gap-3 rounded-[10px] px-2.5 py-1.5">
      <span
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          c.done ? 'bg-[#D1FAE5] text-[#0F9F74]' : 'bg-[#F1F0EC] text-[#1F2230]',
        )}
        aria-hidden
      >
        {c.done ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : <c.icon className="h-3.5 w-3.5" strokeWidth={2} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-inter text-[13px] font-medium', c.done ? 'text-[#6B7080]' : 'text-[#1F2230]')}>
          {c.done ? c.label : c.title}
        </span>
        {!c.done && <span className="block font-inter text-[12px] leading-[1.4] text-[#6B7080]">{c.body}</span>}
      </span>
      <span className={cn('shrink-0 font-inter text-[12px]', c.done ? 'text-[#0F9F74]' : 'hidden text-[#6B7080] sm:inline')}>
        {c.done ? 'Done' : 'To add'}
      </span>
    </li>
  )
}

/** A still picture of the profile's cards, in their own tints. Decoration only. */
function Preview() {
  return (
    <div aria-hidden className="relative h-[120px] overflow-hidden bg-virgilio-cream sm:h-[148px]">
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-3 px-6">
        <MiniCard icon={UserRound} tone={{ bg: '#EDE4FF', fg: '#6F3FF5' }} title="You" className="translate-y-3">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 shrink-0 rounded-full bg-[#EDE4FF]" />
            <span className="flex-1 space-y-1.5">
              <Bar className="w-[80%]" />
              <Bar className="w-[55%]" />
            </span>
          </div>
        </MiniCard>
        <MiniCard icon={Landmark} tone={{ bg: '#D1FAE5', fg: '#0F9F74' }} title="Bank details" className="translate-y-0 sm:-translate-y-2">
          <Bar className="w-[70%]" />
          <span className="mt-1.5 block font-inter text-[11px] tracking-[0.12em] text-[#6B7080]">•••• ••••</span>
        </MiniCard>
        <MiniCard icon={CalendarHeart} tone={{ bg: '#FCE7F3', fg: '#BE185D' }} title="Coming up" className="hidden translate-y-3 sm:block">
          <Bar className="w-[85%]" />
          <Bar className="mt-1.5 w-[60%]" />
        </MiniCard>
      </div>
    </div>
  )
}

function MiniCard({
  icon: Icon,
  tone,
  title,
  className,
  children,
}: {
  icon: LucideIcon
  tone: { bg: string; fg: string }
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('w-[148px] rounded-t-[14px] border border-b-0 border-[#E7E8EE] bg-white px-3 pt-3 pb-5 shadow-[0_8px_24px_-12px_rgba(13,13,9,0.18)]', className)}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px]" style={{ background: tone.bg, color: tone.fg }}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <span className="font-poppins text-[12px] font-semibold text-[#0d0d09]">{title}</span>
      </div>
      {children}
    </div>
  )
}

function Bar({ className }: { className?: string }) {
  return <span className={cn('block h-2 rounded-full bg-[#F1F0EC]', className)} />
}
