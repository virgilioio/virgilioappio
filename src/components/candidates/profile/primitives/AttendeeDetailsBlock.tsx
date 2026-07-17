import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Info, Mail, MessageSquareText, Pencil, Phone, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { sanitizeToE164, formatE164Display } from '@/utils/phoneUtils'

export interface AttendeeDetailsBlockProps {
  bookingCandidateName?: string | null
  bookingCandidateEmail?: string | null
  bookingCandidatePhone?: string | null
  bookingNotes?: string | null
  profileEmail?: string | null
  profilePhone?: string | null
  candidateId: string
  onEditAttendeeEmail?: () => void
}

type FieldState = 'match' | 'empty-profile' | 'differs'

function computeEmailState(booked?: string | null, profile?: string | null): FieldState | null {
  const b = (booked ?? '').trim()
  if (!b) return null
  const p = (profile ?? '').trim()
  if (!p) return 'empty-profile'
  return b.toLowerCase() === p.toLowerCase() ? 'match' : 'differs'
}

function computePhoneState(booked?: string | null, profile?: string | null): FieldState | null {
  const b = booked ? sanitizeToE164(booked) : ''
  if (!b) return null
  const p = profile ? sanitizeToE164(profile) : ''
  if (!p) return 'empty-profile'
  // Compare last 9 digits to be lenient across country-code formatting
  const bDigits = b.replace(/\D/g, '').slice(-9)
  const pDigits = p.replace(/\D/g, '').slice(-9)
  return bDigits && bDigits === pDigits ? 'match' : 'differs'
}

const rowShellCls = 'rounded-xl border p-3 flex items-start gap-3'
const iconTileCls = 'h-8 w-8 rounded-[9px] flex items-center justify-center shrink-0'
const labelCls = 'font-inter text-[10.5px] uppercase tracking-[0.06em] text-[#8B8F9E]'
const valueCls = 'font-inter text-[13px] font-medium text-[#1F2230] break-all'

export function AttendeeDetailsBlock({
  bookingCandidateName,
  bookingCandidateEmail,
  bookingCandidatePhone,
  bookingNotes,
  profileEmail,
  profilePhone,
  candidateId,
  onEditAttendeeEmail,
}: AttendeeDetailsBlockProps) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<null | 'email-save' | 'email-use' | 'phone-save' | 'phone-use'>(null)
  const [dismissedEmail, setDismissedEmail] = useState(false)
  const [dismissedPhone, setDismissedPhone] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)

  const emailState = useMemo(
    () => computeEmailState(bookingCandidateEmail, profileEmail),
    [bookingCandidateEmail, profileEmail],
  )
  const phoneState = useMemo(
    () => computePhoneState(bookingCandidatePhone, profilePhone),
    [bookingCandidatePhone, profilePhone],
  )

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
    } finally {
      setBusy(null)
    }
  }

  const useBookedEmail = async () => {
    if (!bookingCandidateEmail) return
    setBusy('email-use')
    try {
      const ok = await patchCandidate({ email: bookingCandidateEmail.trim() })
      if (ok) toast({ title: 'Profile updated', description: 'Email replaced with the booked value.' })
    } finally {
      setBusy(null)
    }
  }

  const saveOrUsePhone = async (mode: 'save' | 'use') => {
    if (!bookingCandidatePhone) return
    setBusy(mode === 'save' ? 'phone-save' : 'phone-use')
    try {
      const normalized = sanitizeToE164(bookingCandidatePhone)
      const ok = await patchCandidate({ phone: normalized })
      if (ok) toast({ title: 'Profile updated', description: 'Phone saved to candidate profile.' })
    } finally {
      setBusy(null)
    }
  }

  const anythingToShow =
    !!bookingCandidateName || !!bookingCandidateEmail || !!bookingCandidatePhone || !!bookingNotes
  if (!anythingToShow) return null

  const displayEmail = bookingCandidateEmail?.trim() || ''
  const displayBookedPhone = bookingCandidatePhone ? formatE164Display(bookingCandidatePhone) || bookingCandidatePhone : ''
  const displayProfilePhone = profilePhone ? formatE164Display(profilePhone) || profilePhone : ''

  return (
    <div className="mt-3 space-y-2">
      <div className="font-poppins font-semibold text-[10.5px] uppercase tracking-[0.06em] text-[hsl(var(--menu-group-color))]">
        Attendee details
      </div>

      {/* Name (display-only) */}
      {bookingCandidateName && (
        <div className={cn(rowShellCls, 'border-[#EDECE6] bg-white')}>
          <div className={cn(iconTileCls, 'bg-[#FAFAF7]')}>
            <User className="h-3.5 w-3.5 text-[#5A6072]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className={labelCls}>Name typed</div>
            <div className={valueCls}>{bookingCandidateName}</div>
          </div>
        </div>
      )}

      {/* Email row */}
      {emailState && (
        <div
          className={cn(
            rowShellCls,
            emailState === 'differs' && !dismissedEmail
              ? 'border-[#F7D77E] bg-[#FFFBEB]'
              : 'border-[#EDECE6] bg-white',
          )}
        >
          <div
            className={cn(
              iconTileCls,
              emailState === 'match' && 'bg-[#ECFDF3]',
              emailState === 'empty-profile' && 'bg-[#FAFAF7]',
              emailState === 'differs' && 'bg-[#FEF3C7]',
            )}
          >
            {emailState === 'match' ? (
              <Check className="h-3.5 w-3.5 text-[#0B7A57]" />
            ) : emailState === 'differs' && !dismissedEmail ? (
              <AlertTriangle className="h-3.5 w-3.5 text-[#B45309]" />
            ) : (
              <Mail className="h-3.5 w-3.5 text-[#5A6072]" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {emailState === 'match' && (
              <>
                <div className={labelCls}>Email · matches profile</div>
                <div className={valueCls}>{displayEmail}</div>
              </>
            )}
            {emailState === 'empty-profile' && (
              <>
                <div className={labelCls}>Email · not on profile yet</div>
                <div className={valueCls}>{displayEmail}</div>
                <div className="mt-2">
                  <Button size="xs" variant="secondary" loading={busy === 'email-save'} onClick={saveEmailToProfile}>
                    Save to profile
                  </Button>
                </div>
              </>
            )}
            {emailState === 'differs' && (
              <>
                <div className={labelCls}>Email · differs from profile</div>
                <div className="mt-1 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-inter text-[10.5px] uppercase tracking-[0.06em] text-[#8B8F9E] w-[60px] shrink-0">Booked</span>
                    <span className={valueCls}>{displayEmail}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-inter text-[10.5px] uppercase tracking-[0.06em] text-[#8B8F9E] w-[60px] shrink-0">Profile</span>
                    <span className="font-inter text-[13px] text-[#5A6072] break-all">{profileEmail}</span>
                  </div>
                </div>
                {!dismissedEmail && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="xs" loading={busy === 'email-use'} onClick={useBookedEmail}>
                      Use booked value
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setDismissedEmail(true)}>
                      Keep profile value
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {onEditAttendeeEmail && (
            <button
              type="button"
              aria-label="Edit attendee email"
              title="Edit attendee email"
              onClick={onEditAttendeeEmail}
              className="h-7 w-7 -mr-1 -mt-1 rounded-md text-[#5A6072] hover:bg-[#F1F0EC] flex items-center justify-center transition-colors shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Phone row */}
      {phoneState && (
        <div
          className={cn(
            rowShellCls,
            phoneState === 'differs' && !dismissedPhone
              ? 'border-[#F7D77E] bg-[#FFFBEB]'
              : 'border-[#EDECE6] bg-white',
          )}
        >
          <div
            className={cn(
              iconTileCls,
              phoneState === 'match' && 'bg-[#ECFDF3]',
              phoneState === 'empty-profile' && 'bg-[#FAFAF7]',
              phoneState === 'differs' && 'bg-[#FEF3C7]',
            )}
          >
            {phoneState === 'match' ? (
              <Check className="h-3.5 w-3.5 text-[#0B7A57]" />
            ) : phoneState === 'differs' && !dismissedPhone ? (
              <AlertTriangle className="h-3.5 w-3.5 text-[#B45309]" />
            ) : (
              <Phone className="h-3.5 w-3.5 text-[#5A6072]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {phoneState === 'match' && (
              <>
                <div className={labelCls}>Phone · matches profile</div>
                <div className={valueCls}>{displayBookedPhone}</div>
              </>
            )}
            {phoneState === 'empty-profile' && (
              <>
                <div className={labelCls}>Phone · not on profile yet</div>
                <div className={valueCls}>{displayBookedPhone}</div>
                <div className="mt-2">
                  <Button size="xs" variant="secondary" loading={busy === 'phone-save'} onClick={() => saveOrUsePhone('save')}>
                    Save to profile
                  </Button>
                </div>
              </>
            )}
            {phoneState === 'differs' && (
              <>
                <div className={labelCls}>Phone · differs from profile</div>
                <div className="mt-1 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-inter text-[10.5px] uppercase tracking-[0.06em] text-[#8B8F9E] w-[60px] shrink-0">Booked</span>
                    <span className={valueCls}>{displayBookedPhone}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-inter text-[10.5px] uppercase tracking-[0.06em] text-[#8B8F9E] w-[60px] shrink-0">Profile</span>
                    <span className="font-inter text-[13px] text-[#5A6072] break-all">{displayProfilePhone}</span>
                  </div>
                </div>
                {!dismissedPhone && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="xs" loading={busy === 'phone-use'} onClick={() => saveOrUsePhone('use')}>
                      Use booked value
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setDismissedPhone(true)}>
                      Keep profile value
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Notes collapsible */}
      {bookingNotes && bookingNotes.trim().length > 0 && (
        <div className="rounded-xl border border-[#EDECE6] bg-white">
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#FAFAF7] transition-colors rounded-xl"
          >
            <div className={cn(iconTileCls, 'bg-[#FAFAF7]')}>
              <MessageSquareText className="h-3.5 w-3.5 text-[#5A6072]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={labelCls}>Notes from candidate</div>
              <div className="font-inter text-[12.5px] text-[#5A6072]">
                {notesOpen ? 'Hide' : `Show (${bookingNotes.trim().length} chars)`}
              </div>
            </div>
            <Info className="h-3.5 w-3.5 text-[#8B8F9E] shrink-0" />
          </button>
          {notesOpen && (
            <div className="px-3 pb-3 pt-1 font-inter text-[13px] text-[#1F2230] whitespace-pre-wrap break-words">
              {bookingNotes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AttendeeDetailsBlock
