import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  Link2,
  Mail,
  MessageSquareText,
  Phone,
  Send,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { sanitizeToE164, formatE164Display } from '@/utils/phoneUtils'
import { useUpdateBookingAttendee } from '@/hooks/useUpdateBookingAttendee'

export interface AttendeeDetailsBlockProps {
  bookingId?: string | null
  bookingCandidateName?: string | null
  bookingCandidateEmail?: string | null
  bookingCandidatePhone?: string | null
  bookingNotes?: string | null
  profileEmail?: string | null
  profilePhone?: string | null
  candidateId: string
  /** upcoming = full reconcile incl. resend. past = no resend, no name row, actionable-only. */
  variant?: 'upcoming' | 'past'
}

export type FieldState = 'match' | 'empty' | 'differ'

export function computeEmailState(booked?: string | null, profile?: string | null): FieldState | null {
  const b = (booked ?? '').trim()
  if (!b) return null
  const p = (profile ?? '').trim()
  if (!p) return 'empty'
  return b.toLowerCase() === p.toLowerCase() ? 'match' : 'differ'
}

export function computePhoneState(booked?: string | null, profile?: string | null): FieldState | null {
  const b = booked ? sanitizeToE164(booked) || booked.trim() : ''
  if (!b) return null
  const p = profile ? sanitizeToE164(profile) || profile.trim() : ''
  if (!p) return 'empty'
  const bDigits = b.replace(/\D/g, '').slice(-9)
  const pDigits = p.replace(/\D/g, '').slice(-9)
  return bDigits && bDigits === pDigits ? 'match' : 'differ'
}

/** True if any present field (email/phone) is `empty` or `differ`. */
export function isBookingActionable(args: {
  bookingCandidateEmail?: string | null
  bookingCandidatePhone?: string | null
  profileEmail?: string | null
  profilePhone?: string | null
}): boolean {
  const e = computeEmailState(args.bookingCandidateEmail, args.profileEmail)
  const p = computePhoneState(args.bookingCandidatePhone, args.profilePhone)
  return e === 'empty' || e === 'differ' || p === 'empty' || p === 'differ'
}

const microLabel = 'font-inter text-[10.5px] uppercase tracking-[0.06em] text-[#8B8F9E]'
const valueTextCls = 'font-inter text-[13px] text-[#1F2230] break-all'
const rowBaseCls = 'rounded-[10px] border px-3 py-2.5 flex items-start gap-2.5'
const tileBaseCls = 'h-[26px] w-[26px] rounded-lg flex items-center justify-center shrink-0'

function TagChip({ label, tone }: { label: string; tone: 'booked' | 'profile' }) {
  const styles =
    tone === 'booked'
      ? { bg: '#FBEBC6', color: '#B45309' }
      : { bg: '#F1F0EC', color: '#5A6072' }
  return (
    <span
      className="inline-flex items-center h-[16px] px-1.5 rounded-[4px] font-inter text-[9.5px] font-semibold uppercase tracking-[0.06em] shrink-0"
      style={{ backgroundColor: styles.bg, color: styles.color }}
    >
      {label}
    </span>
  )
}

export function AttendeeDetailsBlock({
  bookingId,
  bookingCandidateEmail,
  bookingCandidatePhone,
  bookingNotes,
  profileEmail,
  profilePhone,
  candidateId,
  variant = 'upcoming',
}: AttendeeDetailsBlockProps) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<null | 'email-save' | 'email-use' | 'phone-save' | 'phone-use'>(null)
  const [dismissedEmail, setDismissedEmail] = useState(false)
  const [dismissedPhone, setDismissedPhone] = useState(false)
  const [inviteResent, setInviteResent] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)

  const emailState = useMemo(
    () => computeEmailState(bookingCandidateEmail, profileEmail),
    [bookingCandidateEmail, profileEmail],
  )
  const phoneState = useMemo(
    () => computePhoneState(bookingCandidatePhone, profilePhone),
    [bookingCandidatePhone, profilePhone],
  )

  const updateAttendee = useUpdateBookingAttendee({
    onSuccess: () => setInviteResent(true),
  })

  const patchCandidate = async (patch: Record<string, unknown>): Promise<boolean> => {
    const { error } = await supabase.from('candidates').update(patch).eq('id', candidateId)
    if (error) {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message })
      return false
    }
    queryClient.invalidateQueries({ queryKey: ['candidates'] })
    queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] })
    return true
  }

  const saveEmailToProfile = async () => {
    if (!bookingCandidateEmail) return
    setBusy('email-save')
    try {
      const ok = await patchCandidate({ email: bookingCandidateEmail.trim() })
      if (ok) toast({ title: 'Profile updated', description: 'Email saved to candidate profile.' })
    } finally { setBusy(null) }
  }

  const useBookedEmail = async () => {
    if (!bookingCandidateEmail) return
    setBusy('email-use')
    try {
      const ok = await patchCandidate({ email: bookingCandidateEmail.trim() })
      if (ok) toast({ title: 'Profile updated', description: 'Email replaced with the booked value.' })
    } finally { setBusy(null) }
  }

  const savePhone = async () => {
    if (!bookingCandidatePhone) return
    setBusy('phone-save')
    try {
      const normalized = sanitizeToE164(bookingCandidatePhone) || bookingCandidatePhone
      const ok = await patchCandidate({ phone: normalized })
      if (ok) toast({ title: 'Profile updated', description: 'Phone saved to candidate profile.' })
    } finally { setBusy(null) }
  }

  const useBookedPhone = async () => {
    if (!bookingCandidatePhone) return
    setBusy('phone-use')
    try {
      const normalized = sanitizeToE164(bookingCandidatePhone) || bookingCandidatePhone
      const ok = await patchCandidate({ phone: normalized })
      if (ok) toast({ title: 'Profile updated', description: 'Phone replaced with the booked value.' })
    } finally { setBusy(null) }
  }

  const resendInvite = () => {
    if (!bookingId || !bookingCandidateEmail) return
    updateAttendee.mutate({ booking_id: bookingId, new_email: bookingCandidateEmail.trim() })
  }

  const actionable =
    emailState === 'empty' || emailState === 'differ' ||
    phoneState === 'empty' || phoneState === 'differ'

  const hasNotes = !!(bookingNotes && bookingNotes.trim().length > 0)

  // Nothing at all — render nothing.
  if (!emailState && !phoneState && !hasNotes) return null

  // Past variant + not actionable → render nothing.
  if (variant === 'past' && !actionable) return null

  // Upcoming, everything matches → single slim line + optional notes toggle.
  if (variant === 'upcoming' && !actionable) {
    return (
      <div className="mt-3">
        <div className="flex items-center gap-2 font-inter text-[11.5px] text-[#5A6072]">
          <Check className="h-3 w-3 text-[#0B7A57]" />
          <span>Booking details match profile</span>
          <span className="text-[#B5B9C4]">·</span>
          <span className="text-[#8B8F9E]">from booking form</span>
        </div>
        {hasNotes && (
          <>
            <button
              type="button"
              onClick={() => setNotesOpen((v) => !v)}
              className="mt-2 w-full flex items-center gap-2 text-left group"
            >
              <MessageSquareText className="h-3.5 w-3.5 text-[#5A6072]" />
              <span className="font-inter text-[12px] font-medium text-[#1F2230] group-hover:text-[#0d0d09]">
                Notes from candidate
              </span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 text-[#8B8F9E] transition-transform ml-auto',
                  notesOpen && 'rotate-180',
                )}
              />
            </button>
            {notesOpen && (
              <div
                className="mt-2 font-inter text-[12px] text-[#5A6072] whitespace-pre-wrap break-words"
                style={{ lineHeight: 1.55 }}
              >
                {bookingNotes}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  const displayEmail = bookingCandidateEmail?.trim() || ''
  const displayBookedPhone = bookingCandidatePhone
    ? formatE164Display(bookingCandidatePhone) || bookingCandidatePhone
    : ''
  const displayProfilePhone = profilePhone
    ? formatE164Display(profilePhone) || profilePhone
    : ''

  // Actionable rows only. In past variant, matched rows are skipped entirely.
  const showEmailRow = emailState === 'empty' || emailState === 'differ' ||
    (variant === 'upcoming' && emailState === 'match')
  const showPhoneRow = phoneState === 'empty' || phoneState === 'differ' ||
    (variant === 'upcoming' && phoneState === 'match')

  return (
    <div className="mt-3 rounded-[11px] border border-[#EDECE6] bg-white p-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="font-inter text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8F9E]">
          Attendee details
        </div>
        <span
          className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded-full font-inter text-[9.5px] font-semibold"
          style={{ backgroundColor: '#EDE4FF', color: '#6F3FF5' }}
        >
          <Link2 className="h-2.5 w-2.5" />
          From booking form
        </span>
      </div>

      {/* Email row */}
      {emailState && showEmailRow && (
        <div
          className={cn(
            rowBaseCls,
            emailState === 'match' || dismissedEmail
              ? 'bg-[#F7FBF8] border-[#DCEEE2]'
              : emailState === 'empty'
              ? 'bg-[#FBFAF7] border-[#EDECE6]'
              : 'bg-[#FFFBF2] border-[#F3E2BE]',
          )}
        >
          <div
            className={cn(
              tileBaseCls,
              emailState === 'match' || dismissedEmail
                ? 'bg-[#E3F5EA]'
                : emailState === 'empty'
                ? 'bg-[#F1F0EC]'
                : 'bg-[#FBEBC6]',
            )}
          >
            <Mail
              className={cn(
                'h-3 w-3',
                emailState === 'match' || dismissedEmail
                  ? 'text-[#0B7A57]'
                  : emailState === 'empty'
                  ? 'text-[#8B8F9E]'
                  : 'text-[#B45309]',
              )}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={microLabel}>Email</span>
              {emailState === 'match' || dismissedEmail ? (
                <span className="inline-flex items-center gap-0.5 font-inter text-[10px] font-medium text-[#0B7A57]">
                  <Check className="h-2.5 w-2.5" /> Matches profile
                </span>
              ) : emailState === 'empty' ? (
                <span className="font-inter text-[10px] font-medium text-[#A8770F]">
                  Not on profile yet
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 font-inter text-[10px] font-semibold text-[#B45309]">
                  <AlertTriangle className="h-2.5 w-2.5" /> Doesn't match profile
                </span>
              )}
            </div>

            {emailState !== 'differ' || dismissedEmail ? (
              <div className={cn(valueTextCls, 'mt-0.5')}>{displayEmail}</div>
            ) : (
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center gap-2 min-w-0">
                  <TagChip label="Booked" tone="booked" />
                  <span className="font-inter text-[13px] font-medium text-[#1F2230] break-all">
                    {displayEmail}
                  </span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <TagChip label="Profile" tone="profile" />
                  <span className="font-inter text-[13px] text-[#5A6072] break-all">
                    {profileEmail}
                  </span>
                </div>
              </div>
            )}

            {emailState === 'empty' && (
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={UserPlus}
                  loading={busy === 'email-save'}
                  onClick={saveEmailToProfile}
                >
                  Save to profile
                </Button>
              </div>
            )}

            {emailState === 'differ' && !dismissedEmail && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Button size="sm" icon={ArrowUp} loading={busy === 'email-use'} onClick={useBookedEmail}>
                  Use booked value
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDismissedEmail(true)}>
                  Keep profile value
                </Button>
                {variant === 'upcoming' && bookingId &&
                  (inviteResent ? (
                    <span className="inline-flex items-center gap-1 font-inter text-[11.5px] font-medium text-[#0B7A57] ml-1">
                      <CheckCircle2 className="h-3 w-3" /> Invite updated &amp; resent
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Send}
                      loading={updateAttendee.isPending}
                      onClick={resendInvite}
                    >
                      Update invite &amp; resend
                    </Button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phone row */}
      {phoneState && showPhoneRow && (
        <div
          className={cn(
            rowBaseCls,
            'mt-2',
            phoneState === 'match' || dismissedPhone
              ? 'bg-[#F7FBF8] border-[#DCEEE2]'
              : phoneState === 'empty'
              ? 'bg-[#FBFAF7] border-[#EDECE6]'
              : 'bg-[#FFFBF2] border-[#F3E2BE]',
          )}
        >
          <div
            className={cn(
              tileBaseCls,
              phoneState === 'match' || dismissedPhone
                ? 'bg-[#E3F5EA]'
                : phoneState === 'empty'
                ? 'bg-[#F1F0EC]'
                : 'bg-[#FBEBC6]',
            )}
          >
            <Phone
              className={cn(
                'h-3 w-3',
                phoneState === 'match' || dismissedPhone
                  ? 'text-[#0B7A57]'
                  : phoneState === 'empty'
                  ? 'text-[#8B8F9E]'
                  : 'text-[#B45309]',
              )}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={microLabel}>Phone</span>
              {phoneState === 'match' || dismissedPhone ? (
                <span className="inline-flex items-center gap-0.5 font-inter text-[10px] font-medium text-[#0B7A57]">
                  <Check className="h-2.5 w-2.5" /> Matches profile
                </span>
              ) : phoneState === 'empty' ? (
                <span className="font-inter text-[10px] font-medium text-[#A8770F]">
                  Not on profile yet
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 font-inter text-[10px] font-semibold text-[#B45309]">
                  <AlertTriangle className="h-2.5 w-2.5" /> Doesn't match profile
                </span>
              )}
            </div>

            {phoneState !== 'differ' || dismissedPhone ? (
              <div className={cn(valueTextCls, 'mt-0.5')}>{displayBookedPhone}</div>
            ) : (
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center gap-2 min-w-0">
                  <TagChip label="Booked" tone="booked" />
                  <span className="font-inter text-[13px] font-medium text-[#1F2230] break-all">
                    {displayBookedPhone}
                  </span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <TagChip label="Profile" tone="profile" />
                  <span className="font-inter text-[13px] text-[#5A6072] break-all">
                    {displayProfilePhone}
                  </span>
                </div>
              </div>
            )}

            {phoneState === 'empty' && (
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={UserPlus}
                  loading={busy === 'phone-save'}
                  onClick={savePhone}
                >
                  Save to profile
                </Button>
              </div>
            )}

            {phoneState === 'differ' && !dismissedPhone && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Button size="sm" icon={ArrowUp} loading={busy === 'phone-use'} onClick={useBookedPhone}>
                  Use booked value
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDismissedPhone(true)}>
                  Keep profile value
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes collapsible */}
      {hasNotes && (
        <>
          <div className="mt-3 border-t border-[#F1F0EC]" />
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            className="mt-2 w-full flex items-center gap-2 text-left group"
          >
            <MessageSquareText className="h-3.5 w-3.5 text-[#5A6072]" />
            <span className="font-inter text-[12px] font-medium text-[#1F2230] group-hover:text-[#0d0d09]">
              Notes from candidate
            </span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-[#8B8F9E] transition-transform ml-auto',
                notesOpen && 'rotate-180',
              )}
            />
          </button>
          {notesOpen && (
            <div
              className="mt-2 font-inter text-[12px] text-[#5A6072] whitespace-pre-wrap break-words"
              style={{ lineHeight: 1.55 }}
            >
              {bookingNotes}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AttendeeDetailsBlock
