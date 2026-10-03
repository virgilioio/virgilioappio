import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CalendarDays, Loader2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useOfferLetters } from '@/hooks/useOfferLetters'
import { useOfferFormFields } from '@/hooks/useOfferFormFields'
import { useJobOpenings } from '@/hooks/useJobOpenings'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface MarkHiredDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  candidateId: string
  candidateName: string
  jobId: string
  onSuccess: (result: { reqId: string; startDate: string }) => void
}

function offerStartDate(fieldValues: Record<string, unknown> | undefined) {
  if (!fieldValues) return null
  const entry = Object.entries(fieldValues).find(([key, value]) =>
    /start.*date|date.*start/i.test(key) && typeof value === 'string',
  )
  return entry?.[1] as string | null
}

export function MarkHiredDialog({
  open,
  onOpenChange,
  applicationId,
  candidateId,
  candidateName,
  jobId,
  onSuccess,
}: MarkHiredDialogProps) {
  const { openings, isLoading, refetch } = useJobOpenings(jobId)
  const { offerLetters } = useOfferLetters(candidateId)
  const jobOffers = offerLetters.filter((item) => item.job_id === jobId && item.status !== 'declined')
  const offer = jobOffers.find((item) => item.status === 'accepted') || jobOffers[0]
  const { fields } = useOfferFormFields(offer?.form_id || undefined)
  const [openingId, setOpeningId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [closeJob, setCloseJob] = useState(false)
  const [saving, setSaving] = useState(false)

  const eligible = useMemo(
    () => openings.filter((opening) => opening.status !== 'filled'),
    [openings],
  )
  const selected = openings.find((opening) => opening.id === openingId)
  const isLastOpening = eligible.length === 1 && eligible[0]?.id === openingId

  useEffect(() => {
    if (!open || openings.length === 0) return
    const preferred = openings.find((opening) => opening.id === offer?.opening_id && opening.status !== 'filled')
      || eligible[0]
    if (!preferred) return
    setOpeningId(preferred.id)
    const startField = fields.find((field) => /start.*date|date.*start/i.test(`${field.field_name} ${field.field_label}`))
    const confirmedStart = startField && typeof offer?.field_values?.[startField.field_name] === 'string'
      ? offer.field_values[startField.field_name]
      : offerStartDate(offer?.field_values)
    setStartDate(confirmedStart || preferred.target_start_date || '')
    setCloseJob(false)
  }, [open, openings, offer?.opening_id, fields])

  const chooseOpening = (id: string) => {
    const next = openings.find((opening) => opening.id === id)
    setOpeningId(id)
    if (next?.target_start_date) setStartDate(next.target_start_date)
    setCloseJob(false)
  }

  const confirmHire = async () => {
    if (!openingId || !startDate) return
    setSaving(true)
    const { data, error } = await (supabase as any).rpc('mark_hired', {
      p_application_id: applicationId,
      p_opening_id: openingId,
      p_start_date: startDate,
      p_close_job: closeJob,
    })
    setSaving(false)

    if (error) {
      const race = /just filled|opening/i.test(error.message || '')
      toast({
        title: race ? 'Opening no longer available' : 'Could not mark candidate hired',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      })
      await refetch()
      return
    }

    const result = Array.isArray(data) ? data[0] : data
    onSuccess({ reqId: result?.req_id || selected?.req_id || '', startDate })
    onOpenChange(false)
    toast({
      title: `${candidateName} is hired`,
      description: `${result?.req_id || selected?.req_id} is now filled.`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-virgilio-border px-6 py-5">
          <DialogTitle className="font-poppins text-[17px]">Mark {candidateName} as hired</DialogTitle>
          <DialogDescription>Choose the opening this hire will fill.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <Label>Opening / Req ID</Label>
            {isLoading ? (
              <div className="flex h-20 items-center justify-center text-text-secondary">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading openings…
              </div>
            ) : eligible.length === 0 ? (
              <p className="rounded-lg border border-virgilio-border bg-surface-secondary p-4 text-body-sm text-text-secondary">
                This job has no unfilled openings.
              </p>
            ) : (
              <RadioGroup value={openingId} onValueChange={chooseOpening} className="gap-2">
                {eligible.map((opening) => {
                  const reservedForAnother = opening.status === 'offer' && opening.candidate_id !== candidateId
                  return (
                    <Label
                      key={opening.id}
                      htmlFor={`hire-opening-${opening.id}`}
                      className={cn(
                        'mb-0 flex min-h-[58px] items-center gap-3 rounded-lg border border-virgilio-border px-3.5 py-2.5',
                        openingId === opening.id && 'border-primary bg-surface-secondary',
                        reservedForAnother && 'cursor-not-allowed opacity-55',
                      )}
                    >
                      <RadioGroupItem
                        id={`hire-opening-${opening.id}`}
                        value={opening.id}
                        disabled={reservedForAnother}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-poppins text-[13px] font-semibold text-text-primary">{opening.req_id}</span>
                        <span className="block text-[12px] font-normal text-text-secondary">
                          Target start {format(new Date(`${opening.target_start_date}T00:00:00`), 'MMM d, yyyy')}
                          {opening.status === 'offer' ? ` · Reserved${opening.candidate_name ? ` for ${opening.candidate_name}` : ''}` : ' · Open'}
                        </span>
                      </span>
                    </Label>
                  )
                })}
              </RadioGroup>
            )}
          </div>

          <div className="space-y-2">
            <Label>Confirmed start date</Label>
            <DatePickerVirgilio
              value={startDate ? new Date(`${startDate}T00:00:00`) : undefined}
              onChange={(date) => setStartDate(format(date, 'yyyy-MM-dd'))}
              placeholder="Choose start date"
              className="w-full"
            />
          </div>

          {isLastOpening && (
            <Label htmlFor="close-filled-job" className="mb-0 flex items-start gap-3 rounded-lg border border-virgilio-border bg-surface-secondary p-3.5">
              <Checkbox
                id="close-filled-job"
                checked={closeJob}
                onCheckedChange={(checked) => setCloseJob(checked === true)}
              />
              <span>
                <span className="block text-[13px] font-medium text-text-primary">Close this job</span>
                <span className="mt-0.5 block text-[12px] font-normal text-text-secondary">This is the final unfilled opening.</span>
              </span>
            </Label>
          )}
        </div>

        <DialogFooter className="border-t border-virgilio-border px-6 py-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button icon={CalendarDays} onClick={confirmHire} disabled={!openingId || !startDate || eligible.length === 0} loading={saving}>
            Confirm hire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}