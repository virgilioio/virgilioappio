import { Check, ChevronDown, Circle, Mail, MessageCircle, MoreHorizontal, Phone, Trash2, Upload, XCircle } from 'lucide-react'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import { cn, ensureAbsoluteUrl } from '@/lib/utils'
import type { PlanStageOption } from '@/components/candidates/profile/ProfileStageStrip'

/**
 * The in-job candidate profile on phones (2026-11-04): the round contact buttons under
 * the name and the stage dropdown that replaces the desktop's stage chips.
 */

const ROUND =
  'gio-pressable inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E7E8EE] bg-white text-[#1F2230] transition-colors duration-hover hover:bg-[#F7F6F2]'

/** Digits only, for wa.me (which wants the number with its country code and nothing else). */
function whatsappNumber(phone: string | null | undefined) {
  const digits = (phone || '').replace(/\D/g, '')
  return digits.length >= 8 ? digits : null
}

export function PhoneContactRow({
  email,
  phone,
  linkedinUrl,
  onEmail,
}: {
  email?: string | null
  phone?: string | null
  linkedinUrl?: string | null
  onEmail?: () => void
}) {
  const wa = whatsappNumber(phone)
  const tel = (phone || '').trim()
  if (!email && !tel && !linkedinUrl) return null
  return (
    <div className="mt-3 flex items-center gap-2" data-phone-contact>
      {tel && (
        <IconTip label="Call">
          <a href={`tel:${tel.replace(/[^\d+]/g, '')}`} aria-label="Call" className={ROUND}>
            <Phone size={18} strokeWidth={1.8} />
          </a>
        </IconTip>
      )}
      {email && onEmail && (
        <IconTip label="Email">
          <button type="button" onClick={onEmail} aria-label="Email" className={ROUND}>
            <Mail size={18} strokeWidth={1.8} />
          </button>
        </IconTip>
      )}
      {wa && (
        <IconTip label="WhatsApp">
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={ROUND}>
            <MessageCircle size={18} strokeWidth={1.8} />
          </a>
        </IconTip>
      )}
      {linkedinUrl && (
        <IconTip label="LinkedIn">
          <a href={ensureAbsoluteUrl(linkedinUrl)} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className={ROUND}>
            <LinkedInFilled className="h-[17px] w-[17px]" />
          </a>
        </IconTip>
      )}
    </div>
  )
}

/**
 * The stage as one full-width selector: the current stage, "Stage 3 of 5 · 14d in stage"
 * and a thin progress line; it opens the hiring plan, done stages ticked, the current one
 * marked, the next one labelled, and Reject last.
 */
export function PhoneStageSelect({
  stages,
  currentStageId,
  daysInStage,
  disabled,
  onMove,
  onReject,
}: {
  stages: PlanStageOption[]
  currentStageId: string | null
  daysInStage?: number | null
  disabled?: boolean
  onMove: (jhsId: string) => void
  onReject?: () => void
}) {
  if (!stages.length) return null
  const sorted = [...stages].sort((a, b) => a.position - b.position)
  const idx = currentStageId ? sorted.findIndex((s) => s.jhsId === currentStageId) : -1
  const current = idx >= 0 ? sorted[idx] : null
  const meta = [
    idx >= 0 ? `Stage ${idx + 1} of ${sorted.length}` : `${sorted.length} stages`,
    typeof daysInStage === 'number' && daysInStage >= 0 ? `${daysInStage}d in stage` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const progress = idx >= 0 ? (idx + 1) / sorted.length : 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={current ? `Stage: ${current.stage.stage_name}. Change stage` : 'Choose a stage'}
          className="gio-pressable relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-[#E7E8EE] bg-white px-4 py-3 text-left disabled:opacity-60"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-virgilio-purple" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-poppins text-[14px] font-semibold text-[#1F2230]">
              {current?.stage.stage_name ?? 'Not in a stage'}
            </span>
            <span className="block font-inter text-[12px] text-[#5A6072] tabular-nums">{meta}</span>
          </span>
          <ChevronDown size={18} strokeWidth={1.8} className="shrink-0 text-[#5A6072]" aria-hidden />
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#F1F0EC]" aria-hidden>
            <span className="gio-progress-fill block h-full w-full bg-virgilio-purple" style={{ transform: `scaleX(${progress})` }} />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[60vh] overflow-y-auto">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {sorted.map((s, i) => {
          const done = idx >= 0 && i < idx
          const isCurrent = i === idx
          return (
            <DropdownMenuItem key={s.jhsId} disabled={isCurrent} onSelect={() => onMove(s.jhsId)} data-stage-option={s.jhsId}>
              {done ? <Check className="text-[#0E9F6E]" /> : <Circle className={isCurrent ? 'fill-virgilio-purple text-virgilio-purple' : 'text-[#B5B9C4]'} />}
              <span className="truncate">{s.stage.stage_name}</span>
              {i === idx + 1 && idx >= 0 && <DropdownMenuShortcut>Next</DropdownMenuShortcut>}
              {isCurrent && <span className="gio-mrow-check" aria-label="Current stage"><Check /></span>}
            </DropdownMenuItem>
          )
        })}
        {onReject && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-danger onSelect={() => onReject()} className="text-destructive">
              <XCircle />
              <span className="truncate">Reject candidate</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Phones: the résumé's Replace and Delete in one ⋯ menu, so its header stays one line. */
export function ResumePhoneMenu({ busy, onReplace, onDelete }: { busy?: boolean; onReplace: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <IconTip label="Résumé actions">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" iconOnly icon={MoreHorizontal} aria-label="Résumé actions" disabled={busy} />
        </DropdownMenuTrigger>
      </IconTip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onReplace()}>
          <Upload />
          <span className="truncate">Replace résumé</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-danger className="text-destructive" onSelect={() => onDelete()}>
          <Trash2 />
          <span className="truncate">Delete résumé</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
