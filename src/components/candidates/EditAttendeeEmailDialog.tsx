import { useEffect, useState } from 'react'
import { z } from 'zod'
import { AlertTriangle, Mail } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUpdateBookingAttendee } from '@/hooks/useUpdateBookingAttendee'
import { suggestEmailFix } from '@/utils/emailTypoSuggest'

interface EditAttendeeEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  currentEmail: string
  onUpdated?: (newEmail: string) => void
}

const emailSchema = z.string().trim().email('Enter a valid email address').max(255, 'Email must be 255 characters or less')

export function EditAttendeeEmailDialog({
  open,
  onOpenChange,
  bookingId,
  currentEmail,
  onUpdated,
}: EditAttendeeEmailDialogProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValue(currentEmail || '')
      setError(null)
    }
  }, [open, currentEmail])

  const mutation = useUpdateBookingAttendee({
    onSuccess: (newEmail) => {
      onUpdated?.(newEmail)
      onOpenChange(false)
    },
  })

  const trimmed = value.trim()
  const parse = emailSchema.safeParse(trimmed)
  const isValid = parse.success
  const isUnchanged = trimmed.toLowerCase() === (currentEmail || '').trim().toLowerCase()
  const suggestion = isValid ? suggestEmailFix(trimmed) : null

  const handleSubmit = () => {
    if (!isValid) {
      setError(parse.error.issues[0]?.message || 'Invalid email')
      return
    }
    if (isUnchanged) {
      setError('The new email must be different from the current one.')
      return
    }
    setError(null)
    mutation.mutate({ booking_id: bookingId, new_email: trimmed })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#EDE4FF] flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4 text-[#6F3FF5]" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="font-poppins font-semibold text-[16px] tracking-[-0.01em] text-[#0D0D09]">
                Edit attendee email
              </DialogTitle>
              <p className="mt-1 font-inter text-[12.5px] text-[#5A6072]">
                Update the candidate address on the calendar invite and resend it. Time, meeting link and interviewers are unchanged.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-4">
          <div>
            <div className="font-inter text-[10.5px] uppercase tracking-[0.06em] text-[#8B8F9E] mb-1">Current attendee</div>
            <div className="rounded-lg bg-[#FAFAF7] border border-[#EDECE6] px-3 py-2.5 font-mono text-[12.5px] text-[#1F2230] break-all" style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
              {currentEmail || <span className="text-[#8B8F9E]">—</span>}
            </div>
          </div>

          <div>
            <label htmlFor="attendee-new-email" className="font-inter text-[10.5px] uppercase tracking-[0.06em] text-[#8B8F9E] mb-1 block">
              New attendee email
            </label>
            <Input
              id="attendee-new-email"
              type="email"
              autoFocus
              placeholder="candidate@example.com"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !mutation.isPending) handleSubmit() }}
              disabled={mutation.isPending}
            />
            {suggestion && !error && (
              <button
                type="button"
                onClick={() => setValue(suggestion)}
                className="mt-1.5 font-inter text-[11.5px] text-[#5A6072] hover:text-[#1F2230] text-left"
              >
                Did you mean <span className="font-semibold text-[#6F3FF5]">{suggestion}</span>?
              </button>
            )}
            {error && (
              <div className="mt-1.5 flex items-start gap-1.5 font-inter text-[11.5px] text-[#B45309]">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="rounded-lg bg-[#FFFBEB] border border-[#F7D77E] px-3 py-2.5">
            <div className="flex items-start gap-2 font-inter text-[11.5px] text-[#7A5D0A]">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Google will send an invite to the new address and a cancellation to the old one. Only the candidate is affected — interviewers are untouched.
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#EDECE6] flex items-center justify-end gap-2 bg-[#FAFAF7]">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending} disabled={!isValid || isUnchanged}>
            Update invite &amp; resend
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default EditAttendeeEmailDialog
