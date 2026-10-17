import { Info, TriangleAlert, X, type LucideIcon } from 'lucide-react'

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { IconTip } from '@/components/ui/tooltip'
import { FORMAT_OPTIONS, formatSample, type FormatKind, type ValueFormat } from '@/lib/sign/formats'
import { listLabels, signersWithoutSignature, useSampleValues, type TplDraft } from '@/lib/sign/templates'
import { writtenCounts } from '@/lib/sign/written'
import { sideH } from './fieldIcons'

/**
 * The Document step's right panel (§3.4, 2026-10-17). Nothing selected shows
 * the Summary; a selection shows its settings under a header with a close
 * button back to the Summary. No coverage here: it lives in the field list.
 */
export function PanelHead({ icon: Icon, title, sub, onClose }: { icon: LucideIcon; title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-px inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F4F3EF] text-text-secondary">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="truncate font-poppins text-[14px] font-semibold leading-tight text-text-primary">{title}</h4>
        {sub && <p className="mt-0.5 font-inter text-[11.5px] leading-snug text-text-tertiary">{sub}</p>}
      </div>
      <IconTip label="Back to the summary">
        <button
          type="button"
          aria-label="Back to the summary"
          onClick={onClose}
          className="gio-pressable inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-[#F4F3EF]"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </IconTip>
    </div>
  )
}

/** Nothing selected: what each signer has to fill in, the values, and who still can't sign. Counts placed and written fields. */
export function FieldSummary({ d }: { d: TplDraft }) {
  const people = d.roles.filter((r) => r.role !== 'cc')
  const unsigned = signersWithoutSignature(d)
  const written = d.written.map((w) => writtenCounts(w.content))
  const data = d.fields.filter((f) => f.type === 'data').length + written.reduce((a, c) => a + c.data, 0)
  return (
    <div className="flex flex-col gap-2.5">
      <h5 className={sideH}>Summary</h5>
      <ul className="flex flex-col gap-1.5">
        {people.map((r) => {
          const n = d.fields.filter((f) => f.rid === r.id).length + written.reduce((a, c) => a + (c.byRole.get(r.id) ?? 0), 0)
          return (
            <li key={r.id} className="flex items-center gap-2 font-inter text-[12.5px]">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />
              <span className="min-w-0 flex-1 truncate text-text-primary">{r.label || 'Unnamed role'}</span>
              <span className="tabular-nums text-text-tertiary">
                {n} field{n === 1 ? '' : 's'}
              </span>
            </li>
          )
        })}
        <li className="flex items-center gap-2 font-inter text-[12.5px]">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-dashed border-[#8456F6] bg-[#F3EDFE]" />
          <span className="flex-1 text-text-primary">Data fields</span>
          <span className="tabular-nums text-text-tertiary">{data}</span>
        </li>
      </ul>
      {unsigned.length ? (
        <p className="gio-send-note" data-tone="warn">
          <TriangleAlert className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span>
            {listLabels(unsigned.map((r) => r.label || 'A signer'), 3)} still need{unsigned.length === 1 ? 's' : ''} a signature field.
          </span>
        </p>
      ) : (
        <p className="gio-send-note" data-tone="info">
          <Info className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span>Every signer has a signature field.</span>
        </p>
      )}
    </div>
  )
}

/**
 * How a value prints, with a live sample of each format: from the latest
 * offer on the linked form when there is one (sign_sample_values), otherwise
 * a made-up value in the form field's currency and period.
 */
export function FormatPicker({
  fieldKey,
  kind,
  value,
  onChange,
  config,
  formId,
}: {
  fieldKey: string
  kind: FormatKind
  value: string | null | undefined
  onChange: (v: ValueFormat | null) => void
  config?: Record<string, unknown> | null
  formId: string | null
}) {
  const opts = FORMAT_OPTIONS[kind]
  const uses = opts.filter((o) => o.value).map((o) => [fieldKey, o.value!] as [string, string])
  const sample = useSampleValues(formId, uses)
  const real = sample.data?.values
  const realOf = (v: ValueFormat | null) => (real ? (v ? real[`${fieldKey}|${v}`] : real[fieldKey]) : null) || null
  // The offer's own values only when it has every format, so the samples never mix two amounts.
  const fromOffer = opts.every((o) => realOf(o.value))
  const textOf = (v: ValueFormat | null) => (fromOffer ? realOf(v)! : formatSample(kind, v, config))
  const current = opts.some((o) => o.value === (value ?? null)) ? value ?? null : null
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-inter text-[12.5px] font-medium text-text-primary">Format</p>
      <RadioGroup value={current ?? 'default'} onValueChange={(v) => onChange(v === 'default' ? null : (v as ValueFormat))} className="gap-1.5" aria-label="Format">
        {opts.map((o) => {
          const id = `fmt-${fieldKey}-${o.value ?? 'default'}`
          const on = current === o.value
          return (
            <label key={id} htmlFor={id} className="gio-fmt-opt" data-checked={on || undefined}>
              <RadioGroupItem id={id} value={o.value ?? 'default'} className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                <span className="block break-words font-inter text-[12.5px] font-medium leading-snug text-text-primary">{textOf(o.value)}</span>
                <span className="block font-inter text-[11px] text-text-tertiary">{o.label}</span>
              </span>
            </label>
          )
        })}
      </RadioGroup>
      <p className="font-inter text-[11px] text-text-tertiary">
        {fromOffer ? `Samples from ${sample.data?.firstName ? `${sample.data.firstName}’s` : 'the latest'} offer.` : 'Sample values; the agreement uses the offer’s own.'}
      </p>
    </div>
  )
}
