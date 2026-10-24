import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { COUNTRIES } from '@/constants/countries'
import { shakeFirstInvalid } from '@/lib/motion'
import { useAddDayOff } from '@/lib/os/calendar'
import { fromIsoDay, toIsoDay } from '@/lib/isoDay'

const todayIso = () => toIsoDay(new Date())

/**
 * Add a day off (People & Access dashboard, 2026-10-24): the workspace's own
 * holiday (Diwali, a company day off). Everyone sees it on My profile and the
 * admins' bell rings the day before. The countries people live in come first.
 */
export function DayOffDialog({
  open,
  onOpenChange,
  tenantId,
  countries,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  /** Where people live, offered first. */
  countries: string[]
}) {
  const add = useAddDayOff(tenantId)
  const [name, setName] = useState('')
  const [day, setDay] = useState('')
  const [country, setCountry] = useState('')
  const [tried, setTried] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setDay('')
    setCountry(countries[0] ?? 'MX')
    setTried(false)
    setServerError(null)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const options = [
    ...countries.map((c) => ({ value: c, label: COUNTRIES.find((x) => x.value === c)?.label ?? c, hint: 'Where people live' })),
    ...COUNTRIES.filter((c) => !countries.includes(c.value)),
  ]
  const problems = {
    name: !name.trim() ? 'Name the day off.' : name.trim().length > 120 ? 'Keep the name to 120 characters.' : undefined,
    day: !day ? 'Choose the date.' : day < todayIso() ? 'Choose today or a later date.' : undefined,
    country: !country ? 'Choose where it applies.' : undefined,
  }
  const show = (k: keyof typeof problems) => (tried ? problems[k] : undefined)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (problems.name || problems.day || problems.country) {
      shakeFirstInvalid(formRef.current)
      return
    }
    add.mutate(
      { name, day, country },
      {
        onSuccess: () => {
          toast.success(`${name.trim()} is on everyone's calendar.`)
          onOpenChange(false)
        },
        onError: (err) =>
          setServerError(
            (err as { code?: string })?.code === '23505' ? 'That day off is already there.' : "Couldn't add the day off. Try again.",
          ),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !add.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[460px]">
        <form ref={formRef} onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Add a day off</DialogTitle>
            <DialogDescription>Everyone sees it on My profile, and admins get a reminder the day before.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-1">
            <FormField label="Name" htmlFor="dayoff-name" error={show('name')}>
              <Input
                id="dayoff-name"
                value={name}
                maxLength={120}
                autoComplete="off"
                disabled={add.isPending}
                onChange={(e) => {
                  setName(e.target.value)
                  setServerError(null)
                }}
                placeholder="Diwali"
                aria-invalid={!!show('name') || undefined}
              />
            </FormField>
            <div className="grid gap-x-3 sm:grid-cols-2">
              <FormField label="Date" htmlFor="dayoff-date" error={show('day')}>
                <DatePickerVirgilio
                  id="dayoff-date"
                  className="h-11 w-full"
                  placeholder="Choose a date"
                  minDate={fromIsoDay(todayIso())}
                  value={fromIsoDay(day)}
                  readOnly={add.isPending}
                  onChange={(d) => {
                    setDay(toIsoDay(d))
                    setServerError(null)
                  }}
                  aria-invalid={!!show('day')}
                />
              </FormField>
              <FormField label="Observed in" htmlFor="dayoff-country" error={show('country')}>
                <SearchableSelect
                  options={options}
                  value={country}
                  onValueChange={setCountry}
                  placeholder="Choose a country"
                  searchPlaceholder="Search countries…"
                  emptyMessage="No country by that name."
                  disabled={add.isPending}
                />
              </FormField>
            </div>
          </div>
          <p className="min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role={serverError ? 'alert' : undefined}>
            {serverError}
          </p>
          <DialogFooter className="mt-2">
            <Button type="button" variant="secondary" disabled={add.isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={add.isPending}>
              Add day off
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
