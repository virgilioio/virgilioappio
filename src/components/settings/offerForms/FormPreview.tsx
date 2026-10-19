import { CalendarDays, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OfferFormField } from '@/hooks/useOfferFormFields'
import type { LocationFieldConfig, PhoneFieldConfig, SalaryFieldConfig } from '@/hooks/useJobPostingFields'
import { groupBySection, isWideField, type OfferSection } from '@/lib/offerSections'

const PER: Record<string, string> = { hourly: 'per hour', monthly: 'per month', annually: 'per year' }

function Box({ children, tall, select, className }: { children?: React.ReactNode; tall?: boolean; select?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center justify-between gap-2 rounded-md border border-virgilio-border bg-white px-3 font-inter text-[13px] text-text-tertiary',
        tall ? 'h-[72px] items-start pt-2' : 'h-9',
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {select && <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
    </div>
  )
}

function Control({ field }: { field: OfferFormField }) {
  const ph = field.placeholder_text || `Enter ${field.field_label.toLowerCase()}…`
  switch (field.field_type) {
    case 'textarea':
      return <Box tall>{ph}</Box>
    case 'date':
      return (
        <div className="flex h-9 items-center gap-2 rounded-md border border-virgilio-border bg-white px-3 font-inter text-[13px] text-text-tertiary">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Pick a date
        </div>
      )
    case 'salary': {
      const c = (field.field_config as SalaryFieldConfig | null) ?? { currency: 'USD', period: 'annually' }
      return (
        <div className="flex gap-2">
          <Box select className="w-[92px] shrink-0">{c.currency}</Box>
          <Box className="flex-1">Amount {PER[c.period] ?? ''}</Box>
        </div>
      )
    }
    case 'location': {
      const parts = ((field.field_config as LocationFieldConfig | null)?.fields ?? ['city', 'state', 'country']).map((p) =>
        p === 'state' ? 'State / province' : p[0].toUpperCase() + p.slice(1),
      )
      return (
        <div className={cn('grid gap-2', parts.length > 1 && 'sm:grid-cols-3')}>
          {parts.map((p) => (
            <Box key={p}>{p}</Box>
          ))}
        </div>
      )
    }
    case 'phone':
      return (
        <div className="flex gap-2">
          <Box select className="w-[84px] shrink-0">
            <span className="tabular-nums">{(field.field_config as PhoneFieldConfig | null)?.defaultCountryCode || '+1'}</span>
          </Box>
          <Box className="flex-1">Phone number</Box>
        </div>
      )
    case 'recruiter':
      return <Box select>Choose a recruiter…</Box>
    case 'employment_type':
      return <Box select>Full-time</Box>
    case 'work_location':
      return <Box select>Remote, hybrid or on-site</Box>
    default:
      return <Box>{ph}</Box>
  }
}

function Label({ field }: { field: OfferFormField }) {
  return (
    <p className="mb-1.5 flex items-center gap-1 font-inter text-[11.5px] font-medium text-dup-text">
      <span className="truncate">{field.field_label}</span>
      {field.is_required ? <span className="text-destructive">*</span> : <span className="text-[10.5px] text-dup-subtle">(optional)</span>}
    </p>
  )
}

/**
 * Preview (2026-10-19): the form as the offer composer's Terms step lays it
 * out (OfferComposerBody): its sections in order, one or two columns, the
 * Req ID at the top of the first section, empty sections left out, tick-box
 * fields as rows. Nothing here can be typed into.
 */
export function FormPreview({ sections, fields }: { sections: OfferSection[]; fields: OfferFormField[] }) {
  const groups = groupBySection(sections, fields)
  return (
    <div className="mx-auto max-w-[760px]" aria-label="Preview of the offer form" role="group">
      <p className="mb-4 font-inter text-[12.5px] text-text-tertiary">
        What recruiters fill in on an offer’s Terms step. Empty sections don’t show.
      </p>
      <div className="pointer-events-none select-none rounded-xl bg-dup-canvas-alt p-4 sm:p-6" aria-hidden="true">
        {groups.map((group, index) => {
          if (index > 0 && group.fields.length === 0) return null
          const two = (group.section?.columns ?? 2) === 2
          return (
            <section key={group.section?.id ?? 'all'} className="mb-[18px] last:mb-0">
              {group.section && (
                <h3 className="mb-2.5 font-poppins text-[12.5px] font-semibold uppercase tracking-[0.06em] text-dup-text">{group.section.title}</h3>
              )}
              <div className="rounded-lg border border-virgilio-border bg-card p-4">
                {index === 0 && (
                  <div className="mb-3">
                    <p className="mb-1.5 font-inter text-[11.5px] font-medium text-dup-text">
                      Req ID <span className="text-destructive">*</span>
                    </p>
                    <Box select>Choose an opening…</Box>
                  </div>
                )}
                {group.fields.length > 0 && (
                  <div className={cn('grid gap-3.5', two && 'sm:grid-cols-2')}>
                    {group.fields.map((field) =>
                      field.field_type === 'checkbox' ? (
                        <div key={field.id} className={cn('flex items-center justify-between gap-4 py-1', two && 'sm:col-span-2')}>
                          <p className="font-inter text-[12.5px] font-medium text-dup-text">{field.field_label}</p>
                          <span className="h-5 w-9 shrink-0 rounded-full bg-[#E7E8EE]" />
                        </div>
                      ) : (
                        <div key={field.id} className={cn('min-w-0', two && isWideField(field) && 'sm:col-span-2')}>
                          <Label field={field} />
                          <Control field={field} />
                          {field.help_text && <p className="mt-1 font-inter text-[11px] leading-[1.45] text-dup-subtle">{field.help_text}</p>}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
